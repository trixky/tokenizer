# tokenizer

## My choices

- I chose Hardhat for the development plateform. Hardhat is one of the most modern tools alongside Foundry, but I prefer Hardhat because it feels more complete, especially when it comes to testing features.
- I chose the BNB blockchain over Ethereum because, even though the project runs on the testnet, you often need some real coins on the mainnet for faucets to release testnet tokens. Plus, BNB has very low transaction fees compared to Ethereum.
- I chose Etherscan to verify my smart-contract with multi API keys because it’s the most well-known explorer and supports the new, recommended way of managing multiple API keys efficiently.
- I chose Hardhat’s new “Ignition” deployment system to stay up-to-date with the latest best practices, instead of using the older manual scripting methods.
- I used TypeScript in Hardhat instead of just JavaScript for obvious clarity reasons, and because I’m more efficient working with TypeScript.
-I chose to start my smart contracts from these three contracts, which are only standards/conventions/interfaces to ensure I implement the basic methods required to comply with ERC-20 and BEP-20. This is a good practice to guarantee compatibility and follow widely accepted standards.
```solidity
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
```

## Result

Smart-contract address: 0x9C51dA027FB74eB8E3Ea0B48F4FB959Ab07ff433

> Check https://testnet.bscscan.com/address/0x9C51dA027FB74eB8E3Ea0B48F4FB959Ab07ff433#code