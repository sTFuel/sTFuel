// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal interface for OpenZeppelin AccessControl-compatible contracts
interface IAccessControl {
    function grantRole(bytes32 role, address account) external;
    function revokeRole(bytes32 role, address account) external;
}

/**
 * @title RoleAdminMultisig2of3
 * @notice 2-of-3 multisig that can ONLY:
 *         - grantRole(bytes32,address) on any target AccessControl contract
 *         - revokeRole(bytes32,address) on any target AccessControl contract
 *
 * @dev Use this as DEFAULT_ADMIN_ROLE on your protocol contracts.
 *      It CANNOT execute arbitrary calls or move funds.
 */
contract RoleAdminMultisig2of3 {
    // ---------------------------------------------------------------------
    // Constants: restricted roles
    // ---------------------------------------------------------------------

    // OpenZeppelin AccessControl DEFAULT_ADMIN_ROLE
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 public constant MANAGER_ROLE       = keccak256("MANAGER_ROLE");
    bytes32 public constant NODE_MANAGER_ROLE  = keccak256("NODE_MANAGER_ROLE");

    // ---------------------------------------------------------------------
    // Owners (2-of-3)
    // ---------------------------------------------------------------------
    address public immutable owner1;
    address public immutable owner2;
    address public immutable owner3;

    // Number of operations created so far
    uint256 public opCounter;

    enum OpType {
        Grant,
        Revoke
    }

    struct RoleOp {
        OpType   opType;
        bytes32  role;
        address  account;
        address  target;
        uint8    approvals;
        bool     executed;
    }

    // opId => RoleOp
    mapping(uint256 => RoleOp) public ops;
    // opId => owner => approved?
    mapping(uint256 => mapping(address => bool)) public isApproved;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------
    event RoleOpSubmitted(
        uint256 indexed opId,
        OpType   opType,
        bytes32  indexed role,
        address  indexed account,
        address  target,
        address  proposer
    );

    event RoleOpApproved(
        uint256 indexed opId,
        address indexed owner,
        address indexed target,
        uint8   approvals
    );

    event RoleOpExecuted(
        uint256 indexed opId,
        OpType   opType,
        bytes32  indexed role,
        address  indexed account,
        address  target
    );

    event RoleOpCancelled(
        uint256 indexed opId
    );

    // ---------------------------------------------------------------------
    // Constructor & Modifiers
    // ---------------------------------------------------------------------
    constructor(
        address _owner1,
        address _owner2,
        address _owner3
    ) {
        require(_owner1 != address(0) && _owner2 != address(0) && _owner3 != address(0), "ZERO_OWNER");
        require(_owner1 != _owner2 && _owner1 != _owner3 && _owner2 != _owner3, "DUP_OWNER");

        owner1 = _owner1;
        owner2 = _owner2;
        owner3 = _owner3;
    }

    modifier onlyOwner() {
        require(
            msg.sender == owner1 ||
            msg.sender == owner2 ||
            msg.sender == owner3,
            "NOT_OWNER"
        );
        _;
    }

    modifier onlyAllowedRole(bytes32 role) {
        require(
            role == DEFAULT_ADMIN_ROLE ||
            role == MANAGER_ROLE ||
            role == NODE_MANAGER_ROLE,
            "ROLE_NOT_ALLOWED"
        );
        _;
    }

    // ---------------------------------------------------------------------
    // Submit operations
    // ---------------------------------------------------------------------

    /**
     * @notice Propose granting a role to an account on a target contract.
     * @dev This also counts as the first approval from msg.sender.
     */
    function submitGrant(bytes32 role, address account, address target)
        external
        onlyOwner
        onlyAllowedRole(role)
        returns (uint256 opId)
    {
        require(account != address(0), "ZERO_ACCOUNT");
        require(target != address(0), "ZERO_TARGET");

        opId = opCounter++;
        RoleOp storage op = ops[opId];
        op.opType    = OpType.Grant;
        op.role      = role;
        op.account   = account;
        op.approvals = 1;
        op.executed  = false;
        op.target    = target;

        isApproved[opId][msg.sender] = true;

        emit RoleOpSubmitted(opId, OpType.Grant, role, account, target, msg.sender);
        emit RoleOpApproved(opId, msg.sender, target, op.approvals);

        // If the same owner calls twice, approvals won't reach 2 because of isApproved check.
        // So no auto-exec here (only 1 approval at submit time).
    }

    /**
     * @notice Propose revoking a role from an account on a target contract.
     * @dev This also counts as the first approval from msg.sender.
     */
    function submitRevoke(bytes32 role, address account, address target)
        external
        onlyOwner
        onlyAllowedRole(role)
        returns (uint256 opId)
    {
        require(account != address(0), "ZERO_ACCOUNT");
        require(target != address(0), "ZERO_TARGET");

        opId = opCounter++;
        RoleOp storage op = ops[opId];
        op.opType    = OpType.Revoke;
        op.role      = role;
        op.account   = account;
        op.approvals = 1;
        op.executed  = false;
        op.target    = target;

        isApproved[opId][msg.sender] = true;

        emit RoleOpSubmitted(opId, OpType.Revoke, role, account, target, msg.sender);
        emit RoleOpApproved(opId, msg.sender, target, op.approvals);
    }

    // ---------------------------------------------------------------------
    // Approve (+ auto-execute) operations
    // ---------------------------------------------------------------------

    /**
     * @notice Approve a pending operation (grant/revoke).
     *         When this is the 2nd approval, the operation is executed immediately.
     */
    function approve(uint256 opId) external onlyOwner {
        RoleOp storage op = ops[opId];
        require(op.account != address(0), "NO_OP");
        require(!op.executed, "EXECUTED");
        require(!isApproved[opId][msg.sender], "ALREADY_APPROVED");

        isApproved[opId][msg.sender] = true;
        op.approvals++;

        emit RoleOpApproved(opId, msg.sender, op.target, op.approvals);

        // Auto-execute on 2nd approval (2-of-3)
        if (op.approvals >= 2) {
            op.executed = true;

            if (op.opType == OpType.Grant) {
                IAccessControl(op.target).grantRole(op.role, op.account);
            } else {
                IAccessControl(op.target).revokeRole(op.role, op.account);
            }

            emit RoleOpExecuted(opId, op.opType, op.role, op.account, op.target);
        }
    }

    function cancel(uint256 opId) external onlyOwner {
        RoleOp storage op = ops[opId];
        require(op.account != address(0), "NO_OP");
        require(!op.executed, "EXECUTED");
        require(isApproved[opId][msg.sender], "NOT_CREATOR");

        op.executed = true; // mark as no longer actionable
        emit RoleOpCancelled(opId);
    }
}