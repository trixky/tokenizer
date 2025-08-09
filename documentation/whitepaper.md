### TokenWithFees — ERC-20 with Transfer Fees and Admin-Governed Fee Distribution

## Overview
TokenWithFees is an ERC-20–compatible token that charges a percentage fee on each transfer. Collected fees accumulate inside the contract and can be distributed to designated recipients via proposals that require a configurable minimum number of admin signatures (a lightweight multisig-style workflow).

## Key properties
- **Owner-centric governance**: The deployer (the “super admin”) is the only address that can add or remove admins and set the global minimum signature threshold. This guarantees the owner ultimately controls who participates in governance.
- **Admin-cancellable proposals**: Any admin, including the owner, can cancel a proposal that has not yet been executed. This enables rapid response to mistakes or changes in intent.
- **Simple, predictable fees**: On both `transfer` and `transferFrom`, the initiator of the operation pays a percentage-based fee that is accumulated by the contract for later distribution.

## Token and supply
- Standard ERC‑20 interface: `totalSupply`, `balanceOf`, `transfer`, `approve`, `transferFrom`, `allowance`, `name`, `symbol`, `decimals`.
- The initial supply is minted to the deployer at construction.

## Transfer fee mechanism
- **Who pays**: The initiator pays the fee.
  - `transfer`: the caller (`msg.sender`) pays fees before the transfer is executed.
  - `transferFrom`: the caller (`msg.sender`) pays fees before the allowance-based transfer is executed.
- **How fees are computed**: `fees = value * percentageFees / 100` with overflow-safe arithmetic. If a direct multiplication would overflow, the calculation uses a safe decomposition to preserve correctness.
- **Bounds**: `percentageFees` is in [0, 100]. Attempts to set a higher value revert.
- **Accounting**: Fees are deducted from the payer’s balance and added to an internal `_collectedFees` pool. They are not immediately redistributed or burned.
- **Updates**: The owner can update `percentageFees` at any time within bounds.
- **Introspection**: `getCollectedFees()` exposes the total undistributed fees.

## Governance and proposals
### Roles
- **Owner (super admin)**: The deployer. Only the owner can:
  - add or remove admins (`addAdmin`, `removeAdmin`),
  - set the global minimum signatures (`setMinimumSignatures`).
  This ensures the owner retains final authority over who can govern.

- **Admins**: Addresses designated by the owner. Admins can:
  - create proposals to distribute fees (`proposeCollection`),
  - sign proposals (`signProposal`),
  - execute proposals once sufficiently signed and funded (`executeProposal`),
  - cancel any non-executed proposal (`cancelProposal`).

### Proposal lifecycle
1. **Create**: An admin proposes a payout specifying recipient, amount (in token’s smallest unit), and a per‑proposal minimum signature threshold that cannot exceed the global minimum.
2. **Sign**: Admins sign the proposal. Duplicate signatures are rejected.
3. **Execute**: Any admin can execute once:
   - signature count ≥ proposal’s minimum signatures, and
   - `_collectedFees` ≥ proposed value.
   On execution, the proposal is marked executed, removed from the open set, fees are deducted from `_collectedFees`, and the recipient’s balance is credited (emitting a `Transfer` event from `address(0)` for transparency).
4. **Cancel**: Any admin (including the owner) can cancel a non-executed proposal. Cancellation removes it from the open set and prevents further actions.

### Discovery and monitoring
- `getOpenProposals()` / `getOpenProposalsCount()` track pending proposals.
- `getProposalsCount()` returns the total number ever created.
- `getProposal(id)` returns per‑proposal details.
- `getAllProposals()` returns batched arrays with all proposals for easy indexing.
- `getProposalSignatures(id)` and `hasSignedProposal(id, admin)` expose signature state.
- `isOwner(addr)` and `isAdmin(addr)` reveal role membership.
- `getMinimumSignatures()` shows the current global threshold.

## Errors and events (selected)
- Errors include: `MinimumSignaturesTooLow`, `MinimumSignaturesTooHigh`, `PercentageFeesTooHigh`, `InsufficientFees`, `ProposalAlreadySigned`, `ProposalNotEnoughSignatures`, `ProposalAlreadyExecuted`, `ProposalAlreadyCancelled`, and standard ERC‑20 errors for invalid senders/receivers and insufficient balances/allowances.
- Events include: `ProposalCreated`, `ProposalSigned`, `ProposalExecuted`, `ProposalCancelled`, and standard ERC‑20 `Transfer`/`Approval`.

## Security considerations
- Fee math is overflow‑safe and bounded by design.
- Zero‑address checks prevent misconfiguration.
- Only owner can curate the admin set and the global minimum signatures, preserving ultimate governance control.
- Proposal execution requires both sufficient signatures and sufficient collected fees.

## Configuration parameters
- Constructor parameters: `name`, `symbol`, `initialSupply`, `percentageFees`, `minimumSignatures`.
- Decimals: 18.

## Summary
- The owner retains control by exclusively managing the admin list and the global signature threshold.
- Any admin (owner included) can cancel non‑executed proposals.
- Fees are paid by the initiator of transfers, accumulated in the contract, and distributed through admin‑signed proposals.