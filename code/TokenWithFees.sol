pragma solidity >=0.8.4;

import "./ERC20.sol";

// https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/master/docs/modules/ROOT/pages/erc20.adoc
// https://github.com/binodnp/openzeppelin-solidity/blob/master/contracts/token/ERC20/ERC20.sol
// https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol

/// @title ERC20 token with percentage-based transfer fees and multisig fee distribution governance
/// @author tokenizer project
/// @notice This token charges a percentage fee on transfers. Collected fees are held by the
///         contract and can be distributed to beneficiaries through proposals that require a
///         configurable minimum number of admin signatures (multisig-like governance).
/// @dev The governance model is intentionally lightweight and tailored to managing fee payouts.

// ------------------------- Custom Errors -------------------------
/// @notice Emitted when an admin signs a proposal that they already signed
error ProposalAlreadySigned(uint256 proposalId, address admin);
/// @notice Emitted when a proposal lacks the required signatures to execute
error ProposalNotEnoughSignatures(uint256 proposalId, address admin);
/// @notice Unused currently: kept for forward-compatibility
error ProposalNotExecuted(uint256 proposalId);
/// @notice Emitted when attempting to act on an already executed proposal
error ProposalAlreadyExecuted(uint256 proposalId);
/// @notice Emitted when attempting to act on an already cancelled proposal
error ProposalAlreadyCancelled(uint256 proposalId);
/// @notice Emitted when collected fees are insufficient to execute a proposal
error InsufficientFees(uint256 proposalId);
/// @notice Emitted when a requested minimum signature threshold is too high
error MinimumSignaturesTooHigh(uint8 minimumSignatures);
/// @notice Emitted when the percentage fee exceeds 100%
error PercentageFeesTooHigh(uint256 percentageFees);
/// @notice Emitted when multiplication overflows while computing fees
error FeeCalculationOverflow(uint256 value, uint256 percentageFees);
/// @notice Emitted when attempting to add the zero address as admin
error CannotAddZeroAddressAsAdmin();
/// @notice Emitted when attempting to remove the zero address
error CannotRemoveZeroAddress();
/// @notice Emitted when trying to create a proposal with a zero recipient address
error CannotProposeToZeroAddress();
/// @notice Emitted when trying to create a proposal with a zero value
error CannotProposeWithZeroValue();

// ------------------------- Events -------------------------
/// @notice Emitted when a new proposal is created
event ProposalCreated(uint256 proposalId, address to, uint256 value, uint8 minimumSignatures);
/// @notice Emitted when an admin signs a proposal
event ProposalSigned(uint256 proposalId, address admin);
/// @notice Emitted when a proposal is executed and fees are distributed
event ProposalExecuted(uint256 proposalId, address to, uint256 value);
/// @notice Emitted when a proposal is cancelled
event ProposalCancelled(uint256 proposalId, address admin);

