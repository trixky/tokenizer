import hre from "hardhat";

export const TOTAL_SUPPLY: bigint = BigInt(10000);
export const NAME = "TokenWithFees";
export const SYMBOL = "TKWF";
export const PERCENTAGE_FEES = 10;
export const MINIMUM_SIGNATURES = 1;

// We define a fixture to reuse the same setup in every test.
// We use loadFixture to run this setup once, snapshot that state,
// and reset Hardhat Network to that snapshot in every test.
export async function deployFeesFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, account1, account2, account3] = await hre.ethers.getSigners();

    const Fees = await hre.ethers.getContractFactory("TokenWithFees");
    const fees = await Fees.deploy(NAME, SYMBOL, TOTAL_SUPPLY, PERCENTAGE_FEES, MINIMUM_SIGNATURES);

    return { fees, owner, account1, account2, account3 };
}