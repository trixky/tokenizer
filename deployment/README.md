# Fees Contract Deployment

This directory contains deployment scripts for the `TokenWithFees` contract using different approaches.

## Deployment

```bash
npm install --save-dev @nomiclabs/hardhat-etherscan

# get some testnet points with https://www.bnbchain.org/en/testnet-faucet
npx hardhat vars setup # list all required ENV variables
npx hardhat vars set ALCHEMY_URL # set the ALCHEMY_URL env variable
npx hardhat vars set PRIVATE_KEY # set the PRIVATE_KEY env variable
npx hardhat ignition deploy ignition/modules/TokenWithFees.ts --network bscTestnet
# ✔ Confirm deploy to network bscTestnet (97)? … yes
# Hardhat Ignition 🚀

# Deploying [ TokenWithFeesModule ]

# Batch #1
#   Executed TokenWithFeesModule#TokenWithFees

# [ TokenWithFeesModule ] successfully deployed 🚀

# Deployed Addresses

# TokenWithFeesModule#TokenWithFees - 0x9C51dA027FB74eB8E3Ea0B48F4FB959Ab07ff433
```

## Verification

```bash
# export CONTRACT_ADDRESS=xxxxxxxxx
npx hardhat verify --network bscTestnet $CONTRACT_ADDRESS Fees42 FE42 1000000 10 2
# Successfully submitted source code for contract
# contracts/TokenWithFees.sol:TokenWithFees at 0x9C51dA027FB74eB8E3Ea0B48F4FB959Ab07ff433
# for verification on the block explorer. Waiting for verification result...

# Successfully verified contract TokenWithFees on the block explorer.
# https://testnet.bscscan.com/address/0x9C51dA027FB74eB8E3Ea0B48F4FB959Ab07ff433#code
```