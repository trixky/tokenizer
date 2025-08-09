## Use Fees42 (FE42) with MetaMask on BNB Testnet

### What you’ll do
- **Add the BNB Testnet network** to MetaMask (manually)
- **Import the FE42 token** by its contract address
- **Send/receive FE42** and understand fees and gas

### Prerequisites
- **MetaMask installed**: Browser extension or mobile app
  - Extension: chrome web store / firefox add-ons
  - Mobile: iOS App Store / Google Play
- **Some tBNB for gas**: Use the official BNB Testnet faucet to fund your address with a small amount of test BNB for gas fees
- Optional: A small amount of FE42 to see your balance update after import

### Network details (BNB Testnet)
- **Network Name**: BSC Testnet
- **New RPC URL**: https://data-seed-prebsc-1-s1.bnbchain.org:8545
- **Chain ID**: 97
- **Currency Symbol**: tBNB
- **Block Explorer**: https://testnet.bscscan.com/

Contract reference (verified): https://testnet.bscscan.com/address/0x9C51dA027FB74eB8E3Ea0B48F4FB959Ab07ff433#code

---

## 1) Add BNB Testnet to MetaMask (manual)

### Browser extension
1. Open MetaMask → top-right account icon → Settings
2. Go to Networks → Add network → Add a network manually
3. Fill the fields exactly with the values above
4. Save → Select “BSC Testnet” as your active network

### Mobile (iOS/Android)
1. Open MetaMask → Menu (top-left) → Settings
2. Networks → Add Network → Add a network manually
3. Fill in the same fields
4. Save → Switch to “BSC Testnet”

Notes:
- If you get a connectivity error, double-check the RPC URL and Chain ID
- You need a small amount of tBNB for gas to send transactions on this network

---

## 2) Import the FE42 token into MetaMask

### Token details
- **Token name**: Fees42
- **Symbol**: FE42
- **Decimals**: 18
- **Contract address**: 0x9C51dA027FB74eB8E3Ea0B48F4FB959Ab07ff433

### Browser extension
1. Ensure the selected network is “BSC Testnet”
2. Click “Import tokens” at the bottom of the Assets tab
3. Paste the contract address: 0x9C51dA027FB74eB8E3Ea0B48F4FB959Ab07ff433
4. MetaMask should auto-fill Symbol = FE42, Decimals = 18; if not, enter them
5. Click “Add custom token” → “Import tokens”

### Mobile
1. Make sure “BSC Testnet” is selected
2. On the Assets tab, scroll down → Import tokens
3. Paste the token contract address above
4. Confirm symbol/decimals (FE42 / 18)
5. Add token

After import, you’ll see your FE42 balance when you hold any FE42 on this network.

---

## 3) Send and receive FE42

- You can send FE42 to another address like any ERC-20/BEP-20 token
- **Gas**: You must have a small amount of tBNB to pay gas on BNB Testnet
- **Transfer fee (important)**: This token charges a percentage fee on transfers
  - Current fee: 5% of the transferred amount
  - Fees are collected by the smart contract and governed for later distribution
- If the recipient reports receiving slightly less than what was sent, that’s expected due to the transfer fee

---

## 4) Troubleshooting

- **FE42 balance not visible**: Make sure you’re on the “BSC Testnet” network, and that FE42 is imported
- **Token import fails**: Double-check the contract address; ensure the network is BSC Testnet
- **Insufficient funds**: You need tBNB for gas even when sending tokens; use the BNB Testnet faucet
- **Still stuck?** View the token contract and your address on the BNB Testnet block explorer to confirm balances and transactions

Helpful links:
- BNB Testnet Explorer (contract): https://testnet.bscscan.com/address/0x9C51dA027FB74eB8E3Ea0B48F4FB959Ab07ff433
- BNB Testnet wallet configuration docs: https://docs.bnbchain.org/bnb-smart-chain/developers/wallet-configuration/

---

## 5) Quick copy-paste (for manual network add)

- Network Name: BSC Testnet
- New RPC URL: https://data-seed-prebsc-1-s1.bnbchain.org:8545
- Chain ID: 97
- Currency Symbol: tBNB
- Block Explorer: https://testnet.bscscan.com/

Token to import on BSC Testnet:
- Contract address: 0x9C51dA027FB74eB8E3Ea0B48F4FB959Ab07ff433
- Symbol: FE42
- Decimals: 18


