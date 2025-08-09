pragma solidity >=0.8.4;

/// @title Minimal ERC20 implementation used as a base for custom tokens
/// @author tokenizer project
/// @notice This contract implements the ERC-20 standard with a modern internal
///         accounting model inspired by OpenZeppelin's reference implementation.
/// @dev The contract purposefully exposes only the standard ERC-20 external API
///      while keeping the core state variables `internal` to allow extensions
///      in derived contracts.

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

// https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/master/docs/modules/ROOT/pages/erc20.adoc
// https://github.com/binodnp/openzeppelin-solidity/blob/master/contracts/token/ERC20/ERC20.sol
// https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol

/// @dev Abstract ERC20 implementation providing the core mechanics and storage.
abstract contract ERC20 is IERC20, IERC20Metadata, IERC20Errors {
    mapping(address account => uint256) internal _balances;
    mapping(address account => mapping(address spender => uint256)) private _allowances;

    uint256 internal _totalSupply;


    // Immutable token metadata set at construction time
    string private _name;
    string private _symbol;

    /// @notice Initializes the token name and symbol.
    /// @param name_ Token name (e.g., "MyToken")
    /// @param symbol_ Token symbol (e.g., "MTK")
    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    // -------------------------------- IERC20 implementation --------------------------------
    // -------------------------------- internal
    /// @dev Core accounting function that moves tokens between addresses.
    ///      If `from` is the zero address, tokens are minted.
    ///      If `to` is the zero address, tokens are burned.
    ///      Emits a {Transfer} event.
    /// @param from Address to debit, or address(0) to mint
    /// @param to Address to credit, or address(0) to burn
    /// @param value Amount of tokens in the smallest unit (decimals: 18)
    function _update(address from, address to, uint256 value) internal virtual {
        // Mint path: increase total supply when tokens are created
        if (from == address(0)) {
            _totalSupply += value;
        } else {
            uint256 fromBalance = _balances[from];
            if (fromBalance < value) {
                revert ERC20InsufficientBalance(from, fromBalance, value);
            }
            unchecked {
                // Safe due to the explicit balance check above
                _balances[from] = fromBalance - value;
            }
        }

        // Burn path: decrease total supply when tokens are destroyed
        if (to == address(0)) {
            _totalSupply -= value;
        } else {
            unchecked {
                // Balance increases cannot overflow total supply tracked separately
                _balances[to] += value;
            }
        }

        emit Transfer(from, to, value);
    }

    /// @dev Internal transfer that validates non-zero sender and receiver.
    /// @param from Sender address
    /// @param to Receiver address
    /// @param value Amount of tokens to transfer
    function _transfer(address from, address to, uint256 value) internal {
        // Disallow transfers from the zero address
        if (from == address(0)) {
            revert ERC20InvalidSender(address(0));
        }
        // Disallow transfers to the zero address
        if (to == address(0)) {
            revert ERC20InvalidReceiver(address(0));
        }
        _update(from, to, value);
    }

    /// @dev Sets `value` as the allowance of `spender` over the `owner` s tokens.
    ///      Emits an {Approval} event.
    /// @param owner The token owner granting the allowance
    /// @param spender The spender allowed to spend tokens
    /// @param value The new allowance amount
    function _approve(address owner, address spender, uint256 value) internal virtual {
        _approve(owner, spender ,value, true);
    }

    /// @dev Internal approve with an option to suppress the Approval event.
    /// @param owner The token owner
    /// @param spender The spender
    /// @param value Allowance amount
    /// @param emitEvent Whether to emit the {Approval} event
    function _approve(address owner, address spender, uint256 value, bool emitEvent) internal virtual {
        // Validate involved addresses
        if (owner == address(0)) {
            revert ERC20InvalidApprover(address(0));
        }
        if (spender == address(0)) {
            revert ERC20InvalidSpender(address(0));
        }
        // Write new allowance value
        _allowances[owner][spender] = value;
        if (emitEvent) {
            // Optionally emit event (skipped for internal allowance adjustments)
            emit Approval(owner, spender, value);
        }
    }

    /// @dev Consumes `value` from the allowance of `owner` toward `spender`.
    ///      Will not update the allowance if it is set to the maximum uint256.
    /// @param owner The token owner whose allowance is spent
    /// @param spender The spender consuming the allowance
    /// @param value Amount to spend
    function _spendAllowance(address owner, address spender, uint256 value) internal virtual {
        uint256 currentAllowance = allowance(owner, spender);
        // If allowance is not set to "infinite", enforce and decrease it
        if (currentAllowance < type(uint256).max) {
            if (currentAllowance < value) {
                revert ERC20InsufficientAllowance(spender, currentAllowance, value);
            }
            unchecked {
                // Safe: ensured currentAllowance >= value just above
                _approve(owner, spender, currentAllowance - value, false);
            }
        }
    }

    // -------------------------------- external
    /// @notice Returns the total token supply.
    function totalSupply() public view virtual returns (uint256) {
        return _totalSupply;
    }

    /// @notice Returns the token balance of a given account.
    /// @param account Address to query
    function balanceOf(address account) public view virtual returns (uint256) {
        return _balances[account];
    }

    /// @notice Transfers `value` tokens to `to`.
    /// @param to Recipient address
    /// @param value Amount to transfer
    /// @return success True if the operation succeeded
    function transfer(address to, uint256 value) public virtual returns (bool) {
        // Cache sender (could also use _msgSender in meta-tx aware contexts)
        address owner = msg.sender; // could be _msgSender
        _transfer(owner, to, value);
        return true;
    }

    /// @notice Returns the current allowance from `owner` to `spender`.
    /// @param owner Token owner address
    /// @param spender Spender address
    function allowance(address owner, address spender) public view virtual returns (uint256) {
        return _allowances[owner][spender];
    }

    /// @notice Approves `spender` to spend `value` on behalf of the caller.
    /// @param spender Spender address
    /// @param value Allowance amount
    /// @return success True if the operation succeeded
    function approve(address spender, uint256 value) external virtual returns (bool) {
        // Cache sender (could also use _msgSender in meta-tx aware contexts)
        address owner = msg.sender; // could be _msgSender
        _approve(owner, spender, value);
        return true;
    }

    /// @notice Transfers `value` tokens from `from` to `to` using allowance.
    /// @param from Address to debit
    /// @param to Address to credit
    /// @param value Amount to transfer
    /// @return success True if the operation succeeded
    function transferFrom(address from, address to, uint256 value) public virtual returns (bool) {
        // Cache spender (could also use _msgSender in meta-tx aware contexts)
        address spender = msg.sender; // could be _msgSender
        _spendAllowance(from, spender, value);
        _transfer(from, to, value);
        return true;
    }

    // -------------------------------- IERC20Metadata implementation --------------------------------
    // -------------------------------- external
    /// @notice Returns the token name.
    function name() public view virtual returns(string memory) {
        return _name;
    }

    /// @notice Returns the token symbol.
    function symbol() public view virtual returns(string memory) {
        return _symbol;
    }

    /// @notice Returns the number of decimals used for user representation.
    function decimals() public view virtual returns(uint8) {
        return 18;
    }
}
