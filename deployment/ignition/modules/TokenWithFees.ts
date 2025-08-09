// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import config from "../../config.json";

const {
  tokenName,
  tokenSymbol,
  totalSupply,
  percentageFees,
  minimumSignatures
} = config;

const TokenWithFeesModule = buildModule("TokenWithFeesModule", (m) => {
  // Paramètres du constructeur avec valeurs par défaut
  const name = m.getParameter("name", tokenName);
  const symbol = m.getParameter("symbol", tokenSymbol);
  const totalSupplyParam = m.getParameter("totalSupply", totalSupply);
  const percentageFeesParam = m.getParameter("percentageFees", percentageFees);
  const minimumSignaturesParam = m.getParameter("minimumSignatures", minimumSignatures);

  // Déploiement du contrat TokenWithFees
  const tokenWithFees = m.contract("TokenWithFees", [
    name,
    symbol,
    totalSupplyParam,
    percentageFeesParam,
    minimumSignaturesParam
  ]);

  return { tokenWithFees };
});

export default TokenWithFeesModule;
