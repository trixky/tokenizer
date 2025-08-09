# Déploiement du Contrat Fees

Ce dossier contient les scripts de déploiement pour le contrat `TokenWithFees` avec différentes approches.

## 🚀 Méthode Recommandée : Hardhat Ignition

Hardhat Ignition est la méthode moderne et recommandée pour gérer les déploiements.

### Déploiement avec Ignition


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

# TokenWithFeesModule#TokenWithFees - 0x88383483a9dB22BB88CdaC637f9F8aA8A3E66c66
```

Go to the [bsc scan testnset](https://testnet.bscscan.com/).


### Avantages d'Ignition :
- ✅ Gestion automatique des dépendances entre contrats
- ✅ Replay des déploiements
- ✅ Historique des déploiements
- ✅ Paramètres configurables
- ✅ Plus robuste que les scripts simples

## Configuration

### Fichier config.json
```json
{
  "tokenName": "MonToken",
  "tokenSymbol": "MTK",
  "totalSupply": 1000000,
  "percentageFees": 5,
  "minimumSignatures": 2
}
```

### Paramètres
- `tokenName` : Nom du token
- `tokenSymbol` : Symbole du token (3-4 caractères)
- `totalSupply` : Supply total (sera multiplié par 10^18)
- `percentageFees` : Pourcentage de frais (0-100)
- `minimumSignatures` : Nombre minimum de signatures pour les propositions

## Autres Options de Déploiement

### Script Simple (Paramètres Hardcodés)
```bash
npx hardhat run scripts/deploy-fees.ts --network bscTestnet
```

### Script avec Variables d'Environnement
```bash
# Définir les variables d'environnement
export TOKEN_NAME="MonToken"
export TOKEN_SYMBOL="MTK"
export TOTAL_SUPPLY=1000000
export PERCENTAGE_FEES=5
export MINIMUM_SIGNATURES=2

# Déployer
npx hardhat run scripts/deploy-fees-config.ts --network bscTestnet
```

## Résultat

Après déploiement, un fichier `deployment-info.json` sera créé avec :
- Adresse du contrat déployé
- Paramètres utilisés
- Date de déploiement
- Réseau utilisé

## Vérification

Pour vérifier le déploiement :
```bash
npx hardhat verify --network bscTestnet <ADRESSE_CONTRAT> "Nom" "Symbole" 1000000 5 2
```

## Note Importante

**NE PAS** créer un troisième contrat qui hérite de `Fees` avec des paramètres hardcodés. Cette approche :
- Rend le code moins flexible
- Augmente la complexité
- Crée des problèmes de maintenance
- N'est pas une bonne pratique

Utilisez plutôt Hardhat Ignition ou les scripts de déploiement avec des paramètres configurables.


```bash
 npx hardhat verify --network bscTestnet 0x88383483a9dB22BB88CdaC637f9F8aA8A3E66c66 Fees42 FE42 1000000 5 2
# Successfully submitted source code for contract
# contracts/TokenWithFees.sol:TokenWithFees at 0x88383483a9dB22BB88CdaC637f9F8aA8A3E66c66
# for verification on the block explorer. Waiting for verification result...

# Successfully verified contract TokenWithFees on the block explorer.
# https://testnet.bscscan.com/address/0x88383483a9dB22BB88CdaC637f9F8aA8A3E66c66#code

# hardhat-verify found one or more errors during the verification process:

# Sourcify:
# Failed to send contract verification request.
# Endpoint URL: https://sourcify.dev/server
# The HTTP server response is not ok. Status code: 400 Response text: {"error":"Invalid or missing sources in TokenWithFees:\nMissing sources: contracts/ERC20.sol\nInvalid sources: ","message":"Invalid or missing sources in TokenWithFees:\nMissing sources: contracts/ERC20.sol\nInvalid sources: "}
```