pragma solidity >=0.8.4;

import "./ERC20.sol";

// https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/master/docs/modules/ROOT/pages/erc20.adoc
// https://github.com/binodnp/openzeppelin-solidity/blob/master/contracts/token/ERC20/ERC20.sol
// https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol

error ProposalAlreadySigned(uint256 proposalId, address admin);
error ProposalNotEnoughSignatures(uint256 proposalId, address admin);
error ProposalNotExecuted(uint256 proposalId);
error ProposalAlreadyExecuted(uint256 proposalId);
error ProposalAlreadyCancelled(uint256 proposalId);
error InsufficientFees(uint256 proposalId);
error MinimumSignaturesTooHigh(uint8 minimumSignatures);
error PercentageFeesTooHigh(uint256 percentageFees);
error FeeCalculationOverflow(uint256 value, uint256 percentageFees);

event ProposalCreated(uint256 proposalId, address to, uint256 value, uint8 minimumSignatures);
event ProposalSigned(uint256 proposalId, address admin);
event ProposalExecuted(uint256 proposalId, address to, uint256 value);
event ProposalCancelled(uint256 proposalId, address admin);

contract TokenWithFees is ERC20 {
    address internal _superAdmin;
    mapping(address admin => bool) private _admins;

    uint256 public percentageFees;
    uint256 private _collectedFees;
    uint8 private _minimumSignatures;

    struct Proposal {
        uint256 signatureCount;
        address to;
        uint256 value;
        uint8 minimumSignatures;
        bool executed;
        address cancelledBy;
    }

    mapping(uint256 proposalId => mapping(address admin => bool) signatures) private _proposalSignatures;

    Proposal[] private _proposals;

    error MinimumSignaturesTooLow(uint8 minimumSignatures);

    constructor(string memory name_, string memory symbol_, uint256 totalSupply_, uint256 percentageFees_, uint8 minimumSignatures_) ERC20(name_, symbol_) {
        if (minimumSignatures_ < 1) {
            // if the minimum signatures is less than 1
            revert MinimumSignaturesTooLow(minimumSignatures_);
        }

        percentageFees = percentageFees_;
        _minimumSignatures = minimumSignatures_;
        _superAdmin = msg.sender;
        _admins[msg.sender] = true;

        // mint tokens to the owner
        _totalSupply = totalSupply_ * 10 ** decimals();
        _balances[msg.sender] = _totalSupply;
        emit Transfer(address(0), msg.sender, _totalSupply);
    }

    // --------------- ERC20 overrides ---------------
    function transfer(address to, uint256 value) public override returns (bool) {
        _payFees(msg.sender, value);
        return super.transfer(to, value);
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        _payFees(msg.sender, value);
        return super.transferFrom(from, to, value);
    }

    // --------------- governance ---------------
    error OnlyOwner(address sender);
    error OnlyAdmin(address sender);

    modifier onlyOwner() {
        if (msg.sender != _superAdmin) {
            revert OnlyOwner(msg.sender);
        }
        _;
    }

    modifier onlyAdmin() {
        if (!_admins[msg.sender]) {
            revert OnlyAdmin(msg.sender);
        }
        _;
    }

    function addAdmin(address admin) external onlyOwner {
        _admins[admin] = true;
    }

    function removeAdmin(address admin) external onlyOwner {
        _admins[admin] = false;
    }

    /*
        The minimum signatures can be set by the owner.
        The minimum signatures can't be less than 1.
    */
    function setMinimumSignatures(uint8 minimumSignatures) external onlyOwner {
        if (minimumSignatures < 1) {
            // if the minimum signatures is less than 1
            revert MinimumSignaturesTooLow(minimumSignatures);
        }

        _minimumSignatures = minimumSignatures;
    }

    function isOwner(address addr) external view returns (bool) {
        return addr == _superAdmin;
    }

    function isAdmin(address addr) external view returns (bool) {
        return _admins[addr];
    }

    function getMinimumSignatures() external view returns (uint8) {
        return _minimumSignatures;
    }

    // --------------- fees ---------------
    function getCollectedFees() external view returns (uint256) {
        return _collectedFees;
    }

    function updatePercentageFees(uint256 percentageFees_) external onlyOwner {
        if (percentageFees_ > 100) {
            // if the percentage fees is greater than 100
            revert PercentageFeesTooHigh(percentageFees_);
        }
        percentageFees = percentageFees_;
    }

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
            unchecked {
                _balances[addr] -= fees;
                _collectedFees += fees;
            }
        }
    }

    function proposeCollection(address to, uint256 value, uint8 minimumSignatures) external onlyAdmin {
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

        emit ProposalCreated(proposalId, to, value, minimumSignatures);
    }

    /*
        Every admin can sign a proposal if it is not cancelled.
        A proposal can't be signed if:
        - it has already been executed.
        - it has been cancelled.
        - it has already been signed.
    */
    function signProposal(uint256 proposalId) external onlyAdmin {
        if (_proposals[proposalId].executed) {
            // if the proposal has already been executed
            revert ProposalAlreadyExecuted(proposalId);
        }
        if (_proposals[proposalId].cancelledBy != address(0)) {
            // if the proposal has been cancelled
            revert ProposalAlreadyCancelled(proposalId);
        }
        if (_proposalSignatures[proposalId][msg.sender]) {
            // if the admin has already signed the proposal
            revert ProposalAlreadySigned(proposalId, msg.sender);
        }
        _proposalSignatures[proposalId][msg.sender] = true;
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

        emit ProposalCancelled(proposalId, msg.sender);
    }
}