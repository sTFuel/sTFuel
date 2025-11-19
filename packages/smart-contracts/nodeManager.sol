// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title NodeManager
 * @author sTFuel Team
 * @notice Manages staking/unstaking TFuel across Elite Edge Nodes (EENs)
 * @dev This contract implements a sophisticated node management system with:
 *      - FIFO withdrawal queue for user redemptions
 *      - FIFO unstake queue for node management
 *      - Pre-computed keeper tips for queue processing
 *      - Bucket-based node organization for efficient staking
 *      - Faulty node recovery mechanisms
 * 
 * Key Features:
 * - Stakes excess TFuel into EENs automatically
 * - Manages withdrawal requests with cooldown periods
 * - Processes queue with keeper incentives
 * - Handles faulty nodes with recovery options
 * - Maintains liquidity buffers for immediate redemptions
 */
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

using SafeERC20 for IERC20;

contract NodeManager is AccessControl, ReentrancyGuard {
    // =============================================================================
    // CONSTANTS & ENUMS
    // =============================================================================

    /// @notice Role identifier for contract managers
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    /// @notice Minimum stake amount per node (10,000 TFuel)
    uint256 public constant MIN_STAKE_AMOUNT = 10_000 ether;
    
    /// @notice Cooldown period for unstaking (28,800 blocks ≈ 3 days on Theta)
    uint64 public constant COOLDOWN_PERIOD = 28_800;

    /// @notice Node capacity types
    enum NodeType { 
        None,           // 0 - Invalid/Uninitialized
        Tenk,           // 1 - 10,000 TFuel capacity
        Fiftyk,         // 2 - 50,000 TFuel capacity
        Hundredk,       // 3 - 100,000 TFuel capacity
        TwoHundredk,    // 4 - 200,000 TFuel capacity
        FiveHundredk    // 5 - 500,000 TFuel capacity
    }

    /// @notice Node bucket states for efficient organization
    enum Bucket { 
        None,    // 0 - Not in any bucket
        Empty,   // 1 - Empty node ready for staking
        Half,    // 2 - Partially filled node
        Full,    // 3 - Fully staked node
        Unstake  // 4 - Node in unstaking process
    }

    // =============================================================================
    // CUSTOM ERRORS
    // =============================================================================

    /// @notice Thrown when EEN summary has invalid length
    error InvalidLength(uint256 length);
    
    /// @notice Thrown when parsed address doesn't match expected
    error AddressMismatch(address parsed, address expected);
    
    /// @notice Thrown when staking operation fails
    error StakingFailed(address node, uint256 amount);

    // =============================================================================
    // CONFIGURABLE PARAMETERS
    // =============================================================================
    
    /// @notice Keeper tip percentage (= withdrawal fee) in basis points (5 = 0.05%)
    uint16 public keeperTipBps = 5;
    
    /// @notice Maximum keeper tip per call (50 TFuel)
    uint256 public keeperTipMax = 50 ether;
    
    /// @notice Maximum nodes to stake in one call
    uint16 public maxNodesPerStakingCall = 50;

    // =============================================================================
    // LIQUIDITY TRACKING
    // =============================================================================

    /// @notice Total TFuel currently staked across all nodes
    uint256 public totalStakedTFuel;
    
    /// @notice TFuel in cooldown + matured but not yet reconciled
    uint256 public tfuelRequestedUnstake;
    
    /// @notice Net user payouts + tips not yet paid
    uint256 public totalTFuelUserRequestedToRedeem;
    
    /// @notice Sum of ALL request tips currently in the queue
    uint256 public totalTipsOutstandingEstimate;
    
    /// @notice Cumulative payouts to keepers
    uint256 public totalKeeperTipsPaid;
    
    /// @notice Cached maturity block of unstake head (0 if none)
    uint64 public nextUnstakeBlock;
    
    /// @notice Last balance after an update was made
    uint256 public lastBalance;

    // =============================================================================
    // NODE MANAGEMENT
    // =============================================================================

    /// @notice Node information structure
    struct NodeInfo {
        NodeType nodeType;           // Node capacity type
        bool isActive;               // Whether node is active
        uint256 stakedTFuel;         // Currently staked amount (0 once cooldown started)
        uint256 unstakingAmount;     // Exact TFuel in cooldown
        uint64 cooldownBlockEnd;     // Maturity block for this lot
        bytes eenSummary;            // 261-byte EEN holder summary
        Bucket bucket;               // Which bucket array this node is in
    }

    /// @notice Mapping of node addresses to their information
    mapping(address => NodeInfo) private _nodes;

    // Node bucket arrays for efficient organization
    address[] public tenkNodesEmpty;
    address[] public fiftykNodesEmpty;
    address[] public hundredkNodesEmpty;
    address[] public twoHundredkNodesEmpty;
    address[] public fiveHundredkNodesEmpty;

    address[] public halfFullNodes; // Partially filled nodes

    address[] public tenkNodesFull;
    address[] public fiftykNodesFull;
    address[] public hundredkNodesFull;
    address[] public twoHundredkNodesFull;
    address[] public fiveHundredkNodesFull;

    /// @notice Bucket index tracking for O(1) removal
    mapping(address => uint256) public indexInBucket;

    /// @notice Total registered nodes
    uint256 public totalNodes;
    
    /// @notice Nodes with stakedTFuel > 0
    uint256 public usedNodes;

    // =============================================================================
    // QUEUE MANAGEMENT
    // =============================================================================

    /// @notice Withdrawal request structure
    struct Req {
        address user;        // 20 bytes - User requesting withdrawal
        uint256 readyAt;      // Block number when ready
        uint256 amount;      // Net amount to user (after fees)
        uint256 keeperTip;   // Precomputed tip (per-item cap already applied)
    }

    /// @notice Withdrawal queue (FIFO)
    Req[] public wq;
    
    /// @notice Head index of withdrawal queue
    uint256 public wqHead;

    /// @notice Unstake queue (FIFO)
    address[] private _unstakeQ;
    
    /// @notice Head index of unstake queue
    uint256 private _uHead;

    /// @notice Tracks if node is in unstake queue
    mapping(address => bool) private _isInUnstakeQ;

    // =============================================================================
    // USER CREDITS
    // =============================================================================

    /// @notice User TFuel credits (for processed withdrawals)
    mapping(address => uint256) public userTFuelCredits;
    
    /// @notice Total TFuel credits outstanding
    uint256 public totalTFuelCredits;

    // =============================================================================
    // EXTERNAL REFERENCES
    // =============================================================================

    /// @notice Immutable reference to sTFuel contract
    address public immutable sTFuel;

    // =============================================================================
    // OPERATIONAL CONTROLS
    // =============================================================================

    /// @notice Staking pause switch
    bool public stakingPaused;

    // =============================================================================
    // FAULTY NODE MANAGEMENT
    // =============================================================================

    /// @notice Array of faulty staked nodes
    address[] public faultyStakedNodes;
    
    /// @notice Tracks if node is faulty and has been staked
    mapping(address => bool) public isFaultyStakedNode;
    
    /// @notice 1-based index for O(1) removal from faulty array
    mapping(address => uint256) private faultyIndex;

    // =============================================================================
    // EVENTS
    // =============================================================================

    event NodeRegistered(address indexed node, NodeType nodeType);
    event NodeDeactivated(address indexed node);
    event KeeperCredited(address indexed keeper, uint256 tipPaid, uint256 tipTotalProcessed); // update -> needs also update in backend code tipPaid -> tipCredited
    event TFuelStaked(address indexed node, uint256 amount);
    event TFuelUnstaked(address indexed node, uint256 amount);
    event ParamsUpdated(uint16 keeperTipBps, uint256 keeperTipMax);
    event StakingPauseChanged(bool paused);
    event MaxNodesPerStakingCallUpdated(uint16 maxNodes);
    event TNT20Withdrawn(address indexed to, address indexed token, uint256 amount);
    event CreditAssigned(address indexed user, uint256 amount, uint256 index);
    event NodeMarkedAsFaulty(address indexed node, uint256 stakedAmount);
    event FaultyNodeRecovered(address indexed node, uint256 amount);
    event KeeperTipSurplus(uint256 amount);
    event CurrentNetAssets(uint256 netAssets, bool isExact);

    // =============================================================================
    // MODIFIERS
    // =============================================================================

    /// @notice Restricts access to sTFuel contract only
    modifier onlySTFuel() {
        require(msg.sender == sTFuel, "ONLY_STFUEL");
        _;
    }

    // =============================================================================
    // CONSTRUCTOR
    // =============================================================================

    /**
     * @notice Initializes the NodeManager contract
     * @param _sTFuel Address of the sTFuel contract
     * @dev Sets up access control and initializes the contract
     */
    constructor(address _sTFuel) {
        require(_sTFuel != address(0), "sTFUEL_ZERO");
        sTFuel = _sTFuel;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
    }

    // =============================================================================
    // RECEIVE & FALLBACK
    // =============================================================================

    /// @notice Allows contract to receive TFuel
    receive() external payable {}

    /// @notice Fallback function for any other calls
    fallback() external payable {}

    // =============================================================================
    // ADMIN FUNCTIONS (EXTERNAL)
    // =============================================================================

    /**
     * @notice Sets contract parameters
     * @param _keeperTipBps Keeper tip percentage in basis points (max 100 = 1%)
     * @param _keeperTipMax Maximum keeper tip per call
     * @dev Only callable by MANAGER_ROLE
     */
    function setParams(
        uint16 _keeperTipBps,
        uint256 _keeperTipMax
    ) external onlyRole(MANAGER_ROLE) {
        require(_keeperTipBps <= 100, "TIP_TOO_HIGH");          // <=1%
        keeperTipBps = _keeperTipBps;
        keeperTipMax = _keeperTipMax;
        emit ParamsUpdated(_keeperTipBps, _keeperTipMax);
    }

    /**
     * @notice Sets maximum nodes per staking call
     * @param _maxNodes Maximum number of nodes to stake in one call
     * @dev Only callable by MANAGER_ROLE
     */
    function setMaxNodesPerStakingCall(uint16 _maxNodes) external onlyRole(MANAGER_ROLE) {
        require(_maxNodes > 0 && _maxNodes <= 200, "INVALID_MAX_NODES");
        maxNodesPerStakingCall = _maxNodes;
        emit MaxNodesPerStakingCallUpdated(_maxNodes);
    }

    /**
     * @notice Pauses staking operations
     * @dev Only callable by MANAGER_ROLE
     */
    function pauseStaking() external onlyRole(MANAGER_ROLE) {
        stakingPaused = true;
        emit StakingPauseChanged(true);
    }

    /**
     * @notice Unpauses staking operations
     * @dev Only callable by MANAGER_ROLE
     */
    function unpauseStaking() external onlyRole(MANAGER_ROLE) {
        stakingPaused = false;
        emit StakingPauseChanged(false);
    }

    /**
     * @notice Withdraws any TNT20 tokens from the contract
     * @param token Token contract address
     * @param amount Amount to withdraw
     * @dev Only callable by MANAGER_ROLE
     */
    function withdrawTNT20(address token, uint256 amount) external onlyRole(MANAGER_ROLE) {
        require(token != address(0), "TOKEN_ZERO");
        require(amount > 0, "AMOUNT_ZERO");
        IERC20(token).safeTransfer(msg.sender, amount);
        emit TNT20Withdrawn(msg.sender, token, amount);
    }

    /**
     * @notice Registers a new node
     * @param nodeAddress Address of the node
     * @param nodeType Type/capacity of the node
     * @param eenSummary 261-byte EEN holder summary
     * @dev Only callable by MANAGER_ROLE
     */
    function registerNode(
        address nodeAddress,
        NodeType nodeType,
        bytes calldata eenSummary
    ) external onlyRole(MANAGER_ROLE) nonReentrant {
        require(nodeAddress != address(0), "NODE_ZERO");
        NodeInfo storage exist = _nodes[nodeAddress];
        require(!exist.isActive, "ALREADY");
        require(nodeType != NodeType.None, "BAD_TYPE");

        // Forbid if any unstake is pending or queued
        require(exist.unstakingAmount == 0, "PENDING_UNSTAKE_AMT");
        require(exist.cooldownBlockEnd == 0, "PENDING_UNSTAKE_CD");
        require(exist.bucket == Bucket.None, "STILL_IN_BUCKET");
        require(!_isInUnstakeQ[nodeAddress], "PENDING_UNSTAKE_Q");
        require(!isFaultyStakedNode[nodeAddress], "ALREADY_FAULTY");

        // Validate EEN summary
        bool res = validate(eenSummary, nodeAddress);
        require(res, "INVALID_EEN_SUMMARY");

        _nodes[nodeAddress] = NodeInfo({
            nodeType: nodeType,
            isActive: true,
            stakedTFuel: 0,
            unstakingAmount: 0,
            cooldownBlockEnd: 0,
            eenSummary: eenSummary,
            bucket: Bucket.None  // Will be set to Empty by _pushEmpty
        });
        totalNodes++;
        _pushEmpty(nodeAddress, nodeType);
        emit NodeRegistered(nodeAddress, nodeType);
    }

    /**
     * @notice Deactivates a node
     * @param nodeAddress Address of the node to deactivate
     * @dev Only callable by MANAGER_ROLE
     */
    function deactivateNode(address nodeAddress) external onlyRole(MANAGER_ROLE) nonReentrant {
        NodeInfo storage node = _nodes[nodeAddress];
        require(node.isActive, "NOT_ACTIVE");
        if (node.bucket != Bucket.None && node.bucket != Bucket.Unstake) {
            _removeFromBucket(nodeAddress);
        }
        if (node.stakedTFuel > 0) {
            _unstakeAdmin(nodeAddress);
        }
        node.isActive = false;
        
        totalNodes = totalNodes > 0 ? totalNodes - 1 : 0;
        emit NodeDeactivated(nodeAddress);
    }

    /**
     * @notice Gets node information for manager
     * @param nodeAddress Address of the node
     * @return NodeInfo struct containing all node data
     * @dev Only callable by MANAGER_ROLE
     */
    function getNodeInfoForManager(address nodeAddress) external view onlyRole(MANAGER_ROLE) returns (NodeInfo memory) {
        return _nodes[nodeAddress];
    }

    /**
     * @notice Retries unstaking for a faulty node
     * @param nodeAddress Address of the faulty node
     * @dev Only callable by MANAGER_ROLE
     */
    function retryFaultyNodeUnstake(address nodeAddress) external onlyRole(MANAGER_ROLE) nonReentrant {
        require(isFaultyStakedNode[nodeAddress], "NOT_FAULTY");
        
        NodeInfo storage node = _nodes[nodeAddress];
        uint256 lot = node.stakedTFuel;
        require(lot > 0, "NO_STAKED_TFUEL");
        
        bool success = unstakeTFuelFromEEN(nodeAddress);
        
        if (success) {
            // Move from faulty to normal unstake flow
            node.unstakingAmount = lot;
            node.stakedTFuel = 0;
            node.cooldownBlockEnd = uint64(block.number + COOLDOWN_PERIOD);
            node.bucket = Bucket.Unstake;
            tfuelRequestedUnstake += lot;
            totalStakedTFuel = _saturatingSub(totalStakedTFuel, lot);
            if (usedNodes > 0) usedNodes--;
            
            // Remove from faulty tracking
            _removeFromFaultyArray(nodeAddress);
            
            // Add to unstake queue
            _uEnqueue(nodeAddress);
            if (_uLength() == 1) {
                nextUnstakeBlock = node.cooldownBlockEnd;
            }
            
            emit TFuelUnstaked(nodeAddress, lot);
            emit FaultyNodeRecovered(nodeAddress, lot);
        }
        // If still fails, leave in faulty array for future retry
    }

    // =============================================================================
    // sTFuel ENTRYPOINTS (EXTERNAL)
    // =============================================================================

    /**
     * @notice Deposits TFuel from sTFuel contract
     * @dev Only callable by sTFuel contract
     */
    function depositTFuel() external payable onlySTFuel nonReentrant {
        require(msg.value > 0, "NO_TFUEL");
        _updateUnstakingNodes(_uLength()); // keep accounting fresh
        _checkAndStakeTFuel();
        (uint256 netAssets, bool isExact) = _getNetAssetsBackingSharesSafe();
        emit CurrentNetAssets(netAssets, isExact);
    }

    /**
     * @notice Requests a withdrawal for a user
     * @param user Address of the user requesting withdrawal
     * @param amount Amount to withdraw
     * @return index Index of the withdrawal request
     * @return readyAt Block number when the withdrawal is ready
     * @return tip Tip paid to keeper
     * @dev Only callable by sTFuel contract
     */
    function requestWithdrawal(address user, uint256 amount) external onlySTFuel nonReentrant returns (uint256, uint256, uint256) {
        require(amount > 0, "ZERO");
        _updateUnstakingNodes(_uLength());

        // Fee is a value transfer effect in the sTFuel tokenomics (not held here).
        // We only track the *tip* here.
        uint256 tip = (amount * keeperTipBps) / 10_000;
        if (tip > keeperTipMax) tip = keeperTipMax; // item-level cap
        uint256 net = amount - tip; // calculated net amount that user will receive

        // Track pending user redemptions (net) to avoid staking what is about to exit
        totalTFuelUserRequestedToRedeem += net;
        // Track total tips present in the queue (for UI/ops)
        totalTipsOutstandingEstimate += tip;

        // Enqueue request
        uint256 readyAt = block.number + COOLDOWN_PERIOD;
        wq.push(
            Req({
                user: user,
                readyAt: readyAt,
                amount: net,
                keeperTip: tip
            })
        );

        _planUnstakeIfNeeded(); // may schedule/trigger unstake lots

        // Emit current net assets backing shares
        (uint256 netAssets, bool isExact) = _getNetAssetsBackingSharesSafe();
        emit CurrentNetAssets(netAssets, isExact);

        return (wq.length - 1, readyAt, tip);
    }

    /**
     * @notice Claims head withdrawal if ready
     * @param user Address of the user
     * @return paid Whether payment was made
     * @return amountPaid Amount paid to user
     * @return index Index of the withdrawal request
     * @dev Only callable by sTFuel contract
     */
    function claimHeadIfReady(address user) external onlySTFuel nonReentrant returns (bool paid, uint256 amountPaid, uint256 index) {
        _updateUnstakingNodes(_uLength());

        if (wqHead >= wq.length) return (false, 0, 0);
        Req memory r = wq[wqHead];
        if (r.user != user) return (false, 0, 0);
        if (block.number < r.readyAt) return (false, 0, 0);
        if (address(this).balance < r.amount) return (false, 0, 0);

        // Update pending trackers
        totalTFuelUserRequestedToRedeem = _saturatingSub(totalTFuelUserRequestedToRedeem, uint256(r.amount));
        totalTipsOutstandingEstimate = _saturatingSub(totalTipsOutstandingEstimate, uint256(r.keeperTip));

        // Payout user
        delete wq[wqHead];
        unchecked { wqHead++; }

        if (wqHead >= wq.length) {
            delete wq;        // resets length = 0
            wqHead = 0;
        }

        _pay(r.user, r.amount);

        _checkAndStakeTFuel();

        lastBalance = address(this).balance;

        // Emit current net assets backing shares after payout
        (uint256 netAssets, bool isExact) = _getNetAssetsBackingSharesSafe();
        emit CurrentNetAssets(netAssets, isExact);

        return (true, r.amount, wqHead - 1);
    }

    /**
     * @notice Direct redeem for user
     * @param user Address of the user
     * @param amount Amount to redeem in TFuel
     * @dev Only callable by sTFuel contract
     */
    function directRedeem(address user, uint256 amount) external onlySTFuel nonReentrant {
        require(address(this).balance >= (amount + getTotalTFuelReserved()), "INSUFFICIENT_BALANCE");
        _updateUnstakingNodes(_uLength());
        _pay(user, amount);
        _checkAndStakeTFuel();

        // Emit current net assets backing shares after payout
        (uint256 netAssets, bool isExact) = _getNetAssetsBackingSharesSafe();
        emit CurrentNetAssets(netAssets, isExact);
    }

    /**
     * @notice Allows users to withdraw all their TFuel credits
     * @param to Address to withdraw credits to
     * @return amount Amount withdrawn
     * @dev Only callable by sTFuel contract
     */
    function withdrawCredits(address to) external nonReentrant onlySTFuel returns (uint256 amount) {
        _updateUnstakingNodes(_uLength());

        amount = userTFuelCredits[to];
        require(amount > 0, "NO_CREDITS");
        require(address(this).balance >= amount, "INSUFFICIENT_BALANCE");
        
        // Update credit tracking
        userTFuelCredits[to] = 0;
        totalTFuelCredits -= amount;
        
        // Transfer TFuel to user
        _pay(to, amount);
        lastBalance = address(this).balance;

        // Emit current net assets backing shares after payout
        (uint256 netAssets, bool isExact) = _getNetAssetsBackingSharesSafe();
        emit CurrentNetAssets(netAssets, isExact);
    }

    // =============================================================================
    // PUBLIC FUNCTIONS
    // =============================================================================

    /**
     * @notice Stakes any excess liquid TFuel above a small buffer into nodes
     * @dev Anyone can call this to keep the system healthy
     */
    function stakeTFuel() external nonReentrant {
        _updateUnstakingNodes(_uLength());
        if (stakingPaused) return;  
        _checkAndStakeTFuel();
    }

    /**
     * @notice Updates unstaking nodes (bounded by maxNodes)
     * @param maxNodes Maximum number of nodes to update
     * @dev Anyone can call this to keep the system healthy
     */
    function updateUnstakingNodes(uint256 maxNodes) external nonReentrant {
        uint256 len = _uLength();
        if (maxNodes > len) maxNodes = len;
        _updateUnstakingNodes(maxNodes);
        lastBalance = address(this).balance;
    }

    /**
     * @notice Gets node information
     * @param nodeAddress Address of the node
     * @return node Node address
     * @return nodeType Node type/capacity
     * @return isActive Whether node is active
     * @return stakedTFuel Currently staked amount
     * @return unstakingAmount Amount in unstaking process
     * @return cooldownBlockEnd Block when cooldown ends
     * @return bucket Current bucket state
     */
    function getNodeInfo(address nodeAddress) external view returns (
            address node,
            NodeType nodeType,
            bool isActive,
            uint256 stakedTFuel,
            uint256 unstakingAmount,
            uint64 cooldownBlockEnd,
            Bucket bucket
    ) {
        NodeInfo storage n = _nodes[nodeAddress];
        return (
            nodeAddress,
            n.nodeType,
            n.isActive,
            n.stakedTFuel,
            n.unstakingAmount,
            n.cooldownBlockEnd,
            n.bucket
        );
    }

    /**
     * @notice Permissionless queue processing (bounded)
     * @param maxItems Maximum number of items to process
     * @param keeperAddress Address of the keeper
     * @dev Anyone can call this to process the withdrawal queue
     */
    function processQueue(uint256 maxItems, address keeperAddress) external nonReentrant {
        _updateUnstakingNodes(_uLength());
        _checkAndStakeTFuel();

        uint256 processed;
        uint256 tipsToProcess; // full tips for processed items (deducted from totalTipsOutstandingEstimate)
        while (processed < maxItems && wqHead < wq.length) {
            Req memory r = wq[wqHead];
            if (block.number < r.readyAt) break;

            totalTFuelUserRequestedToRedeem = _saturatingSub(totalTFuelUserRequestedToRedeem, uint256(r.amount));
            tipsToProcess += uint256(r.keeperTip);

            // Assign credits instead of direct payout to prevent queue blocking
            userTFuelCredits[r.user] += r.amount;
            totalTFuelCredits += r.amount;
            emit CreditAssigned(r.user, r.amount, wqHead);
            
            delete wq[wqHead];
            unchecked { wqHead++; }
            if (wqHead >= wq.length) {
                delete wq;        // resets length = 0
                wqHead = 0;
            }
            processed++;
        }

        // Deduct the full processed tips from the running total (even if payout is capped)
        if (tipsToProcess > 0) {
            totalTipsOutstandingEstimate = _saturatingSub(totalTipsOutstandingEstimate, tipsToProcess);

            // The actual tip paid this call is capped by keeperTipMax AND current liquidity.
            uint256 toCredit = tipsToProcess;
            if (toCredit > keeperTipMax) toCredit = keeperTipMax;
            if (toCredit > address(this).balance) toCredit = address(this).balance;

            if (toCredit > 0) {
                // credit keeper tips to keeper
                userTFuelCredits[keeperAddress] += toCredit;
                totalTFuelCredits += toCredit;
                totalKeeperTipsPaid += toCredit;
                emit KeeperCredited(keeperAddress, toCredit, tipsToProcess);
            }
            if (tipsToProcess - toCredit > 0) {
                emit KeeperTipSurplus(tipsToProcess - toCredit);
            }
            lastBalance = address(this).balance;
        }
    }
    
    /**
     * @notice Gets current queue length
     * @return Current number of pending withdrawal requests
     */
    function queueLength() external view returns (uint256) {
        return wq.length - wqHead;
    }

    /**
     * @notice Gets number of unstaked nodes ready for reconciliation
     * @return Number of matured nodes in unstake queue
     */
    function unstakedNodesLength() external view returns (uint256) {
        // Count matured-at-head items without mutating state
        if (_uIsEmpty()) return 0;
        if (nextUnstakeBlock != 0 && block.number < nextUnstakeBlock) return 0;
        uint256 i = _uHead;
        uint256 n = _unstakeQ.length;
        uint256 cnt;
        while (i < n) {
            address a = _unstakeQ[i];
            if (a != address(0)) {
                NodeInfo storage nd = _nodes[a];
                if (nd.cooldownBlockEnd == 0 || block.number < nd.cooldownBlockEnd) break;
                cnt++;
            }
            unchecked { i++; }
        }
        return cnt;
    }

    /**
     * @notice Returns the net assets available to back sTFuel shares
     * @dev Subtracts committed amounts (pending withdrawals, credits, tips) from total managed TFuel
     * @return Net assets backing shares
     */
    function getNetAssetsBackingShares() external view returns (uint256) {
        // Start from requested-to-unstake (cooldown + matured-unreconciled)
        uint256 effectiveUnstaking = tfuelRequestedUnstake;

        // Subtract matured-at-head lots so we don't double count (funds are back in balance)
        if (!_uIsEmpty() && nextUnstakeBlock != 0 && block.number >= nextUnstakeBlock) {
            uint256 i = _uHead;
            uint256 n = _unstakeQ.length;
            while (i < n) {
                address a = _unstakeQ[i];
                if (a != address(0)) {
                    NodeInfo storage nd = _nodes[a];
                    if (nd.cooldownBlockEnd == 0 || block.number < nd.cooldownBlockEnd) break;
                    uint256 amt = nd.unstakingAmount;
                    if (amt > 0) {
                        effectiveUnstaking = effectiveUnstaking >= amt ? (effectiveUnstaking - amt) : 0;
                    }
                }
                unchecked { i++; }
            }
        }

        return address(this).balance + totalStakedTFuel + effectiveUnstaking - getTotalTFuelReserved();
    }

    /**
     * @notice Checks if direct redeem is possible
     * @param amount Amount to redeem
     * @return canRedeem Whether redemption is possible
     * @return availableLiquidity Available liquidity amount
     */
    function canDirectRedeem(uint256 amount) external view returns (bool canRedeem, uint256 availableLiquidity) {
        uint256 liquid = address(this).balance;
        
        availableLiquidity = liquid > getTotalTFuelReserved() ? liquid - getTotalTFuelReserved() : 0;
        canRedeem = availableLiquidity >= amount;
    }

    /**
     * @notice Returns the net assets available to back sTFuel shares with safety checks
     * @dev Uses cached balance when unstaking is in progress to avoid inconsistencies
     * @return netAssets The net assets backing shares
     * @return isExact True if the amount is exact, false if it's an estimate
     */
    function getNetAssetsBackingSharesSafe() external view returns (uint256 netAssets, bool isExact) {
        // bool: true if the amount is exact, false if it is an estimate
        return _getNetAssetsBackingSharesSafe();
    }

    /**
     * @notice Returns the total TFuel amount currently managed by this contract
     * @dev This includes all TFuel: liquid, staked, and in cooldown (regardless of commitments)
     * @return totalManaged The total TFuel amount managed by the contract
     */
    function getTotalTFuelManaged() external view returns (uint256 totalManaged) {
        return address(this).balance + totalStakedTFuel + tfuelRequestedUnstake;
    }

    /**
     * @notice Returns the total TFuel reserved for commitments
     * @return totalReserved The total TFuel amount reserved for commitments
     */
    function getTotalTFuelReserved() public view returns (uint256 totalReserved) {
        return totalTFuelUserRequestedToRedeem + totalTFuelCredits + totalTipsOutstandingEstimate;
    }

    /**
     * @notice Gets count of faulty staked nodes
     * @return Number of faulty staked nodes
     */
    function getFaultyStakedNodesCount() external view returns (uint256) {
        return faultyStakedNodes.length;
    }

    // =============================================================================
    // INTERNAL CORE FUNCTIONS
    // =============================================================================

    /**
     * @notice Internal function to pay TFuel to an address
     * @param to Recipient address
     * @param amount Amount to pay
     */
    function _pay(address to, uint256 amount) internal {
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "TRANSFER_FAIL");
    }

    /**
     * @notice Returns the net assets available to back sTFuel shares with safety checks
     * @dev Uses cached balance when unstaking is in progress to avoid inconsistencies
     * @return netAssets The net assets backing shares
     * @return isExact True if the amount is exact, false if it's an estimate
     * @dev WARNING: For monitoring/UX only. Must NOT be used for pricing in sTFuel; use getNetAssetsBackingShares() instead.
     */
    function _getNetAssetsBackingSharesSafe() internal view returns (uint256 netAssets, bool isExact) {
        if (nextUnstakeBlock != 0 && block.number >= nextUnstakeBlock) {
            return (lastBalance + totalStakedTFuel + tfuelRequestedUnstake - getTotalTFuelReserved(), false);
        }
        return (address(this).balance + totalStakedTFuel + tfuelRequestedUnstake - getTotalTFuelReserved(), true);
    }

    // =============================================================================
    // LIQUIDITY MANAGEMENT (INTERNAL)
    // =============================================================================

    /**
     * @notice Checks and stakes excess TFuel if conditions are met
     * @dev Keeps a small buffer un-staked to satisfy immediate claims
     */
    function _checkAndStakeTFuel() internal {
        if (stakingPaused) return;           // <--- respect pause
        // Keep a small buffer un-staked to satisfy immediate claims
        uint256 liquid = address(this).balance;
        if (liquid < MIN_STAKE_AMOUNT) return;

        // Don't stake funds that are already spoken for by the withdrawal queue (users + tips) and credits
        uint256 reserved = getTotalTFuelReserved();
        if (liquid < reserved + MIN_STAKE_AMOUNT) return;

        uint256 stakeable = liquid - reserved;
        uint256 stakeAmount = (stakeable / MIN_STAKE_AMOUNT) * MIN_STAKE_AMOUNT;
        if (stakeAmount > 0) _stakeTFuel(stakeAmount);
    }

    /**
     * @notice Plans unstaking if needed based on liquidity requirements
     * @dev Uses a pure "matured necessary liquidity" model
     */
    function _planUnstakeIfNeeded() internal {
        // Planner uses a pure "matured necessary liquidity" model.
        // Unstake logic is triggered by callers/keepers when needed in practice.
        // (If you prefer auto-unstake here, make this non-view and call _unstakeTFuel(shortfall).)
            // resources we can count on: liquid now + already in cooldown (will return automatically)
        uint256 resources = address(this).balance + tfuelRequestedUnstake;

        // user-owed pending redemptions (NET ONLY; tips are tracked separately via totalTipsOutstandingEstimate)        
        uint256 desired = getTotalTFuelReserved();
        if (resources >= desired) return; // no action needed

        uint256 deficit = desired - resources;
        // round UP to the node granularity (10k TFuel)
        uint256 target = ((deficit + MIN_STAKE_AMOUNT - 1) / MIN_STAKE_AMOUNT) * MIN_STAKE_AMOUNT;

        // never try to unstake more than what's actually staked
        if (target > totalStakedTFuel) target = totalStakedTFuel;

        if (target > 0) {
            _unstakeTFuel(target);
        }
    }

    // =============================================================================
    // STAKE / UNSTAKE LOGIC (INTERNAL)
    // =============================================================================

    /**
     * @notice Stakes TFuel across available nodes
     * @param amount Amount to stake
     * @dev Respects maxNodesPerStakingCall limit
     */
    function _stakeTFuel(uint256 amount) internal {
        require(!stakingPaused, "STAKING_PAUSED");  // hard gate at the core
        require(amount >= MIN_STAKE_AMOUNT, "MIN_10K");
        require(amount % MIN_STAKE_AMOUNT == 0, "MULT_10K");

        uint256 remaining = amount;
        uint256 nodesProcessed = 0;
        while (remaining > 0 && nodesProcessed < maxNodesPerStakingCall) {
            address nodeAddress = _popBestEmptyNode(remaining);
            if (nodeAddress == address(0)) break;

            NodeInfo storage node = _nodes[nodeAddress];
            uint256 cap = _capacityFor(node.nodeType);
            uint256 room = cap - node.stakedTFuel;
            if (room == 0) continue;

            uint256 add = remaining < room ? remaining : room;

            bool wasZero = (node.stakedTFuel == 0);
            node.stakedTFuel += add;
            totalStakedTFuel += add;
            if (wasZero) usedNodes++;

            if (node.stakedTFuel == cap) {
                _pushFull(nodeAddress, node.nodeType);
            } else {
                _pushHalfFull(nodeAddress);
            }

            remaining -= add;
            nodesProcessed++;

            bool success = stakeTFuelToEEN(node.eenSummary, add);
            if (!success) {
                revert StakingFailed(nodeAddress, add);
            }
            emit TFuelStaked(nodeAddress, add);
        }
        lastBalance = address(this).balance;
    }

    /**
     * @notice Unstakes TFuel from nodes
     * @param amount Amount to unstake
     */
    function _unstakeTFuel(uint256 amount) internal {
        require(amount <= totalStakedTFuel, "INSUF_STAKED");
        uint256 remaining = amount;

        // pop best lots until target is met
        while (remaining > 0) {
            address nodeAddress = _popBestFullNode(remaining);
            if (nodeAddress == address(0)) break;

            uint256 lot = _unstake(nodeAddress);
            remaining = remaining > lot ? (remaining - lot) : 0;
        }
    }

    /**
     * @notice Unstakes a specific node
     * @param nodeAddress Address of the node to unstake
     * @return lot Amount unstaked
     */
    function _unstake(address nodeAddress) internal returns (uint256 lot) {
        NodeInfo storage node = _nodes[nodeAddress];
        lot = node.stakedTFuel;
        if (lot == 0) return 0;

        node.unstakingAmount = lot;
        node.stakedTFuel = 0;
        node.cooldownBlockEnd = uint64(block.number + COOLDOWN_PERIOD);
        node.bucket = Bucket.Unstake; // Mark node as in unstaking state

        tfuelRequestedUnstake += lot;
        totalStakedTFuel = _saturatingSub(totalStakedTFuel, lot);
        if (usedNodes > 0) usedNodes--;

        // enqueue in unstake FIFO
        _uEnqueue(nodeAddress);
        if (_uLength() == 1) {
            nextUnstakeBlock = node.cooldownBlockEnd;
        }

        bool success = unstakeTFuelFromEEN(nodeAddress);
        require(success, "UNSTAKE_FAILED");

        emit TFuelUnstaked(nodeAddress, lot);
    }

    /**
     * @notice Admin unstake function with faulty node handling
     * @param nodeAddress Address of the node to unstake
     */
    function _unstakeAdmin(address nodeAddress) internal {
        NodeInfo storage node = _nodes[nodeAddress];
        uint256 lot = node.stakedTFuel;
        if (lot == 0) return;
        
        // Attempt unstake
        bool success = unstakeTFuelFromEEN(nodeAddress);
        
        if (success) {
            // Normal unstake flow
            node.unstakingAmount = lot;
            node.stakedTFuel = 0;
            node.cooldownBlockEnd = uint64(block.number + COOLDOWN_PERIOD);
            node.bucket = Bucket.Unstake;

            tfuelRequestedUnstake += lot;
            totalStakedTFuel = _saturatingSub(totalStakedTFuel, lot);
            if (usedNodes > 0) usedNodes--;

            // enqueue in unstake FIFO
            _uEnqueue(nodeAddress);
            if (_uLength() == 1) {
                nextUnstakeBlock = node.cooldownBlockEnd;
            }

            emit TFuelUnstaked(nodeAddress, lot);
        } else if (!isFaultyStakedNode[nodeAddress]) {
            // Failed unstake - move to faulty tracking
            _addFaulty(nodeAddress);
            // Keep totalStakedTFuel unchanged - funds still on-chain
            // Keep stakedTFuel in node struct for tracking
            emit NodeMarkedAsFaulty(nodeAddress, lot);
        }
    }

    /**
     * @notice Updates matured unstaking nodes (bounded by maxNodes)
     * @param maxNodes Maximum number of nodes to update
     */
    function _updateUnstakingNodes(uint256 maxNodes) internal {
        if (_uIsEmpty()) { nextUnstakeBlock = 0; return; }
        if (nextUnstakeBlock != 0 && block.number < nextUnstakeBlock) return;

        uint256 processed;
        while (processed < maxNodes && !_uIsEmpty()) {
            (address a, bool ok) = _uPeek();
            if (!ok) { nextUnstakeBlock = 0; break; }

            NodeInfo storage node = _nodes[a];
            if (block.number < node.cooldownBlockEnd) {
                nextUnstakeBlock = node.cooldownBlockEnd;
                break;
            }

            uint256 lot = node.unstakingAmount;
            if (lot > 0) {
                // funds already auto-returned
                tfuelRequestedUnstake = _saturatingSub(tfuelRequestedUnstake, lot);
                node.unstakingAmount = 0;
            }
            node.cooldownBlockEnd = 0;
            _uDequeue();
            _clearBucketTracking(a);

            if (node.isActive) {
                _pushEmpty(a, node.nodeType);
            }
            processed++;
        }

        if (!_uIsEmpty()) {
            (address b, ) = _uPeek();
            nextUnstakeBlock = _nodes[b].cooldownBlockEnd;
        } else {
            nextUnstakeBlock = 0;
        }
    }

    // =============================================================================
    // UNSTAKE FIFO OPERATIONS (INTERNAL)
    // =============================================================================

    /**
     * @notice Checks if unstake queue is empty
     * @return True if queue is empty
     */
    function _uIsEmpty() internal view returns (bool) {
        return _uHead >= _unstakeQ.length;
    }

    /**
     * @notice Gets length of unstake queue
     * @return Number of items in queue
     */
    function _uLength() internal view returns (uint256) {
        return _unstakeQ.length - _uHead;
    }

    /**
     * @notice Peeks at the head of unstake queue
     * @return node Address of head node
     * @return ok Whether peek was successful
     */
    function _uPeek() internal view returns (address node, bool ok) {
        if (_uIsEmpty()) return (address(0), false);
        return (_unstakeQ[_uHead], true);
    }

    /**
     * @notice Enqueues a node in unstake queue
     * @param node Address of node to enqueue
     */
    function _uEnqueue(address node) internal {
        _unstakeQ.push(node);
        _isInUnstakeQ[node] = true;
    }

    /**
     * @notice Dequeues a node from unstake queue
     * @return node Address of dequeued node
     * @return ok Whether dequeue was successful
     */
    function _uDequeue() internal returns (address node, bool ok) {
        if (_uIsEmpty()) return (address(0), false);

        node = _unstakeQ[_uHead];
        _unstakeQ[_uHead] = address(0);
        unchecked { _uHead++; }
        _isInUnstakeQ[node] = false;

        // Optional cleanup when empty (cheap)
        if (_uIsEmpty()) {
            _uHead = 0;
            _unstakeQ = new address[](0);
        }
        return (node, true);
    }

    // =============================================================================
    // BUCKET MANAGEMENT (INTERNAL)
    // =============================================================================

    /**
     * @notice Gets the appropriate bucket array for a node type and bucket
     * @param nodeType Type of the node
     * @param bucket Bucket state
     * @return storage Reference to the bucket array
     */
    function _getBucketArray(NodeType nodeType, Bucket bucket) 
        internal view returns (address[] storage) 
    {
        if (bucket == Bucket.Empty) {
            if (nodeType == NodeType.Tenk) return tenkNodesEmpty;
            if (nodeType == NodeType.Fiftyk) return fiftykNodesEmpty;
            if (nodeType == NodeType.Hundredk) return hundredkNodesEmpty;
            if (nodeType == NodeType.TwoHundredk) return twoHundredkNodesEmpty;
            if (nodeType == NodeType.FiveHundredk) return fiveHundredkNodesEmpty;
        } else if (bucket == Bucket.Half) {
            return halfFullNodes;
        } else if (bucket == Bucket.Full) {
            if (nodeType == NodeType.Tenk) return tenkNodesFull;
            if (nodeType == NodeType.Fiftyk) return fiftykNodesFull;
            if (nodeType == NodeType.Hundredk) return hundredkNodesFull;
            if (nodeType == NodeType.TwoHundredk) return twoHundredkNodesFull;
            if (nodeType == NodeType.FiveHundredk) return fiveHundredkNodesFull;
        } else if (bucket == Bucket.Unstake) {
            // Nodes in unstaking state are tracked in _unstakeQ, not in a separate array
            // This should not be called for Unstake bucket as it's handled differently
            revert("UNSTAKE_BUCKET_NOT_ARRAY");
        }
        revert("INVALID_BUCKET_TYPE");
    }

    /**
     * @notice Clears bucket tracking for a node
     * @param node Address of the node
     */
    function _clearBucketTracking(address node) internal {
        // For Unstake bucket, indexInBucket is not used since nodes are tracked in _unstakeQ
        // Only clear indexInBucket for nodes that were in bucket arrays
        if (_nodes[node].bucket != Bucket.Unstake) {
            indexInBucket[node] = 0;
        }
        _nodes[node].bucket = Bucket.None;
    }

    /**
     * @notice Gets capacity for a node type
     * @param t Node type
     * @return Capacity in TFuel
     */
    function _capacityFor(NodeType t) internal pure returns (uint256) {
        if (t == NodeType.Tenk) return 10_000 ether;
        if (t == NodeType.Fiftyk) return 50_000 ether;
        if (t == NodeType.Hundredk) return 100_000 ether;
        if (t == NodeType.TwoHundredk) return 200_000 ether;
        if (t == NodeType.FiveHundredk) return 500_000 ether;
        revert("BAD_TYPE");
    }

    /**
     * @notice Pops empty node preferring smaller capacity
     * @return Address of popped node
     */
    function _popEmptyPreferSmall() internal returns (address) {
        if (tenkNodesEmpty.length > 0) { address a=tenkNodesEmpty[tenkNodesEmpty.length-1]; tenkNodesEmpty.pop(); _clearBucketTracking(a); return a; }
        if (fiftykNodesEmpty.length > 0) { address a=fiftykNodesEmpty[fiftykNodesEmpty.length-1]; fiftykNodesEmpty.pop(); _clearBucketTracking(a); return a; }
        if (hundredkNodesEmpty.length > 0) { address a=hundredkNodesEmpty[hundredkNodesEmpty.length-1]; hundredkNodesEmpty.pop(); _clearBucketTracking(a); return a; }
        if (twoHundredkNodesEmpty.length > 0) { address a=twoHundredkNodesEmpty[twoHundredkNodesEmpty.length-1]; twoHundredkNodesEmpty.pop(); _clearBucketTracking(a); return a; }
        if (fiveHundredkNodesEmpty.length > 0) { address a=fiveHundredkNodesEmpty[fiveHundredkNodesEmpty.length-1]; fiveHundredkNodesEmpty.pop(); _clearBucketTracking(a); return a; }
        return address(0);
    }

    /**
     * @notice Pops best empty node for given remaining amount
     * @param remaining Amount remaining to stake
     * @return Address of best node
     */
    function _popBestEmptyNode(uint256 remaining) internal returns (address) {
        if (halfFullNodes.length > 0) { address a=halfFullNodes[halfFullNodes.length-1]; halfFullNodes.pop(); _clearBucketTracking(a); return a; }
        if (remaining >= 500_000 ether && fiveHundredkNodesEmpty.length > 0) { address a=fiveHundredkNodesEmpty[fiveHundredkNodesEmpty.length-1]; fiveHundredkNodesEmpty.pop(); _clearBucketTracking(a); return a; }
        if (remaining >= 200_000 ether && twoHundredkNodesEmpty.length > 0) { address a=twoHundredkNodesEmpty[twoHundredkNodesEmpty.length-1]; twoHundredkNodesEmpty.pop(); _clearBucketTracking(a); return a; }
        if (remaining >= 100_000 ether && hundredkNodesEmpty.length > 0) { address a=hundredkNodesEmpty[hundredkNodesEmpty.length-1]; hundredkNodesEmpty.pop(); _clearBucketTracking(a); return a; }
        if (remaining >= 50_000 ether && fiftykNodesEmpty.length > 0) { address a=fiftykNodesEmpty[fiftykNodesEmpty.length-1]; fiftykNodesEmpty.pop(); _clearBucketTracking(a); return a; }
        if (remaining >= 10_000 ether && tenkNodesEmpty.length > 0) { address a=tenkNodesEmpty[tenkNodesEmpty.length-1]; tenkNodesEmpty.pop(); _clearBucketTracking(a); return a; }
        return _popEmptyPreferSmall();
    }

    /**
     * @notice Pops best full node for given amount
     * @param amount Amount to unstake
     * @return Address of best node
     */
    function _popBestFullNode(uint256 amount) internal returns (address) {
        if (amount <= 10_000 ether && tenkNodesFull.length > 0) { address a=tenkNodesFull[tenkNodesFull.length-1]; tenkNodesFull.pop(); _clearBucketTracking(a); return a; }
        if (amount <= 50_000 ether && fiftykNodesFull.length > 0) { address a=fiftykNodesFull[fiftykNodesFull.length-1]; fiftykNodesFull.pop(); _clearBucketTracking(a); return a; }
        if (amount <= 100_000 ether && hundredkNodesFull.length > 0) { address a=hundredkNodesFull[hundredkNodesFull.length-1]; hundredkNodesFull.pop(); _clearBucketTracking(a); return a; }
        if (amount <= 200_000 ether && twoHundredkNodesFull.length > 0) { address a=twoHundredkNodesFull[twoHundredkNodesFull.length-1]; twoHundredkNodesFull.pop(); _clearBucketTracking(a); return a; }
        if (amount <= 500_000 ether && fiveHundredkNodesFull.length > 0) { address a=fiveHundredkNodesFull[fiveHundredkNodesFull.length-1]; fiveHundredkNodesFull.pop(); _clearBucketTracking(a); return a; }
        if (halfFullNodes.length > 0) { address a=halfFullNodes[halfFullNodes.length-1]; halfFullNodes.pop(); _clearBucketTracking(a); return a; }
        // fallback larger to smaller
        if (fiveHundredkNodesFull.length > 0) { address a=fiveHundredkNodesFull[fiveHundredkNodesFull.length-1]; fiveHundredkNodesFull.pop(); _clearBucketTracking(a); return a; }
        if (twoHundredkNodesFull.length > 0) { address a=twoHundredkNodesFull[twoHundredkNodesFull.length-1]; twoHundredkNodesFull.pop(); _clearBucketTracking(a); return a; }
        if (hundredkNodesFull.length > 0) { address a=hundredkNodesFull[hundredkNodesFull.length-1]; hundredkNodesFull.pop(); _clearBucketTracking(a); return a; }
        if (fiftykNodesFull.length > 0) { address a=fiftykNodesFull[fiftykNodesFull.length-1]; fiftykNodesFull.pop(); _clearBucketTracking(a); return a; }
        if (tenkNodesFull.length > 0) { address a=tenkNodesFull[tenkNodesFull.length-1]; tenkNodesFull.pop(); _clearBucketTracking(a); return a; }
        return address(0);
    }

    /**
     * @notice Pushes node to empty bucket
     * @param node Address of the node
     * @param t Node type
     */
    function _pushEmpty(address node, NodeType t) internal {
        require(indexInBucket[node] == 0 && _nodes[node].bucket == Bucket.None, "NODE_ALREADY_IN_BUCKET");
        if (t == NodeType.Tenk) {
            indexInBucket[node] = tenkNodesEmpty.length;
            tenkNodesEmpty.push(node);
        } else if (t == NodeType.Fiftyk) {
            indexInBucket[node] = fiftykNodesEmpty.length;
            fiftykNodesEmpty.push(node);
        } else if (t == NodeType.Hundredk) {
            indexInBucket[node] = hundredkNodesEmpty.length;
            hundredkNodesEmpty.push(node);
        } else if (t == NodeType.TwoHundredk) {
            indexInBucket[node] = twoHundredkNodesEmpty.length;
            twoHundredkNodesEmpty.push(node);
        } else if (t == NodeType.FiveHundredk) {
            indexInBucket[node] = fiveHundredkNodesEmpty.length;
            fiveHundredkNodesEmpty.push(node);
        }
        _nodes[node].bucket = Bucket.Empty;
    }

    /**
     * @notice Pushes node to half-full bucket
     * @param node Address of the node
     */
    function _pushHalfFull(address node) internal {
        require(indexInBucket[node] == 0 && _nodes[node].bucket == Bucket.None, "NODE_ALREADY_IN_BUCKET");
        indexInBucket[node] = halfFullNodes.length;
        halfFullNodes.push(node);
        _nodes[node].bucket = Bucket.Half;
    }

    /**
     * @notice Pushes node to full bucket
     * @param node Address of the node
     * @param t Node type
     */
    function _pushFull(address node, NodeType t) internal {
        require(indexInBucket[node] == 0 && _nodes[node].bucket == Bucket.None, "NODE_ALREADY_IN_BUCKET");
        if (t == NodeType.Tenk) {
            indexInBucket[node] = tenkNodesFull.length;
            tenkNodesFull.push(node);
        } else if (t == NodeType.Fiftyk) {
            indexInBucket[node] = fiftykNodesFull.length;
            fiftykNodesFull.push(node);
        } else if (t == NodeType.Hundredk) {
            indexInBucket[node] = hundredkNodesFull.length;
            hundredkNodesFull.push(node);
        } else if (t == NodeType.TwoHundredk) {
            indexInBucket[node] = twoHundredkNodesFull.length;
            twoHundredkNodesFull.push(node);
        } else if (t == NodeType.FiveHundredk) {
            indexInBucket[node] = fiveHundredkNodesFull.length;
            fiveHundredkNodesFull.push(node);
        }
        _nodes[node].bucket = Bucket.Full;
    }

    /**
     * @notice Removes node from its current bucket
     * @param node Address of the node
     */
    function _removeFromBucket(address node) internal {
        NodeInfo storage info = _nodes[node];
        if (info.bucket == Bucket.None) return;
        
        address[] storage arr = _getBucketArray(info.nodeType, info.bucket);
        uint256 idx = indexInBucket[node];
        uint256 last = arr.length - 1;
        require(idx <= last, "IDX_OOB");

        // Swap with last element
        address lastNode = arr[last];
        // Update swapped element's index
        if (idx != last) {
            arr[idx] = lastNode;
            indexInBucket[lastNode] = idx;
        }
        arr.pop();
        _clearBucketTracking(node);
    }

    // =============================================================================
    // UTILITY FUNCTIONS (INTERNAL)
    // =============================================================================

    /**
     * @notice Safe subtraction that doesn't underflow
     * @param a First number
     * @param b Second number
     * @return Result of subtraction or 0 if underflow
     */
    function _saturatingSub(uint256 a, uint256 b) internal pure returns (uint256) {
        return a >= b ? a - b : 0;
    }

    /**
     * @notice Returns minimum of two numbers
     * @param a First number
     * @param b Second number
     * @return Minimum value
     */
    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    // =============================================================================
    // FAULTY NODE MANAGEMENT (INTERNAL)
    // =============================================================================

    /**
     * @notice Adds node to faulty tracking
     * @param node Address of the faulty node
     */
    function _addFaulty(address node) internal {
        if (!isFaultyStakedNode[node]) {
            faultyStakedNodes.push(node);
            faultyIndex[node] = faultyStakedNodes.length; // 1-based
            isFaultyStakedNode[node] = true;
        }
    }

    /**
     * @notice Removes node from faulty array
     * @param node Address of the node
     */
    function _removeFromFaultyArray(address node) internal {
        uint256 idx = faultyIndex[node];
        if (idx == 0) return;
        uint256 last = faultyStakedNodes.length;
        if (idx != last) {
            address lastNode = faultyStakedNodes[last - 1];
            faultyStakedNodes[idx - 1] = lastNode;
            faultyIndex[lastNode] = idx;
        }
        faultyStakedNodes.pop();
        faultyIndex[node] = 0;
        isFaultyStakedNode[node] = false;
    }

    // =============================================================================
    // EEN VALIDATION (INTERNAL)
    // =============================================================================

    /**
     * @notice Validates EEN summary format and address
     * @param summary 261-byte EEN holder summary
     * @param expected Expected node address
     * @return res True if validation passes
     */
 function validate(bytes calldata summary, address expected)
        internal
        pure
        returns (bool res)
    {
        // Elite Edge Node summaries are 261 bytes long (524 hex chars incl. "0x").
        if (summary.length != 261) {
            revert InvalidLength(summary.length);
        }

        // Extract the first 20 bytes as address
        address parsedAddr = _addr20At(summary, 0);

        // Compare
        if (parsedAddr != expected) {
            revert AddressMismatch(parsedAddr, expected);
        }

        return true;
    }

    /**
     * @notice Extracts 20-byte address from calldata at given offset
     * @param data Calldata to extract from
     * @param start Starting offset
     * @return a Extracted address
     */
    function _addr20At(bytes calldata data, uint256 start)
        private
        pure
        returns (address a)
    {
        require(start + 20 <= data.length, "Out of range");
        assembly {
            a := shr(96, calldataload(add(data.offset, start)))
        }
    }

    // =============================================================================
    // REAL TFUEL STAKING FUNCTIONS (INTERNAL)
    // =============================================================================
    /// @dev IMPORTANT: On Theta this is a native system contract for EEN staking.
    ///      On any non-Theta chain this call is unsafe and MUST NOT be used.

    /**
     * @notice Stakes TFuel to an Elite Edge Node
     * @param eenSummary EEN summary data
     * @param amount Amount to stake
     * @return success Whether staking was successful
     */
    function stakeTFuelToEEN(
        bytes memory eenSummary,
        uint256 amount
    ) internal returns (bool) {
        bytes memory data = abi.encodePacked(eenSummary, amount);
        uint256 balanceBefore = address(this).balance;
        (bool success, ) = address(0xce).call(data);
        // Verify post-call balance change is within expected bounds
        require(balanceBefore - address(this).balance <= amount, "TFUEL_DRAIN_TOO_HIGH");
        return success;
    }

    /**
     * @notice Unstakes TFuel from an Elite Edge Node
     * @param eenAddr Address of the EEN
     * @return success Whether unstaking was successful
     */
    function unstakeTFuelFromEEN(
        address eenAddr
    ) internal returns (bool) {
        bytes memory data = abi.encodePacked(eenAddr);
        uint256 balanceBefore = address(this).balance;
        (bool success, ) = address(0xcf).call(data);
        // Verify post-call balance didn't change
        require(balanceBefore == address(this).balance, "TFUEL_DRAINED");
        return success;
    }
}