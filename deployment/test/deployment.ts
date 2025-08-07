import {
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { deployFeesFixture, TOTAL_SUPPLY, NAME, SYMBOL, PERCENTAGE_FEES, MINIMUM_SIGNATURES } from "./main";

describe("Deployment", function () {
  it("Should set the right name", async function () {
    // Load the deployed contract fixture
    const { fees } = await loadFixture(deployFeesFixture);

    // Verify that the contract name matches the expected NAME constant
    expect(await fees.name()).to.equal(NAME);
  });

  it("Should set the right symbol", async function () {
    // Load the deployed contract fixture
    const { fees } = await loadFixture(deployFeesFixture);

    // Verify that the contract symbol matches the expected SYMBOL constant
    expect(await fees.symbol()).to.equal(SYMBOL);
  });

  it("Should set the right decimals", async function () {
    // Load the deployed contract fixture
    const { fees } = await loadFixture(deployFeesFixture);

    // Verify that the contract has 18 decimals (standard for ERC20 tokens)
    expect(await fees.decimals()).to.equal(18);
  });

  it("Should set the right percentage fees", async function () {
    // Load the deployed contract fixture
    const { fees } = await loadFixture(deployFeesFixture);

    // Verify that the fee percentage matches the expected PERCENTAGE_FEES constant
    expect(await fees.percentageFees()).to.equal(PERCENTAGE_FEES);
  });

  it("Should set the right minimum signatures", async function () {
    // Load the deployed contract fixture
    const { fees } = await loadFixture(deployFeesFixture);

    // Verify that the minimum signatures for proposals matches the expected MINIMUM_SIGNATURES constant
    expect(await fees.getMinimumSignatures()).to.equal(MINIMUM_SIGNATURES);
  });

  it("Should set the right owner as super admin", async function () {
    // Load the deployed contract fixture with owner and test account
    const { fees, owner, account1 } = await loadFixture(deployFeesFixture);

    // Test isOwner function - verify owner is recognized as owner
    expect(await fees.isOwner(owner.address)).to.be.true;
    // Test isOwner function - verify account1 is not recognized as owner
    expect(await fees.isOwner(account1.address)).to.be.false;

    // Test isAdmin function - verify owner is recognized as admin
    expect(await fees.isAdmin(owner.address)).to.be.true;
    // Test isAdmin function - verify account1 is not recognized as admin initially
    expect(await fees.isAdmin(account1.address)).to.be.false;

    // Note: You'll need to add a getter for _superAdmin or test through admin functions
    // For now, we'll test that the owner can add an admin (which requires super admin privileges)
    // If this succeeds, it means the owner is the super admin
    await fees.addAdmin(account1.address);
    // If this succeeds, it means the owner is the super admin
  });

  it("Should initialize collected fees to zero", async function () {
    // Load the deployed contract fixture
    const { fees } = await loadFixture(deployFeesFixture);

    // Verify that the collected fees start at zero
    expect(await fees.getCollectedFees()).to.equal(0);
  });

  // --------------------------------- Initial mint
  describe("Initial mint", function () {
    it("Should set the right total supply", async function () {
      // Load the deployed contract fixture
      const { fees } = await loadFixture(deployFeesFixture);
      // Get the contract's decimal places
      const decimals = await fees.decimals();
      // Calculate the total supply with proper decimal places
      const totalSupply = TOTAL_SUPPLY * BigInt(10) ** decimals;
      // Verify that the contract's total supply matches the calculated value
      expect(await fees.totalSupply()).to.equal(totalSupply);
    });

    it("Should set the owner balance to the total supply", async function () {
      // Load the deployed contract fixture with owner account
      const { fees, owner } = await loadFixture(deployFeesFixture);
      // Get the contract's decimal places
      const decimals = await fees.decimals();
      // Calculate the total supply with proper decimal places
      const totalSupply = TOTAL_SUPPLY * BigInt(10) ** decimals;
      // Verify that the owner's balance equals the total supply (all tokens minted to owner)
      expect(await fees.balanceOf(owner.address)).to.equal(totalSupply);
    });
  });
});
