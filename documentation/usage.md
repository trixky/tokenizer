### TokenWithFees — Usage Guide (with governance scenarios)

## Prerequisites
- Node.js and Hardhat installed in this repo.
- Compiled contracts: `cd deployment && npx hardhat compile`.
- A local node (e.g., `npx hardhat node`) or any RPC endpoint.

You can deploy with a Hardhat script or use the provided Ignition module (`deployment/ignition/modules/TokenWithFees.ts`). For clarity, this guide shows direct Hardhat/Ethers scripts.

## Deployment (example script)
```ts
// scripts/deploy.ts
import { ethers } from "hardhat";

async function main() {
  const [owner] = await ethers.getSigners();
  const TokenWithFees = await ethers.getContractFactory("TokenWithFees");

  // name, symbol, initialSupply (whole tokens), percentageFees [0..100], minimumSignatures (uint8 >= 1)
  const token = await TokenWithFees.deploy("TokenWithFees", "TWF", 1_000_000n, 2n, 2);
  await token.waitForDeployment();

  console.log("Deployed by:", owner.address);
  console.log("Token address:", await token.getAddress());
}

main().catch((e) => { console.error(e); process.exit(1); });
```

Run: `npx hardhat run scripts/deploy.ts --network localhost`

## Connecting to an existing deployment
```ts
import { ethers } from "hardhat";

const tokenAddress = "<DEPLOYED_ADDRESS>";
const token = await ethers.getContractAt("TokenWithFees", tokenAddress);
```

## Fees: who pays and when
- On `transfer` and `transferFrom`, the **initiator (`msg.sender`) pays the fee** before the token movement.
- Fee formula: `fees = value * percentageFees / 100` (overflow-safe).
- Fees go to an internal pool (`getCollectedFees()`), not to any address directly.
- Owner can update the percentage within [0, 100] via `updatePercentageFees(newPct)`.

### Example: simple transfer with fees
```ts
const [owner, alice, bob] = await ethers.getSigners();
const token = await ethers.getContractAt("TokenWithFees", tokenAddress, owner);

// Set 2% fee (owner only)
await (await token.updatePercentageFees(2)).wait();

// Owner sends 1,000 tokens to Alice; owner pays 2% fee from owner balance
await (await token.transfer(alice.address, 1_000n * 10n ** 18n)).wait();

const collected = await token.getCollectedFees();
console.log("Collected fees:", collected.toString());
```

### Example: allowance + transferFrom (spender pays the fee)
```ts
const [owner, alice, bob, spender] = await ethers.getSigners();
const tokenOwner = token.connect(owner);
const tokenSpender = token.connect(spender);

// Owner approves 'spender' to move owner funds
await (await tokenOwner.approve(spender.address, 5_000n * 10n ** 18n)).wait();

// Spender pulls 1,000 tokens from owner to Bob; spender pays the fee
await (await tokenSpender.transferFrom(owner.address, bob.address, 1_000n * 10n ** 18n)).wait();
```

## Governance model
- **Owner (super admin)**: Only address that can `addAdmin`, `removeAdmin`, and `setMinimumSignatures` (global threshold).
- **Admins**: Can `proposeCollection`, `signProposal`, `executeProposal`, and `cancelProposal`.
- **Cancellation**: Any admin (owner included) can cancel a non-executed proposal.

### Setup roles
```ts
const [owner, admin1, admin2] = await ethers.getSigners();
const asOwner = token.connect(owner);

// Add two admins
await (await asOwner.addAdmin(admin1.address)).wait();
await (await asOwner.addAdmin(admin2.address)).wait();

// Optional: set global minimum signatures (>= 1)
await (await asOwner.setMinimumSignatures(2)).wait();
```

### Build up fees to distribute
```ts
// Ensure some fees are collected before proposing a payout
await (await token.transfer(admin1.address, 2_000n * 10n ** 18n)).wait();
await (await token.transfer(admin2.address, 1_500n * 10n ** 18n)).wait();

const fees = await token.getCollectedFees();
console.log("Collected fees available:", fees.toString());
```

### Scenario A: Create, sign, and execute a proposal
```ts
const asAdmin1 = token.connect(admin1);
const asAdmin2 = token.connect(admin2);

// Admin1 proposes to distribute 1,000 tokens (smallest unit) to a recipient, requiring 2 signatures
const recipient = "0x1234..."; // replace with an actual address
const value = 1_000n * 10n ** 18n; // token has 18 decimals
await (await asAdmin1.proposeCollection(recipient, value, 2)).wait();

// Inspect open proposals
const openIds = await token.getOpenProposals();
const proposalId = openIds[0];

// Admins sign the proposal
await (await asAdmin1.signProposal(proposalId)).wait();
await (await asAdmin2.signProposal(proposalId)).wait();

// Execute once signatures >= minimum and collected fees are sufficient
await (await asAdmin1.executeProposal(proposalId)).wait();

// Verify recipient balance increased and proposal closed
const [sigCount, to, amount, minSigs, executed] = await token.getProposal(proposalId);
console.log({ sigCount: sigCount.toString(), to, amount: amount.toString(), minSigs, executed });
```

### Scenario B: Cancel a proposal
```ts
// Create another proposal
await (await asAdmin1.proposeCollection(recipient, 500n * 10n ** 18n, 1)).wait();
const open = await token.getOpenProposals();
const pid = open[open.length - 1];

// Any admin (including owner) can cancel before execution
await (await asAdmin2.cancelProposal(pid)).wait();

// Fetch and confirm cancellation
const proposal = await token.getProposal(pid);
// proposal.cancelledBy != address(0)
```

## Useful views and helpers
- Roles and thresholds:
  - `isOwner(address)`
  - `isAdmin(address)`
  - `getMinimumSignatures()`
- Fees:
  - `getCollectedFees()`
- Proposals:
  - `getOpenProposals()`, `getOpenProposalsCount()`
  - `getProposalsCount()`
  - `getProposal(id)`
  - `getAllProposals()`
  - `getProposalSignatures(id)`, `hasSignedProposal(id, admin)`

## Common reverts to watch for
- `OnlyOwner` when a non-owner calls owner-only functions.
- `OnlyAdmin` when a non-admin calls admin-only functions.
- `MinimumSignaturesTooLow` if using 0.
- `MinimumSignaturesTooHigh` if proposal’s min signatures exceed global threshold.
- `InsufficientFees` when executing without enough collected fees.
- `ProposalAlreadySigned`, `ProposalAlreadyExecuted`, `ProposalAlreadyCancelled` on invalid actions.
- ERC‑20 errors for invalid addresses or insufficient balances/allowances.

## Tips
- Values in governance APIs are in the token’s smallest unit (18 decimals). Convert when preparing UI or scripts.
- Check `deployment/test/*.ts` for extensive end‑to‑end examples.

