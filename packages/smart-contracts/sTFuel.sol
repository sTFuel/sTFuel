// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title sTFuel
 * @notice ERC20 share token representing TFuel staked through Elite Edge Nodes
 * @dev This contract implements a tokenized staking mechanism where:
 *      - Users mint sTFuel shares by depositing TFuel (with a mint fee)
 *      - Users burn sTFuel shares to redeem TFuel (with a withdrawal queue or direct redemption)
 *      - Price Per Share (PPS) increases as fees accumulate and rewards are earned
 *      - Initial rate: 1 TFuel = 10 sTFuel (PPS = 0.1 TFuel/share)
 * 
 * Key Mechanisms:
 * - Mint fee (0.1%..1%) stays un-minted => increases PPS for all holders
 * - Withdrawal requests are queued in NodeManager with cooldown periods
 * - Direct redemption available with higher fee (2%) if liquidity permits
 * - Referral system allows NFT holders to earn rewards from referrals
 * 
 * Security Features:
 * - ReentrancyGuard on all state-changing functions
 * - Pausable for emergency stops (only minting can be paused)
 * - AccessControl for admin functions
 */
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface INodeManager {
    function depositTFuel() external payable;
    function requestWithdrawal(address user, uint256 tfuelAmount) external returns (uint256 index, uint256 readyAt, uint256 tip);
    function claimHeadIfReady(address user) external returns (bool paid, uint256 amountPaid, uint256 index);
    function withdrawCredits(address to) external returns (uint256 amount);
    function processQueue(uint256 maxItems, address keeperAddress) external;
    function getNetAssetsBackingShares() external view returns (uint256);
    function getNetAssetsBackingSharesSafe() external view returns (uint256 netAssets, bool isExact);
    function getTotalTFuelManaged() external view returns (uint256 totalManaged);
    function canDirectRedeem(uint256 amount) external view returns (bool canRedeem, uint256 availableLiquidity);
    function directRedeem(address user, uint256 amount) external;
    function userTFuelCredits(address user) external view returns (uint256);
    function moreThanMaxNodesUnstaked(uint256 maxNodes) external view returns (bool);
    function updateUnstakingNodes(uint256 maxNodes) external;
}

interface ITNT721 {
    function ownerOf(uint256 tokenId) external view returns (address);
}

