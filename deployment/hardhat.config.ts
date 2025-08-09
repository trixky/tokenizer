import "@nomicfoundation/hardhat-toolbox";
import { vars } from "hardhat/config";

// https://github.com/NomicFoundation/hardhat/tree/0a145098cd1f50f6b46fc17ae9a19d393c56d9d3/packages/hardhat-verify
import "@nomicfoundation/hardhat-verify";

module.exports = {
  solidity: "0.8.28",
  networks: {
    bscTestnet: {
      url: vars.get("ALCHEMY_URL"),
      accounts: [vars.get("PRIVATE_KEY")],
    },
  },
  etherscan: {
    apiKey: vars.get("ETHERSCAN_API_KEY"),
    customChains: [
      {
        network: "bscTestnet",
        chainId: 97,
        urls: {
          apiURL: "https://api-testnet.bscscan.com/api",
          browserURL: "https://testnet.bscscan.com"
        }
      }
    ]
  },
  sourcify: {
    enabled: true
  }
};