contract TokenWithFees is ERC20 {
    address internal _superAdmin;
    mapping(address admin => bool) private _admins;

    uint256 public percentageFees;
    uint256 private _collectedFees;
    uint8 private _minimumSignatures;

    /// @notice Structure representing a fee distribution proposal
    struct Proposal {
        uint256 signatureCount;
        address to;
        uint256 value;
        uint8 minimumSignatures;
        bool executed;
        address cancelledBy;
    }

    mapping(uint256 proposalId => address[] signatures) private _proposalSignatures;

    Proposal[] private _proposals;
    /// @dev Tracks IDs of proposals that are not yet executed or cancelled
    uint256[] private _openProposals; // Array of open proposal indices

    /// @notice Emitted when a minimum signatures threshold is less than 1
    error MinimumSignaturesTooLow(uint8 minimumSignatures);

    /// @notice Deploys the token with initial supply, fee percentage, and governance settings.
    /// @param name_ Token name
    /// @param symbol_ Token symbol
    /// @param totalSupply_ Initial supply in whole tokens (will be scaled by decimals)
    /// @param percentageFees_ Transfer fee percentage in [0, 100]
    /// @param minimumSignatures_ Global minimum signatures required per proposal (>= 1)
    constructor(string memory name_, string memory symbol_, uint256 totalSupply_, uint256 percentageFees_, uint8 minimumSignatures_) ERC20(name_, symbol_) {
        if (minimumSignatures_ < 1) {
            // if the minimum signatures is less than 1
            revert MinimumSignaturesTooLow(minimumSignatures_);
        }

        percentageFees = percentageFees_;
        _minimumSignatures = minimumSignatures_;
        _superAdmin = msg.sender;
        _admins[msg.sender] = true;

        // Mint full initial supply to the deployer (super admin)
        _totalSupply = totalSupply_ * 10 ** decimals();
        _balances[msg.sender] = _totalSupply;
        emit Transfer(address(0), msg.sender, _totalSupply);
    }

    // --------------- ERC20 overrides ---------------
    /// @inheritdoc ERC20
    function transfer(address to, uint256 value) public override returns (bool) {
        _payFees(msg.sender, value);
        return super.transfer(to, value);
    }

    /// @inheritdoc ERC20
    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        _payFees(msg.sender, value);
        return super.transferFrom(from, to, value);
    }

    // --------------- governance ---------------
    error OnlyOwner(address sender);
    error OnlyAdmin(address sender);

    /// @dev Restricts function to the super admin (contract deployer).
    modifier onlyOwner() {
        if (msg.sender != _superAdmin) {
            revert OnlyOwner(msg.sender);
        }
        _;
    }

    /// @dev Restricts function to addresses marked as admins.
    modifier onlyAdmin() {
        if (!_admins[msg.sender]) {
            revert OnlyAdmin(msg.sender);
        }
        _;
    }

    /// @notice Grants admin rights to an address.
    /// @param admin The address to grant admin rights to
    function addAdmin(address admin) external onlyOwner {
        if (admin == address(0)) {
            revert CannotAddZeroAddressAsAdmin();
        }
        _admins[admin] = true;
    }

    /// @notice Revokes admin rights from an address.
    /// @param admin The address to revoke admin rights from
    function removeAdmin(address admin) external onlyOwner {
        if (admin == address(0)) {
            revert CannotRemoveZeroAddress();
        }
        _admins[admin] = false;
    }

    /*
        The minimum signatures can be set by the owner.
        The minimum signatures can't be less than 1.
    */
    /// @notice Updates the global minimum required signatures for proposals.
    /// @param minimumSignatures New minimum signatures (>= 1)
    function setMinimumSignatures(uint8 minimumSignatures) external onlyOwner {
        if (minimumSignatures < 1) {
            // if the minimum signatures is less than 1
            revert MinimumSignaturesTooLow(minimumSignatures);
        }

        _minimumSignatures = minimumSignatures;
    }

    /// @notice Checks whether an address is the super admin.
    /// @param addr Address to check
    function isOwner(address addr) external view returns (bool) {
        return addr == _superAdmin;
    }

    /// @notice Checks whether an address has admin rights.
    /// @param addr Address to check
    function isAdmin(address addr) external view returns (bool) {
        return _admins[addr];
    }

    /// @notice Returns the global minimum signatures required per proposal.
    function getMinimumSignatures() external view returns (uint8) {
        return _minimumSignatures;
    }

    // --------------- fees ---------------
    /// @notice Returns the total collected but undistributed fees.
    function getCollectedFees() external view returns (uint256) {
        return _collectedFees;
    }

    /// @notice Updates the transfer fee percentage.
    /// @param percentageFees_ New percentage [0, 100]
    function updatePercentageFees(uint256 percentageFees_) external onlyOwner {
        if (percentageFees_ > 100) {
            // if the percentage fees is greater than 100
            revert PercentageFeesTooHigh(percentageFees_);
        }
        percentageFees = percentageFees_;
    }

    /// @dev Charges transfer fees from `addr` and accumulates them in `_collectedFees`.
    ///      Uses an overflow-safe calculation even for extreme values.
    /// @param addr Address from which fees are taken
    /// @param value Transfer amount used to compute fees
    function _payFees(address addr, uint256 value) private {
        if (addr != address(0) && value > 0 && percentageFees > 0) {
            // Check for overflow in fee calculation
            // We need to check if (value * percentageFees) would overflow
            // This happens when value * percentageFees > type(uint256).max
            uint256 fees;
            if (value > type(uint256).max / percentageFees) {
                // If overflow would occur, use a safer calculation method
                // Use higher precision arithmetic to avoid overflow
                // fees = (value * percentageFees) / 100
                // We can rewrite this as: fees = (value / 100) * percentageFees + (value % 100) * percentageFees / 100
                uint256 quotient = value / 100;
                uint256 remainder = value % 100;
                fees = quotient * percentageFees + (remainder * percentageFees) / 100;
            } else {
                // Normal calculation: (value * percentageFees) / 100
                fees = (value * percentageFees) / 100;
            }

            if (fees > _balances[addr]) {
                revert ERC20InsufficientBalance(addr, _balances[addr], fees);
            }
            
            // Safe arithmetic operations with explicit checks
            _balances[addr] -= fees;
            _collectedFees += fees;
        }
    }

    // --------------- open proposals management ---------------
    /// @notice Returns the list of currently open (pending) proposal IDs.
    function getOpenProposals() external view returns (uint256[] memory) {
        return _openProposals;
    }

    /// @notice Returns the number of open (pending) proposals.
    function getOpenProposalsCount() external view returns (uint256) {
        return _openProposals.length;
    }

    /// @notice Returns detailed information about a given proposal.
    /// @param proposalId ID of the proposal
    /// @return signatureCount Number of signatures the proposal has
    /// @return to Recipient address
    /// @return value Proposed amount (in smallest unit)
    /// @return minimumSignatures Minimum signatures required to execute
    /// @return executed Whether the proposal has been executed
    /// @return cancelledBy Address that cancelled the proposal (0 if not cancelled)
    function getProposal(uint256 proposalId) external view returns (
        uint256 signatureCount,
        address to,
        uint256 value,
        uint8 minimumSignatures,
        bool executed,
        address cancelledBy
    ) {
        Proposal memory proposal = _proposals[proposalId];
        return (
            proposal.signatureCount,
            proposal.to,
            proposal.value, // Return in internal units (smallest unit)
            proposal.minimumSignatures,
            proposal.executed,
            proposal.cancelledBy
        );
    }

    /// @notice Returns the total number of proposals ever created.
    function getProposalsCount() external view returns (uint256) {
        return _proposals.length;
    }

    /// @notice Checks whether an admin has signed a proposal.
    /// @param proposalId ID of the proposal
    /// @param admin Admin address to check
    function hasSignedProposal(uint256 proposalId, address admin) external view returns (bool) {
        address[] memory signatures = _proposalSignatures[proposalId];
        for (uint256 i = 0; i < signatures.length; i++) {
            if (signatures[i] == admin) {
                return true;
            }
        }
        return false;
    }

    /// @notice Returns the list of admin addresses who signed a proposal.
    /// @param proposalId ID of the proposal
    function getProposalSignatures(uint256 proposalId) external view returns (address[] memory) {
        return _proposalSignatures[proposalId];
    }

    /// @notice Returns arrays containing all proposals' data in a single call.
    /// @dev Useful for off-chain indexing or pagination-less UIs.
    function getAllProposals() external view returns (
        uint256[] memory proposalIds,
        address[] memory recipients,
        uint256[] memory values,
        uint8[] memory minimumSignatures,
        bool[] memory executed,
        address[] memory cancelledBy
    ) {
        uint256 count = _proposals.length;
        proposalIds = new uint256[](count);
        recipients = new address[](count);
        values = new uint256[](count);
        minimumSignatures = new uint8[](count);
        executed = new bool[](count);
        cancelledBy = new address[](count);
        
        for (uint256 i = 0; i < count; i++) {
            Proposal memory proposal = _proposals[i];
            proposalIds[i] = i;
            recipients[i] = proposal.to;
            values[i] = proposal.value; // Return in internal units (smallest unit)
            minimumSignatures[i] = proposal.minimumSignatures;
            executed[i] = proposal.executed;
            cancelledBy[i] = proposal.cancelledBy;
        }
        
        return (proposalIds, recipients, values, minimumSignatures, executed, cancelledBy);
    }

    /// @dev Internal helper to mark a proposal as open.
    function _addOpenProposal(uint256 proposalId) private {
        _openProposals.push(proposalId);
    }

    /// @dev Internal helper to remove a proposal from the list of open proposals.
    function _removeOpenProposal(uint256 proposalId) private {
        uint256 length = _openProposals.length;
        for (uint256 i = 0; i < length; i++) {
            if (_openProposals[i] == proposalId) {
                // Move the last element to the current position and pop
                if (i != length - 1) {
                    _openProposals[i] = _openProposals[length - 1];
                }
                _openProposals.pop();
                break;
            }
        }
    }

    /// @notice Creates a new proposal to distribute collected fees to `to`.
    /// @param to Recipient of the fee distribution
    /// @param value Amount to distribute (in smallest unit)
    /// @param minimumSignatures Proposal-specific minimum required signatures
    function proposeCollection(address to, uint256 value, uint8 minimumSignatures) external onlyAdmin {
        if (to == address(0)) {
            revert CannotProposeToZeroAddress();
        }
        if (value == 0) {
            revert CannotProposeWithZeroValue();
        }
        if (minimumSignatures < 1) {
            // if the minimum signatures is less than 1
            revert MinimumSignaturesTooLow(minimumSignatures);
        }
        if (minimumSignatures > _minimumSignatures) {
            // if the minimum signatures is greater than the global minimum signatures
            revert MinimumSignaturesTooHigh(minimumSignatures);
        }

        uint256 proposalId = _proposals.length;
        _proposals.push(Proposal({
            signatureCount: 0,
            to: to,
            value: value,
            minimumSignatures: minimumSignatures,
            executed: false,
            cancelledBy: address(0)
        }));

        // Add to open proposals
        _addOpenProposal(proposalId);

        emit ProposalCreated(proposalId, to, value, minimumSignatures);
    }

    /*
        Every admin can sign a proposal if it is not cancelled.
        A proposal can't be signed if:
        - it has already been executed.
        - it has been cancelled.
        - it has already been signed.
    */
    /// @notice Signs a proposal as an admin.
    /// @param proposalId ID of the proposal to sign
    function signProposal(uint256 proposalId) external onlyAdmin {
        if (_proposals[proposalId].executed) {
            // if the proposal has already been executed
            revert ProposalAlreadyExecuted(proposalId);
        }
        if (_proposals[proposalId].cancelledBy != address(0)) {
            // if the proposal has been cancelled
            revert ProposalAlreadyCancelled(proposalId);
        }
        
        // Check if admin has already signed
        address[] memory signatures = _proposalSignatures[proposalId];
        for (uint256 i = 0; i < signatures.length; i++) {
            if (signatures[i] == msg.sender) {
                revert ProposalAlreadySigned(proposalId, msg.sender);
            }
        }
        
        _proposalSignatures[proposalId].push(msg.sender);
        unchecked {
            _proposals[proposalId].signatureCount++;
        }

        emit ProposalSigned(proposalId, msg.sender);
    }

    /*
        Every admin can execute a proposal if it is not cancelled.
        A proposal can't be executed if:
        - it has been cancelled.
        - it has already been executed.
        - it has not enough signatures.
        - it has not enough fees.
    */
    /// @notice Executes a signed proposal and distributes fees to the recipient.
    /// @param proposalId ID of the proposal to execute
    function executeProposal(uint256 proposalId) external onlyAdmin {
        if (_proposals[proposalId].executed) {
            // if the proposal has already been executed
            revert ProposalAlreadyExecuted(proposalId);
        }
        if (_proposals[proposalId].cancelledBy != address(0)) {
            // if the proposal has been cancelled
            revert ProposalAlreadyCancelled(proposalId);
        }
        if (_proposals[proposalId].signatureCount < _proposals[proposalId].minimumSignatures) {
            // if the proposal has not enough signatures
            revert ProposalNotEnoughSignatures(proposalId, msg.sender);
        }
        if (_collectedFees < _proposals[proposalId].value) {
            // if the proposal has not enough fees
            revert InsufficientFees(proposalId);
        }
        _proposals[proposalId].executed = true; // execute
        
        // Remove from open proposals
        _removeOpenProposal(proposalId);
        
        unchecked {
            _collectedFees -= _proposals[proposalId].value; // remove fees from collected fees
            _balances[_proposals[proposalId].to] += _proposals[proposalId].value; // add value to recipient
        }
        emit Transfer(address(0), _proposals[proposalId].to, _proposals[proposalId].value); // emit transfer event

        emit ProposalExecuted(proposalId, _proposals[proposalId].to, _proposals[proposalId].value);
    }

    /*
        Every admin can cancel a proposal if it is not executed.
        A single admin is enough to cancel a proposal.
        A proposal can't be cancelled if:
        - it has already been executed.
        - it has been cancelled.
    */
    /// @notice Cancels an open proposal.
    /// @param proposalId ID of the proposal to cancel
    function cancelProposal(uint256 proposalId) external onlyAdmin {
        if (_proposals[proposalId].executed) {
            // if the proposal has already been executed
            revert ProposalAlreadyExecuted(proposalId);
        }
        if (_proposals[proposalId].cancelledBy != address(0)) {
            // if the proposal has been cancelled
            revert ProposalAlreadyCancelled(proposalId);
        }
        _proposals[proposalId].cancelledBy = msg.sender;

        // Remove from open proposals
        _removeOpenProposal(proposalId);

        emit ProposalCancelled(proposalId, msg.sender);
    }
}