contract sTFuel is ERC20, ERC20Burnable, AccessControl, ReentrancyGuard, Pausable {
    /// @notice Role identifier for contract managers
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    /// @notice Reference to NodeManager contract handling staking/unstaking
    /// @dev Must be set via setNodeManager() after deployment (one-time setup)
    INodeManager public nodeManager;

    /// @notice Mint fee in basis points (100 = 1%)
    /// @dev Configurable between MINT_FEE_MIN_BPS (0.1%) and MINT_FEE_MAX_BPS (1%)
    uint16 public mintFeeBps = 100; // default 1% (100 bps)
    /// @notice Minimum mint fee: 0.1% (10 bps)
    uint16 public constant MINT_FEE_MIN_BPS = 10;   // 0.1%
    /// @notice Maximum mint fee: 1% (100 bps)
    uint16 public constant MINT_FEE_MAX_BPS = 100;  // 1%
    
    /// @notice Direct redeem fee in basis points (200 = 2%)
    /// @dev Higher fee for immediate redemption vs queue withdrawal
    uint16 public directRedeemFeeBps = 200; // default 2% (200 bps)
    /// @notice Minimum direct redeem fee: 0.1% (10 bps)
    uint16 public constant DIRECT_REDEEM_FEE_MIN_BPS = 10;   // 0.1%
    /// @notice Maximum direct redeem fee: 5% (500 bps)
    uint16 public constant DIRECT_REDEEM_FEE_MAX_BPS = 500;  // 5%
    
    /// @notice Precision constant for PPS calculations (1e18)
    uint256 private constant ONE = 1e18;

    /// @notice Maximum number of nodes that could be unstaked -> Revert
    uint256 public MAX_NUMBER_OF_NODES_UNSTAKED = 50;
    
    /// @notice Maps referral NFT token ID to referrer wallet address
    /// @dev Set by NFT holders to receive referral rewards
    mapping(uint256 => address) public referralIdToAddress;
    
    /// @notice Address of the referral NFT contract (TNT721)
    /// @dev Used to verify NFT ownership when setting referral addresses
    address public ReferralNFTAddress;

    event Minted(address indexed user, uint256 tfuelIn, uint256 sharesOut, uint256 feeTFuel);
    event BurnQueued(address indexed user, uint256 sharesBurned, uint256 netTFuelOut, uint256 readyAt, uint256 tip, uint256 index);
    event Claimed(address indexed user, uint256 amount, uint256 index);
    event CreditsClaimed(address indexed user, uint256 amount);
    event MintFeeUpdated(uint16 feeBps);
    event ReferralAddressSet(uint256 indexed referralId, address indexed referralAddress);
    event ReferralRewarded(address indexed referrer, uint256 rewardShares, uint256 fromReferralId);
    event DirectRedeemFeeUpdated(uint16 feeBps);
    event BurnAndDirectRedeemed(address indexed user, uint256 sharesBurned, uint256 tfuelAmount, uint256 fee);



    /**
     * @notice Initializes the sTFuel contract
     * @param defaultAdmin Address that will receive DEFAULT_ADMIN_ROLE
     * @param manager Address that will receive MANAGER_ROLE (can set fees, pause, etc.)
     * @param _ReferralNFTAddress Address of the TNT721 NFT contract for referrals
     * @dev nodeManager must be set separately via setNodeManager() after deployment
     */
    constructor(
        address defaultAdmin,
        address manager,
        address _ReferralNFTAddress
    ) ERC20("Smart TFuel", "sTFUEL") {
        require(defaultAdmin != address(0), "ADMIN_ZERO");
        require(manager != address(0), "MANAGER_ZERO");
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MANAGER_ROLE, manager);
        ReferralNFTAddress = _ReferralNFTAddress;
    }

    // =============================================================================
    // ADMIN FUNCTIONS
    // =============================================================================

    /**
     * @notice Sets the NodeManager contract address (one-time operation)
     * @param _nodeManager Address of the deployed NodeManager contract
     * @dev This can only be called once. After setting, nodeManager becomes immutable.
     *      All mint/burn operations require nodeManager to be set.
     */
    function setNodeManager(address _nodeManager) external onlyRole(MANAGER_ROLE) {
        require(_nodeManager != address(0), "NM_ZERO");
        require(address(nodeManager) == address(0), "NM_ALREADY_SET");
        nodeManager = INodeManager(_nodeManager);
    }

    /**
     * @notice Updates the mint fee percentage
     * @param bps Fee in basis points (must be between MINT_FEE_MIN_BPS and MINT_FEE_MAX_BPS)
     * @dev Changing fee affects all future mints. Existing holders benefit from fee accumulation.
     */
    function setMintFeeBps(uint16 bps) external onlyRole(MANAGER_ROLE) {
        require(bps >= MINT_FEE_MIN_BPS && bps <= MINT_FEE_MAX_BPS, "FEE_OUT_OF_RANGE");
        mintFeeBps = bps;
        emit MintFeeUpdated(bps);
    }

    /**
     * @notice Updates the direct redeem fee percentage
     * @param bps Fee in basis points (must be between DIRECT_REDEEM_FEE_MIN_BPS and DIRECT_REDEEM_FEE_MAX_BPS)
     * @dev Higher fee compensates for immediate liquidity provision vs queue withdrawal
     */
    function setDirectRedeemFeeBps(uint16 bps) external onlyRole(MANAGER_ROLE) {
        require(bps >= DIRECT_REDEEM_FEE_MIN_BPS && bps <= DIRECT_REDEEM_FEE_MAX_BPS, "FEE_OUT_OF_RANGE");
        directRedeemFeeBps = bps;
        emit DirectRedeemFeeUpdated(bps);
    }

    /**
     * @notice Sets referral wallet address for a given NFT token ID
     * @param tokenId NFT token ID that must be owned by caller
     * @param wallet Wallet address to receive referral rewards
     * @dev Only the current owner of the NFT can set the referral address
     */
    function setReferralIdToAddress(uint tokenId, address wallet) public {
        require(ReferralNFTAddress != address(0), "REFERRAL_NFT_NOT_SET");
        require(ITNT721(ReferralNFTAddress).ownerOf(tokenId) == msg.sender, "Not holding NFT");
        referralIdToAddress[tokenId] = wallet;
        emit ReferralAddressSet(tokenId, wallet);
    }

    /**
     * @notice Updates the referral NFT contract address
     * @param _ReferralNFTAddress Address of the new TNT721 contract
     * @dev Allows migration to a new NFT contract if needed
     */
    function setReferralNFTAddress(address _ReferralNFTAddress) public onlyRole(MANAGER_ROLE) {
        ReferralNFTAddress = _ReferralNFTAddress;
    }

    /**
     * @notice Set Max Number of Nodes Unstaked
     * @param _maxNumberOfNodesUnstaked Maximum number of nodes that could be unstaked
     * @dev This is the maximum number of nodes that could be unstaked
     */
    function setMaxNumberOfNodesUnstaked(uint256 _maxNumberOfNodesUnstaked) public onlyRole(MANAGER_ROLE) {
        MAX_NUMBER_OF_NODES_UNSTAKED = _maxNumberOfNodesUnstaked;
    }

    /**
     * @notice Pauses all mint operations
     * @dev Does not affect burns or withdrawals - allows users to exit but prevents new deposits
     */
    function pause() external onlyRole(MANAGER_ROLE) { _pause(); }
    
    /**
     * @notice Unpauses mint operations
     */
    function unpause() external onlyRole(MANAGER_ROLE) { _unpause(); }

    // =============================================================================
    // PRICE PER SHARE (PPS) CALCULATIONS
    // =============================================================================

    /**
     * @notice Calculates the current Price Per Share (PPS) in TFuel
     * @return Price per share scaled by 1e18 (e.g., 0.1e18 = 0.1 TFuel per share)
     * @dev PPS = totalNetAssets / totalSupply
     *      - Bootstrap value: 0.1e18 (1 TFuel = 10 sTFuel) when supply is zero
     *      - Increases as fees accumulate (unminted fee shares increase PPS)
     *      - Increases as staking rewards accrue
     */
    function pps() public view returns (uint256) {
        uint256 ts = totalSupply();
        if (ts == 0) return 0.1e18; // bootstrap: 1 TFuel = 10 sTFuel
        uint256 netAssets = nodeManager.getNetAssetsBackingShares();
        return (netAssets * ONE) / ts;
    }

    /**
     * @notice Calculates the current Price Per Share (PPS) in TFuel (with safe AssetsBackingShares function)
     * @return Price per share scaled by 1e18 (e.g., 0.1e18 = 0.1 TFuel per share)
     * @dev PPS = totalNetAssets / totalSupply
     *      - Bootstrap value: 0.1e18 (1 TFuel = 10 sTFuel) when supply is zero
     *      - Increases as fees accumulate (unminted fee shares increase PPS)
     *      - Increases as staking rewards accrue
     *      -> *Important*: this function only returns accurate values if all unstaked nodes have been processed
     */
    function ppsSafe() public view returns (uint256) {
        uint256 ts = totalSupply();
        if (ts == 0) return (0.1e18); // bootstrap: 1 TFuel = 10 sTFuel
        (uint256 netAssets, ) = nodeManager.getNetAssetsBackingSharesSafe();
        return ((netAssets * ONE) / ts);
    }

    /**
     * @notice Calculates how many shares to mint for a given TFuel amount
     * @param tfuel Amount of TFuel being deposited
     * @return Number of shares that will be minted
     * @dev Formula: shares = tfuel / pps.
     *      Result is always rounded down (truncation), which slightly favors the protocol.
     */
    function _sharesForTFuel(uint256 tfuel) internal view returns (uint256) {
        uint256 _pps = pps();
        return (tfuel * ONE) / _pps;
    }

    /**
     * @notice Calculates how much TFuel a given number of shares represents
     * @param shares Number of shares being redeemed
     * @return Amount of TFuel owed for these shares
     * @dev Formula: tfuel = shares * pps
     * @custom:precision Division may truncate, slightly favoring the protocol
     */
    function _tfuelForShares(uint256 shares) internal view returns (uint256) {
        // tfuel = shares * pps
        uint256 _pps = pps();
        return (shares * _pps) / ONE;
    }

    // =============================================================================
    // MINT FUNCTIONS (Deposit TFuel -> Receive sTFuel Shares)
    // =============================================================================

    /**
     * @notice Mints sTFuel shares by depositing TFuel
     * @dev Process:
     *      1. Calculate shares for deposited TFuel
     *      2. Calculate mint fee (deducted from shares, not TFuel)
     *      3. Mint net shares to user (fee shares stay un-minted)
     *      4. Deposit TFuel to NodeManager for staking
     * 
     * The unminted fee shares increase PPS for all holders.
     */
    function mint() external payable whenNotPaused nonReentrant {
        require(msg.value > 0, "NO_TFUEL");

        INodeManager nm = nodeManager;

        require(!nm.moreThanMaxNodesUnstaked(MAX_NUMBER_OF_NODES_UNSTAKED), "HEALING_REQUIRED");

        uint256 feeTFuel = 0;
        if (totalSupply() > 0) {
            feeTFuel = (msg.value * mintFeeBps) / 10_000;
        }
        uint256 netShares = _sharesForTFuel(msg.value - feeTFuel);

        nm.depositTFuel{value: msg.value}();
        _mint(msg.sender, netShares);

        emit Minted(msg.sender, msg.value, netShares, feeTFuel);
    }

    /**
     * @notice Mints sTFuel shares with referral rewards
     * @param referralId NFT token ID of the referrer
     * @dev Similar to mint() but:
     *      - 20% of fee shares go to referrer (feeShares / 5)
     *      - Remaining 80% stay un-minted (increase PPS)
     *      - Referrer must have set their wallet via setReferralIdToAddress()
     */
    function mintWithReferral(uint referralId) public payable whenNotPaused nonReentrant {
        address referrer = referralIdToAddress[referralId];
        require(referrer != address(0), "ZERO_REFERRAL_ADDRESS");
        require(referrer != msg.sender, "SELF_REFERRAL");
        require(msg.value > 0, "NO_TFUEL");

        INodeManager nm = nodeManager;

        require(!nm.moreThanMaxNodesUnstaked(MAX_NUMBER_OF_NODES_UNSTAKED), "HEALING_REQUIRED");

        uint256 feeTFuel = (msg.value * mintFeeBps) / 10_000;
        uint256 netShares = _sharesForTFuel(msg.value - feeTFuel);

        nodeManager.depositTFuel{value: msg.value}();
        _mint(msg.sender, netShares);

        uint referralReward = feeTFuel / 5; // 20% of fee shares
        uint256 referralShares = _sharesForTFuel(referralReward);
        unchecked {
            feeTFuel -= referralReward;
        }

        require(referralShares > 0, "REFERRAL_SHARE_ZERO");

        emit Minted(msg.sender, msg.value, netShares, feeTFuel);

        // Mint referral reward to referrer
        _mint(referrer, referralShares);

        emit ReferralRewarded(referrer, referralShares, referralId);
    }

    // =============================================================================
    // BURN FUNCTIONS (Burn sTFuel -> Queue TFuel Withdrawal)
    // =============================================================================

    /**
     * @notice Burns sTFuel shares and queues TFuel withdrawal request
     * @param amount Number of shares to burn
     * @dev Process:
     *      1. Calculate TFuel owed at current PPS (snapshot)
     *      2. Burn shares (irreversible)
     *      3. Request withdrawal from NodeManager (enters FIFO queue)
     * 
     * User must wait for cooldown period, then claim via claimTFuelAsHeadOfQueue()
     * or wait for keeper to process queue.
     */
    function burn(uint256 amount) public override nonReentrant {
        require(amount > 0, "ZERO");
        require(balanceOf(msg.sender) >= amount, "INSUFFICIENT_BALANCE");

        INodeManager nm = nodeManager;
        
        require(!nm.moreThanMaxNodesUnstaked(MAX_NUMBER_OF_NODES_UNSTAKED), "HEALING_REQUIRED");

        uint256 tfuelAmount = _tfuelForShares(amount); // snapshot at burn time
        (uint256 index, uint256 readyAt, uint256 tip) = nm.requestWithdrawal(msg.sender, tfuelAmount);
        super.burn(amount);
        uint256 netToUser = tfuelAmount - tip;
        emit BurnQueued(msg.sender, amount, netToUser, readyAt, tip, index);
    }

    /**
     * @notice Burns shares from another account (requires allowance)
     * @param account Address to burn shares from
     * @param amount Number of shares to burn
     * @dev Same process as burn() but requires ERC20 allowance
     * @custom:security Same concerns as burn() - tokens burned before external call
     */
    function burnFrom(address account, uint256 amount) public override nonReentrant {
        require(amount > 0, "ZERO");
        require(balanceOf(account) >= amount, "INSUFFICIENT_BALANCE");
        require(allowance(account, msg.sender) >= amount, "NO_ALLOWANCE");

        INodeManager nm = nodeManager;

        require(!nm.moreThanMaxNodesUnstaked(MAX_NUMBER_OF_NODES_UNSTAKED), "HEALING_REQUIRED");

        uint256 tfuelAmount = _tfuelForShares(amount);
        super.burnFrom(account, amount);
        (uint256 index, uint256 readyAt, uint256 tip) = nm.requestWithdrawal(account, tfuelAmount);
        uint256 netToUser = tfuelAmount - tip;
        emit BurnQueued(account, amount, netToUser, readyAt, tip, index);
    }

    /**
     * @notice Burns shares and immediately redeems TFuel (if liquidity available)
     * @param amount Number of shares to burn
     * @dev Process:
     *      1. Calculate TFuel owed and apply direct redeem fee (higher than queue fee)
     *      2. Check if NodeManager has sufficient liquidity
     *      3. Burn shares (irreversible)
     *      4. Request immediate redemption from NodeManager
     * 
     * Higher fee (default 2%) compensates for immediate liquidity vs waiting in queue.
     */
    function burnAndRedeemDirect(uint256 amount) external nonReentrant {
        require(amount > 0, "ZERO_AMOUNT");
        require(balanceOf(msg.sender) >= amount, "INSUFFICIENT_BALANCE");

        INodeManager nm = nodeManager;

        require(!nm.moreThanMaxNodesUnstaked(MAX_NUMBER_OF_NODES_UNSTAKED), "HEALING_REQUIRED");

        uint256 tfuelAmount = _tfuelForShares(amount);
        uint256 directRedeemFee = (tfuelAmount * directRedeemFeeBps) / 10_000;
        uint256 netTfuelAmount = tfuelAmount - directRedeemFee;
        
        (bool canRedeem, ) = nm.canDirectRedeem(netTfuelAmount);
        require(canRedeem, "INSUFFICIENT_LIQUIDITY");
        
        super.burn(amount);
        
        nm.directRedeem(msg.sender, netTfuelAmount);
        
        emit BurnAndDirectRedeemed(msg.sender, amount, netTfuelAmount, directRedeemFee);
    }


    /**
     * @notice Checks if direct redemption is possible for a given sTFuel amount
     * @param amount Number of sTFuel shares to check
     * @return bool Whether direct redemption is possible
     * @return uint256 Maximum sTFuel amount that can be directly redeemed
     * @dev Helper function for frontends to check redemption feasibility
     *      Converts sTFuel -> TFuel -> checks liquidity -> converts back to sTFuel max
     */
    function canDirectRedeem(uint256 amount) external view returns (bool, uint256) { 
        uint256 tfuelAmount = _tfuelForShares(amount);
        uint256 directRedeemFee = (tfuelAmount * directRedeemFeeBps) / 10_000;
        uint256 netTfuelAmount = tfuelAmount - directRedeemFee;
        (bool canRedeem, uint256 availableLiquidity) = nodeManager.canDirectRedeem(netTfuelAmount);
        
        // Calculate maximum sTFuel that can be redeemed given available liquidity
        // availableLiquidity is net TFuel, so gross TFuel = availableLiquidity / (1 - fee_rate)
        uint256 grossTfuelAvailable = (availableLiquidity * 10_000) / (10_000 - directRedeemFeeBps);
        uint256 maxSTFuelAmount = _sharesForTFuel(grossTfuelAvailable);
        
        return (canRedeem, maxSTFuelAmount);
    }


    // =============================================================================
    // WITHDRAWAL CLAIM FUNCTIONS
    // =============================================================================

    /**
     * @notice Claims TFuel if caller is at head of withdrawal queue and ready
     * @dev User must be:
     *      - At the head of the FIFO withdrawal queue
     *      - Past the cooldown period (readyAt block)
     *      - Have sufficient contract balance available
     */
    function claimTFuelAsHeadOfQueue() external nonReentrant {
        (bool paid, uint256 amt, uint256 index) = nodeManager.claimHeadIfReady(msg.sender);
        require(paid, "NOT_READY_OR_NOT_HEAD");
        emit Claimed(msg.sender, amt, index);
    }

    /**
     * @notice Claims accumulated TFuel credits
     * @dev Credits are assigned when queue is processed by keepers.
     *      Users can claim credits at any time.
     */
    function claimTFuel() external nonReentrant {
        uint256 credits = nodeManager.withdrawCredits(msg.sender);
        emit CreditsClaimed(msg.sender, credits);
    }

    /**
     * @notice Processes withdrawal queue (keeper function)
     * @param maxItems Maximum number of queue items to process
     * @dev Anyone can call this to process matured withdrawals.
     *      Keeper receives tips for processing.
     *      Processed withdrawals become credits users can claim.
     */
    function pokeQueue(uint256 maxItems) external nonReentrant {
        nodeManager.processQueue(maxItems, msg.sender);
    }

    // =============================================================================
    // Heal FUNCTIONS
    // =============================================================================

    /**
     * @notice Heals the system (partial)
     * @dev Heals the system (partial)
     */
    function heal() external nonReentrant {
        nodeManager.updateUnstakingNodes(MAX_NUMBER_OF_NODES_UNSTAKED);
    }

    // =============================================================================
    // VIEW FUNCTIONS
    // =============================================================================

    /**
     * @notice Returns total TFuel assets backing shares (pass-through to NodeManager)
     * @return Total net TFuel assets
     * @dev Helper for frontends - same as nodeManager.getNetAssetsBackingShares()
     */
    function totalAssetsTFuel() external view returns (uint256) {
        return nodeManager.getNetAssetsBackingShares();
    }

    /**
     * @notice Returns user credits amount
     * @param user Address of the user
     * @return credits Amount of credits
     */
    function userCredits(address user) external view returns (uint256) {
        return nodeManager.userTFuelCredits(user);
    }

    /**
     * @notice Returns true if contract will revert on next minting or burning -> needs healing
     * @return bool True if contract will needs healing
     */
    function willHeal() external view returns (bool) {
        return nodeManager.moreThanMaxNodesUnstaked(MAX_NUMBER_OF_NODES_UNSTAKED);
    }

    // =============================================================================
    // RECEIVE FUNCTION
    // =============================================================================

    /**
     * @notice Allows direct TFuel deposits via receive() fallback
     * @dev Forwards all received TFuel to NodeManager for staking
     */
    receive() external payable whenNotPaused {
        nodeManager.depositTFuel{value: msg.value}();
    }
}