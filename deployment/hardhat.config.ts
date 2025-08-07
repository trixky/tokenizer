import "@nomicfoundation/hardhat-toolbox";

// Ensure your configuration variables are set before executing the script
const { vars } = require("hardhat/config");

// Go to https://infura.io, sign up, create a new API key
// in its dashboard, and add it to the configuration variables
// const INFURA_API_KEY = vars.get("INFURA_API_KEY");

// Add your Sepolia account private key to the configuration variables
// To export your private key from Coinbase Wallet, go to
// Settings > Developer Settings > Show private key
// To export your private key from Metamask, open Metamask and
// go to Account Details > Export Private Key
// Beware: NEVER put real Ether into testing accounts
// const SEPOLIA_PRIVATE_KEY = vars.get("SEPOLIA_PRIVATE_KEY");
// const SEPOLIA_PRIVATE_KEY = vars.get("7bbd89d102b9a2b1103a9454ca726a15221263d0d1a159e0eff5aa4ff2cdfb88");


module.exports = {
  solidity: "0.8.28",
  networks: {
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/C9MKTW8ZzgYewi2JWKY58`,
      accounts: ["7bbd89d102b9a2b1103a9454ca726a15221263d0d1a159e0eff5aa4ff2cdfb88"],
    },
    bnb: {
      url: `https://bnb-mainnet.g.alchemy.com/v2/YAFZrTyNiqev9nXbM4LQt`,
      accounts: ["7bbd89d102b9a2b1103a9454ca726a15221263d0d1a159e0eff5aa4ff2cdfb88"],
    },
  },
};