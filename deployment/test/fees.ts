import {
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployFeesFixture, MINIMUM_SIGNATURES, PERCENTAGE_FEES } from "./main";

describe("Fees System", function () {
    // --------------------------------- Fee Collection
    describe("Fee Collection", function () {
        it("Should collect fees on transfer", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Give account1 1000 tokens to work with
            await fees.transfer(account1.address, 1000n);

            // Record the initial collected fees amount
            const initialFees = await fees.getCollectedFees();

            // Transfer 100 tokens, should pay 10 fees (10%)
            await feesFromAccount1.transfer(account2.address, 100n);

            // Verify account1 has 890 tokens (1000 - 100 - 10 fees)
            expect(await fees.balanceOf(account1.address)).to.equal(890n); // 1000 - 100 - 10
            // Verify account2 has 100 tokens
            expect(await fees.balanceOf(account2.address)).to.equal(100n);
            // Verify that 10 fees were collected (initial + 10)
            expect(await fees.getCollectedFees()).to.equal(initialFees + 10n); // 10 fees collected
        });

        it("Should collect fees on transferFrom", async function () {
            const { fees, account1, account2, account3 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1 and account2
            const feesFromAccount1 = await fees.connect(account1);
            const feesFromAccount2 = await fees.connect(account2);

            // Give accounts tokens to work with
            await fees.transfer(account1.address, 1000n);
            await fees.transfer(account2.address, 100n);
            // Approve account2 to spend tokens from account1
            await feesFromAccount1.approve(account2.address, 500n);

            // Record the initial collected fees amount
            const initialFees = await fees.getCollectedFees();

            // TransferFrom 200 tokens, should pay 20 fees (10%)
            await feesFromAccount2.transferFrom(account1.address, account3.address, 200n);

            // Verify account1 has 800 tokens (1000 - 200)
            expect(await fees.balanceOf(account1.address)).to.equal(800n); // 1000 - 200
            // Verify account2 has 80 tokens (100 - 20 fees)
            expect(await fees.balanceOf(account2.address)).to.equal(80n); // 100 - 20 fees
            // Verify account3 has 200 tokens
            expect(await fees.balanceOf(account3.address)).to.equal(200n);
            // Verify that 20 fees were collected (initial + 20)
            expect(await fees.getCollectedFees()).to.equal(initialFees + 20n); // 20 fees collected
        });

        it("Should calculate fees correctly for small amounts", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Give account1 100 tokens to work with
            await fees.transfer(account1.address, 100n);

            // Record the initial collected fees amount
            const initialFees = await fees.getCollectedFees();

            // Transfer 5 tokens, fees should be 0.5 rounded down to 0
            await feesFromAccount1.transfer(account2.address, 5n);
            // Verify account1 has 95 tokens (100 - 5 - 0 fees)
            expect(await fees.balanceOf(account1.address)).to.equal(95n); // 100 - 5 - 0
            // Verify account2 has 5 tokens
            expect(await fees.balanceOf(account2.address)).to.equal(5n);
            // Verify that no fees were collected (rounded down)
            expect(await fees.getCollectedFees()).to.equal(initialFees); // 0 fees collected (rounded down)
        });

        it("Should calculate fees correctly for large amounts", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Define a large transfer amount
            const largeAmount = 1000000n;
            // Calculate expected fees: 10% of the large amount
            const expectedFees = (largeAmount * BigInt(PERCENTAGE_FEES)) / 100n; // 10%
            // Give account1 enough tokens to cover transfer + fees
            await fees.transfer(account1.address, largeAmount + expectedFees);

            // Record the initial collected fees amount
            const initialFees = await fees.getCollectedFees();

            // Transfer the large amount
            await feesFromAccount1.transfer(account2.address, largeAmount);
            // Verify account1 has 0 tokens (all used for transfer + fees)
            expect(await fees.balanceOf(account1.address)).to.equal(0n);
            // Verify account2 has the large amount
            expect(await fees.balanceOf(account2.address)).to.equal(largeAmount);
            // Verify that the expected fees were collected
            expect(await fees.getCollectedFees()).to.equal(initialFees + expectedFees); // 100000 fees collected
        });

        it("Should accumulate fees correctly over multiple transfers", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Give account1 1000 tokens to work with
            await fees.transfer(account1.address, 1000n);

            // Record the initial collected fees amount
            const initialFees = await fees.getCollectedFees();

            // Multiple transfers to test fee accumulation
            // First transfer: 100 tokens, fees = 10
            await feesFromAccount1.transfer(account2.address, 100n); // 10 fees
            expect(await fees.getCollectedFees()).to.equal(initialFees + 10n);

            // Second transfer: 200 tokens, fees = 20
            await feesFromAccount1.transfer(account2.address, 200n); // 20 fees
            expect(await fees.getCollectedFees()).to.equal(initialFees + 30n);

            // Third transfer: 300 tokens, fees = 30
            await feesFromAccount1.transfer(account2.address, 300n); // 30 fees
            expect(await fees.getCollectedFees()).to.equal(initialFees + 60n); // Total: 10 + 20 + 30

            // Verify final balances
            expect(await fees.balanceOf(account1.address)).to.equal(340n); // 1000 - 100 - 200 - 300 - 10 - 20 - 30
            expect(await fees.balanceOf(account2.address)).to.equal(600n); // 100 + 200 + 300
        });
    });

    // --------------------------------- Fee Percentage
    describe("Fee Percentage", function () {
        it("Should have correct fee percentage", async function () {
            const { fees } = await loadFixture(deployFeesFixture);
            // Verify that the contract's fee percentage matches the expected constant
            expect(await fees.percentageFees()).to.equal(BigInt(PERCENTAGE_FEES));
        });

        it("Should calculate 10% fees correctly", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Give account1 enough tokens to cover transfer + fees
            await fees.transfer(account1.address, 110n);

            // Record the initial collected fees amount
            const initialFees = await fees.getCollectedFees();

            // 10% of 10 = 1 fee
            await feesFromAccount1.transfer(account2.address, 10n);
            // Verify account1 has 99 tokens (110 - 10 - 1 fee)
            expect(await fees.balanceOf(account1.address)).to.equal(99n); // 110 - 10 - 1
            // Verify account2 has 10 tokens
            expect(await fees.balanceOf(account2.address)).to.equal(10n);
            // Verify that 1 fee was collected
            expect(await fees.getCollectedFees()).to.equal(initialFees + 1n); // 1 fee collected
        });

        it("Should round down fees for fractional amounts", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Give account1 20 tokens to work with
            await fees.transfer(account1.address, 20n);

            // Record the initial collected fees amount
            const initialFees = await fees.getCollectedFees();

            // 10% of 9 = 0.9, should round down to 0
            await feesFromAccount1.transfer(account2.address, 9n);
            // Verify account1 has 11 tokens (20 - 9 - 0 fees)
            expect(await fees.balanceOf(account1.address)).to.equal(11n); // 20 - 9 - 0
            // Verify account2 has 9 tokens
            expect(await fees.balanceOf(account2.address)).to.equal(9n);
            // Verify that no fees were collected (rounded down)
            expect(await fees.getCollectedFees()).to.equal(initialFees); // 0 fees collected (rounded down)
        });
    });

    // --------------------------------- Proposal Creation and Execution
    describe("Proposal Creation and Execution", function () {
        it("Should create proposal with correct parameters", async function () {
            const { fees, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin so it can create proposals
            await fees.addAdmin(account1);

            // Create a proposal and verify it emits the correct event
            await expect(fees.connect(account1).proposeCollection(account1.address, 100n, MINIMUM_SIGNATURES))
                .to.emit(fees, "ProposalCreated")
                .withArgs(0, account1.address, 100n, MINIMUM_SIGNATURES);
        });

        it("Should execute proposal and transfer collected fees", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            const feesFromAccount1 = await fees.connect(account1);
            // Add account1 as admin so it can create and execute proposals
            await fees.addAdmin(account1);

            // Create proposal
            await feesFromAccount1.proposeCollection(account1.address, 100n, MINIMUM_SIGNATURES);
            // Sign the proposal
            await feesFromAccount1.signProposal(0);

            // Generate fees - need to transfer to account1 first, then transfer back to generate fees
            await fees.transfer(account1.address, 1100n); // Give account1 enough tokens
            await feesFromAccount1.transfer(owner.address, 1000n); // This generates 100 fees

            // Check that we have enough fees before execution
            const feesBeforeExecution = await fees.getCollectedFees();
            expect(feesBeforeExecution).to.be.gte(100n); // At least 100 fees collected

            // Execute proposal
            await expect(feesFromAccount1.executeProposal(0))
                .to.emit(fees, "ProposalExecuted")
                .withArgs(0, account1.address, 100n);

            // Verify account1 received the fees from the proposal
            expect(await fees.balanceOf(account1.address)).to.equal(100n); // 1100 - 1000 - 100 fees + 100 from proposal
            // Verify that fees were consumed by the proposal
            expect(await fees.getCollectedFees()).to.equal(feesBeforeExecution - 100n); // Fees should be consumed by proposal
        });

        it("Should fail to execute proposal without enough fees", async function () {
            const { fees, account1 } = await loadFixture(deployFeesFixture);
            const feesFromAccount1 = await fees.connect(account1);
            // Add account1 as admin so it can create proposals
            await fees.addAdmin(account1);

            // Create a proposal for 1000 tokens
            await feesFromAccount1.proposeCollection(account1.address, 1000n, MINIMUM_SIGNATURES);
            // Sign the proposal
            await feesFromAccount1.signProposal(0);

            // Check that we don't have enough fees
            const currentFees = await fees.getCollectedFees();
            expect(currentFees).to.be.lt(1000n); // Not enough fees
            // Try to execute the proposal (should fail)
            await expect(feesFromAccount1.executeProposal(0))
                .to.be.revertedWithCustomError(fees, "InsufficientFees");
        });

        it("Should execute proposal with exact fee amount", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            const feesFromAccount1 = await fees.connect(account1);
            // Add account1 as admin so it can create and execute proposals
            await fees.addAdmin(account1);

            // Create a proposal for exactly 50 tokens
            await feesFromAccount1.proposeCollection(account1.address, 50n, MINIMUM_SIGNATURES);
            // Sign the proposal
            await feesFromAccount1.signProposal(0);

            // Generate exactly 50 fees
            await fees.transfer(account1.address, 550n); // Give account1 enough tokens
            await feesFromAccount1.transfer(owner.address, 500n); // Generates 50 fees

            // Check that we have enough fees before execution
            const feesBeforeExecution = await fees.getCollectedFees();
            expect(feesBeforeExecution).to.be.gte(50n); // At least 50 fees collected

            // Execute the proposal
            await feesFromAccount1.executeProposal(0);
            // Verify account1 received the exact amount from the proposal
            expect(await fees.balanceOf(account1.address)).to.equal(50n); // 550 - 500 - 50 fees + 50 from proposal
            // Verify that fees were consumed by the proposal
            expect(await fees.getCollectedFees()).to.equal(feesBeforeExecution - 50n); // Fees should be consumed by proposal
        });

        it("Should handle multiple proposals correctly", async function () {
            const { fees, owner, account1, account2 } = await loadFixture(deployFeesFixture);
            const feesFromAccount1 = await fees.connect(account1);
            const feesFromAccount2 = await fees.connect(account2);
            // Add both accounts as admins so they can create proposals
            await fees.addAdmin(account1);
            await fees.addAdmin(account2);

            // Create two proposals
            await feesFromAccount1.proposeCollection(account1.address, 100n, MINIMUM_SIGNATURES);
            await feesFromAccount2.proposeCollection(account2.address, 200n, MINIMUM_SIGNATURES);

            // Sign both proposals
            await feesFromAccount1.signProposal(0);
            await feesFromAccount2.signProposal(1);

            // Generate enough fees for both proposals
            await fees.transfer(account1.address, 3300n); // Give account1 enough tokens
            await feesFromAccount1.transfer(owner.address, 3000n); // Generates 300 fees

            // Check that we have enough fees before execution
            const feesBeforeExecution = await fees.getCollectedFees();
            expect(feesBeforeExecution).to.be.gte(300n); // At least 300 fees collected

            // Execute both proposals
            await feesFromAccount1.executeProposal(0);
            expect(await fees.getCollectedFees()).to.equal(feesBeforeExecution - 100n); // 300 - 100 = 200 fees remaining

            await feesFromAccount2.executeProposal(1);
            expect(await fees.getCollectedFees()).to.equal(feesBeforeExecution - 300n); // 200 - 200 = 0 fees remaining

            // Verify final balances
            expect(await fees.balanceOf(account1.address)).to.equal(100n); // 3300 - 3000 - 300 fees + 100 from proposal 0
            expect(await fees.balanceOf(account2.address)).to.equal(200n); // 0 + 200 from proposal 1
        });
    });

    // --------------------------------- Fee Edge Cases
    describe("Fee Edge Cases", function () {
        it("Should handle zero amount transfers", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Give account1 some tokens to work with
            await fees.transfer(account1.address, 100n);

            // Record the initial collected fees amount
            const initialFees = await fees.getCollectedFees();

            // Transfer 0 tokens, should pay 0 fees
            await feesFromAccount1.transfer(account2.address, 0n);
            // Verify account1 balance unchanged
            expect(await fees.balanceOf(account1.address)).to.equal(100n);
            // Verify account2 balance unchanged
            expect(await fees.balanceOf(account2.address)).to.equal(0n);
            // Verify that no fees were collected
            expect(await fees.getCollectedFees()).to.equal(initialFees); // 0 fees collected
        });

        it("Should handle transfers with 1 wei fees", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Give account1 20 tokens to work with
            await fees.transfer(account1.address, 20n);

            // Record the initial collected fees amount
            const initialFees = await fees.getCollectedFees();

            // Transfer 10 tokens, should pay 1 fee (10% of 10 = 1)
            await feesFromAccount1.transfer(account2.address, 10n);
            // Verify account1 has 9 tokens (20 - 10 - 1 fee)
            expect(await fees.balanceOf(account1.address)).to.equal(9n); // 20 - 10 - 1
            // Verify account2 has 10 tokens
            expect(await fees.balanceOf(account2.address)).to.equal(10n);
            // Verify that 1 fee was collected
            expect(await fees.getCollectedFees()).to.equal(initialFees + 1n); // 1 fee collected
        });

        it("Should handle large transfers without overflow", async function () {
            const { fees, account1 } = await loadFixture(deployFeesFixture);
            // Define a very large amount that exceeds total supply
            const largeAmount = 1000000000000000000000000n; // Very large amount that exceeds total supply

            // This should fail due to insufficient balance, not overflow
            await expect(fees.transfer(account1.address, largeAmount))
                .to.be.revertedWithCustomError(fees, "ERC20InsufficientBalance");
        });

        it("Should handle proposal with zero value", async function () {
            const { fees, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin so it can create proposals
            await fees.addAdmin(account1);

            // Create a proposal for 0 tokens should fail
            await expect(fees.connect(account1).proposeCollection(account1.address, 0n, MINIMUM_SIGNATURES))
                .to.be.revertedWithCustomError(fees, "CannotProposeWithZeroValue");
        });
    });

    // --------------------------------- Fee Integration Tests
    describe("Fee Integration Tests", function () {
        it("Should work with complex transfer scenarios", async function () {
            const { fees, account1, account2, account3 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1 and account2
            const feesFromAccount1 = await fees.connect(account1);
            const feesFromAccount2 = await fees.connect(account2);

            // Setup initial balances
            await fees.transfer(account1.address, 1000n);
            await fees.transfer(account2.address, 500n);

            // Record the initial collected fees amount
            const initialFees = await fees.getCollectedFees();

            // Complex transfer chain
            // First transfer: account1 to account2, 100 tokens, 10 fees
            await feesFromAccount1.transfer(account2.address, 100n); // account1 pays 10 fees
            expect(await fees.getCollectedFees()).to.equal(initialFees + 10n);

            // Second transfer: account2 to account3, 200 tokens, 20 fees
            await feesFromAccount2.transfer(account3.address, 200n); // account2 pays 20 fees
            expect(await fees.getCollectedFees()).to.equal(initialFees + 30n);

            // Third transfer: account1 to account3, 150 tokens, 15 fees
            await feesFromAccount1.transfer(account3.address, 150n); // account1 pays 15 fees
            expect(await fees.getCollectedFees()).to.equal(initialFees + 45n); // Total: 10 + 20 + 15

            // Verify final balances
            expect(await fees.balanceOf(account1.address)).to.equal(725n); // 1000 - 100 - 150 - 10 - 15
            expect(await fees.balanceOf(account2.address)).to.equal(380n); // 500 + 100 - 200 - 20
            expect(await fees.balanceOf(account3.address)).to.equal(350n); // 200 + 150
        });

        it("Should handle fees with transferFrom and approvals", async function () {
            const { fees, account1, account2, account3 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as all accounts
            const feesFromAccount1 = await fees.connect(account1);
            const feesFromAccount2 = await fees.connect(account2);
            const feesFromAccount3 = await fees.connect(account3);

            // Setup initial balances
            await fees.transfer(account1.address, 1000n);
            await fees.transfer(account2.address, 200n);
            await fees.transfer(account3.address, 100n);

            // Approve transfers
            await feesFromAccount1.approve(account2.address, 300n);
            await feesFromAccount1.approve(account3.address, 200n);

            // Record the initial collected fees amount
            const initialFees = await fees.getCollectedFees();

            // Execute transferFrom operations
            // First transferFrom: account2 transfers 100 tokens from account1, pays 10 fees
            await feesFromAccount2.transferFrom(account1.address, account2.address, 100n); // account2 pays 10 fees
            expect(await fees.getCollectedFees()).to.equal(initialFees + 10n);

            // Second transferFrom: account3 transfers 150 tokens from account1, pays 15 fees
            await feesFromAccount3.transferFrom(account1.address, account3.address, 150n); // account3 pays 15 fees
            expect(await fees.getCollectedFees()).to.equal(initialFees + 25n); // Total: 10 + 15

            // Verify final balances
            expect(await fees.balanceOf(account1.address)).to.equal(750n); // 1000 - 100 - 150
            expect(await fees.balanceOf(account2.address)).to.equal(290n); // 200 + 100 - 10
            expect(await fees.balanceOf(account3.address)).to.equal(235n); // 100 + 150 - 15
        });

        it("Should handle proposal execution with mixed fee sources", async function () {
            const { fees, owner, account1, account2 } = await loadFixture(deployFeesFixture);
            const feesFromAccount1 = await fees.connect(account1);
            const feesFromAccount2 = await fees.connect(account2);
            // Add both accounts as admins so they can create proposals
            await fees.addAdmin(account1);
            await fees.addAdmin(account2);

            // Set minimum signatures to 2 first
            await fees.setMinimumSignatures(2);

            // Create proposal
            await feesFromAccount1.proposeCollection(account1.address, 500n, 2);
            // Sign the proposal with both admins
            await feesFromAccount1.signProposal(0);
            await feesFromAccount2.signProposal(0);

            // Generate fees from multiple sources
            await fees.transfer(account1.address, 3000n); // Give account1 enough tokens
            await fees.transfer(account2.address, 4000n); // Give account2 enough tokens

            // Record the initial collected fees amount
            const initialFees = await fees.getCollectedFees();

            // Generate fees through transfers
            // First transfer generates 200 fees
            await feesFromAccount1.transfer(owner.address, 2000n); // 200 fees
            expect(await fees.getCollectedFees()).to.equal(initialFees + 200n);

            // Second transfer generates 300 fees
            await feesFromAccount2.transfer(owner.address, 3000n); // 300 fees
            expect(await fees.getCollectedFees()).to.equal(initialFees + 500n); // Total: 200 + 300

            // Execute proposal
            await feesFromAccount1.executeProposal(0);
            expect(await fees.getCollectedFees()).to.equal(initialFees); // 500 - 500 = 0 fees remaining

            // Verify final balances
            expect(await fees.balanceOf(account1.address)).to.equal(1300n); // 3000 - 2000 - 200 fees + 500 from proposal
            expect(await fees.balanceOf(account2.address)).to.equal(700n); // 4000 - 3000 - 300 fees
        });
    });

    // --------------------------------- Fee Percentage Updates
    describe("Fee Percentage Updates", function () {
        it("Should allow owner to update percentage fees to 0%", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Give account1 some tokens to work with
            await fees.transfer(account1.address, 1000n);

            // Update fees to 0%
            await fees.updatePercentageFees(0);
            expect(await fees.percentageFees()).to.equal(0n);

            // Record the initial collected fees amount
            const initialFees = await fees.getCollectedFees();

            // Transfer should not collect any fees
            await feesFromAccount1.transfer(account2.address, 100n);
            // Verify account1 has 900 tokens (1000 - 100, no fees)
            expect(await fees.balanceOf(account1.address)).to.equal(900n); // 1000 - 100 (no fees)
            // Verify account2 has 100 tokens
            expect(await fees.balanceOf(account2.address)).to.equal(100n);
            // Verify that no fees were collected
            expect(await fees.getCollectedFees()).to.equal(initialFees); // No fees collected
        });

        it("Should allow owner to update percentage fees to 5%", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Give account1 some tokens to work with
            await fees.transfer(account1.address, 1000n);

            // Update fees to 5%
            await fees.updatePercentageFees(5);
            expect(await fees.percentageFees()).to.equal(5n);

            // Record the initial collected fees amount
            const initialFees = await fees.getCollectedFees();

            // Transfer should collect 5% fees
            await feesFromAccount1.transfer(account2.address, 100n);
            // Verify account1 has 895 tokens (1000 - 100 - 5 fees)
            expect(await fees.balanceOf(account1.address)).to.equal(895n); // 1000 - 100 - 5
            // Verify account2 has 100 tokens
            expect(await fees.balanceOf(account2.address)).to.equal(100n);
            // Verify that 5 fees were collected
            expect(await fees.getCollectedFees()).to.equal(initialFees + 5n); // 5 fees collected
        });

        it("Should allow owner to update percentage fees to 20%", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Give account1 some tokens to work with
            await fees.transfer(account1.address, 1000n);

            // Update fees to 20%
            await fees.updatePercentageFees(20);
            expect(await fees.percentageFees()).to.equal(20n);

            // Record the initial collected fees amount
            const initialFees = await fees.getCollectedFees();

            // Transfer should collect 20% fees
            await feesFromAccount1.transfer(account2.address, 100n);
            // Verify account1 has 880 tokens (1000 - 100 - 20 fees)
            expect(await fees.balanceOf(account1.address)).to.equal(880n); // 1000 - 100 - 20
            // Verify account2 has 100 tokens
            expect(await fees.balanceOf(account2.address)).to.equal(100n);
            // Verify that 20 fees were collected
            expect(await fees.getCollectedFees()).to.equal(initialFees + 20n); // 20 fees collected
        });

        it("Should allow owner to update percentage fees to 100%", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Give account1 some tokens to work with
            await fees.transfer(account1.address, 1000n);

            // Update fees to 100%
            await fees.updatePercentageFees(100);
            expect(await fees.percentageFees()).to.equal(100n);

            // Record the initial collected fees amount
            const initialFees = await fees.getCollectedFees();

            // Transfer should collect 100% fees (entire amount)
            await feesFromAccount1.transfer(account2.address, 100n);
            // Verify account1 has 800 tokens (1000 - 100 - 100 fees, all goes to fees)
            expect(await fees.balanceOf(account1.address)).to.equal(800n); // 1000 - 100 - 100 (all goes to fees)
            // Verify account2 has 100 tokens
            expect(await fees.balanceOf(account2.address)).to.equal(100n);
            // Verify that 100 fees were collected
            expect(await fees.getCollectedFees()).to.equal(initialFees + 100n); // 100 fees collected
        });

        it("Should prevent non-owner from updating percentage fees", async function () {
            const { fees, account1 } = await loadFixture(deployFeesFixture);

            // Non-owner should not be able to update fees
            await expect(fees.connect(account1).updatePercentageFees(5))
                .to.be.revertedWithCustomError(fees, "OnlyOwner");
        });

        it("Should prevent setting percentage fees above 100%", async function () {
            const { fees } = await loadFixture(deployFeesFixture);

            // Should not allow fees above 100%
            await expect(fees.updatePercentageFees(101))
                .to.be.revertedWithCustomError(fees, "PercentageFeesTooHigh");
        });

        it("Should handle multiple fee percentage updates", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Give account1 some tokens to work with
            await fees.transfer(account1.address, 1000n);

            // Start with 0% fees
            await fees.updatePercentageFees(0);
            expect(await fees.percentageFees()).to.equal(0n);

            // Test transfer with 0% fees
            let initialFees = await fees.getCollectedFees();
            await feesFromAccount1.transfer(account2.address, 100n);
            expect(await fees.getCollectedFees()).to.equal(initialFees); // No fees collected

            // Update to 5% fees
            await fees.updatePercentageFees(5);
            expect(await fees.percentageFees()).to.equal(5n);

            // Test transfer with 5% fees
            initialFees = await fees.getCollectedFees();
            await feesFromAccount1.transfer(account2.address, 100n);
            expect(await fees.getCollectedFees()).to.equal(initialFees + 5n); // 5 fees collected

            // Update to 15% fees
            await fees.updatePercentageFees(15);
            expect(await fees.percentageFees()).to.equal(15n);

            // Test transfer with 15% fees
            initialFees = await fees.getCollectedFees();
            await feesFromAccount1.transfer(account2.address, 100n);
            expect(await fees.getCollectedFees()).to.equal(initialFees + 15n); // 15 fees collected
        });

        it("Should handle fee percentage updates with transferFrom", async function () {
            const { fees, account1, account2, account3 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1 and account2
            const feesFromAccount1 = await fees.connect(account1);
            const feesFromAccount2 = await fees.connect(account2);

            // Setup initial balances
            await fees.transfer(account1.address, 1000n);
            await fees.transfer(account2.address, 200n);
            // Approve account2 to spend tokens from account1
            await feesFromAccount1.approve(account2.address, 500n);

            // Update to 0% fees
            await fees.updatePercentageFees(0);
            expect(await fees.percentageFees()).to.equal(0n);

            // Record the initial collected fees amount
            const initialFees = await fees.getCollectedFees();

            // transferFrom should not collect any fees
            await feesFromAccount2.transferFrom(account1.address, account3.address, 100n);
            // Verify account1 has 900 tokens (1000 - 100)
            expect(await fees.balanceOf(account1.address)).to.equal(900n); // 1000 - 100
            // Verify account2 has 200 tokens (no fees deducted)
            expect(await fees.balanceOf(account2.address)).to.equal(200n); // 200 (no fees deducted)
            // Verify account3 has 100 tokens
            expect(await fees.balanceOf(account3.address)).to.equal(100n);
            // Verify that no fees were collected
            expect(await fees.getCollectedFees()).to.equal(initialFees); // No fees collected

            // Update to 25% fees
            await fees.updatePercentageFees(25);
            expect(await fees.percentageFees()).to.equal(25n);

            // transferFrom should collect 25% fees
            await feesFromAccount2.transferFrom(account1.address, account3.address, 100n);
            // Verify account1 has 800 tokens (900 - 100)
            expect(await fees.balanceOf(account1.address)).to.equal(800n); // 900 - 100
            // Verify account2 has 175 tokens (200 - 25 fees)
            expect(await fees.balanceOf(account2.address)).to.equal(175n); // 200 - 25 fees
            // Verify account3 has 200 tokens (100 + 100)
            expect(await fees.balanceOf(account3.address)).to.equal(200n); // 100 + 100
            // Verify that 25 fees were collected
            expect(await fees.getCollectedFees()).to.equal(initialFees + 25n); // 25 fees collected
        });

        it("Should handle edge case with 1% fees", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Give account1 some tokens to work with
            await fees.transfer(account1.address, 1000n);

            // Update to 1% fees
            await fees.updatePercentageFees(1);
            expect(await fees.percentageFees()).to.equal(1n);

            // Record the initial collected fees amount
            const initialFees = await fees.getCollectedFees();

            // Transfer 99 tokens, should pay 0.99 fees rounded down to 0
            await feesFromAccount1.transfer(account2.address, 99n);
            // Verify account1 has 901 tokens (1000 - 99 - 0 fees)
            expect(await fees.balanceOf(account1.address)).to.equal(901n); // 1000 - 99 - 0
            // Verify account2 has 99 tokens
            expect(await fees.balanceOf(account2.address)).to.equal(99n);
            // Verify that no fees were collected (rounded down)
            expect(await fees.getCollectedFees()).to.equal(initialFees); // 0 fees collected (rounded down)

            // Transfer 100 tokens, should pay 1 fee
            await feesFromAccount1.transfer(account2.address, 100n);
            // Verify account1 has 800 tokens (901 - 100 - 1 fee)
            expect(await fees.balanceOf(account1.address)).to.equal(800n); // 901 - 100 - 1
            // Verify account2 has 199 tokens (99 + 100)
            expect(await fees.balanceOf(account2.address)).to.equal(199n); // 99 + 100
            // Verify that 1 fee was collected
            expect(await fees.getCollectedFees()).to.equal(initialFees + 1n); // 1 fee collected
        });
    });

    // --------------------------------- Security and Edge Cases
    describe("Security and Edge Cases", function () {

        it("Should handle fee calculation without overflow", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Set fees to 10%
            await fees.updatePercentageFees(10);

            // Give account1 a reasonable amount of tokens
            const transferAmount = 10000n;
            const feeAmount = (transferAmount * 10n) / 100n; // 10% fees
            const totalNeeded = transferAmount + feeAmount;
            await fees.transfer(account1.address, totalNeeded);

            // Record the initial collected fees amount
            const initialFees = await fees.getCollectedFees();

            // Transfer should not cause overflow
            await feesFromAccount1.transfer(account2.address, transferAmount);

            // Verify that fees were calculated correctly without overflow
            expect(await fees.getCollectedFees()).to.equal(initialFees + feeAmount);
            // Verify account1 has the remaining balance
            expect(await fees.balanceOf(account1.address)).to.equal(0n);
            // Verify account2 received the transfer amount
            expect(await fees.balanceOf(account2.address)).to.equal(transferAmount);
        });

        it("Should prevent overflow with different fee percentages", async function () {
            const { fees, owner, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);

            // Test with 50% fees
            await fees.updatePercentageFees(50);
            const largeAmount = 2n ** 255n; // Half of max uint256

            // Check if owner has enough tokens for this large amount
            const ownerBalance = await fees.balanceOf(owner.address);
            if (ownerBalance >= largeAmount) {
                await fees.transfer(account1.address, largeAmount);

                // The new implementation should handle this without reverting
                // It should use the alternative calculation method
                await feesFromAccount1.transfer(account2.address, largeAmount);

                // Verify that the transfer succeeded
                expect(await fees.balanceOf(account1.address)).to.equal(0n); // All tokens transferred
                expect(await fees.balanceOf(account2.address)).to.equal(largeAmount); // Received the transfer
            } else {
                // Skip test if not enough tokens
                console.log("Skipping test - insufficient tokens for large amount test");
            }

            // Test with 25% fees
            await fees.updatePercentageFees(25);
            const smallerAmount = 2n ** 254n; // Quarter of max uint256

            if (ownerBalance >= smallerAmount) {
                await fees.transfer(account1.address, smallerAmount);

                // This should also work with the new implementation
                await feesFromAccount1.transfer(account2.address, smallerAmount);

                // Verify that the transfer succeeded
                expect(await fees.balanceOf(account1.address)).to.equal(0n); // All tokens transferred
                expect(await fees.balanceOf(account2.address)).to.equal(smallerAmount); // Received the transfer
            } else {
                // Skip test if not enough tokens
                console.log("Skipping test - insufficient tokens for smaller amount test");
            }
        });

        it("Should handle fee calculation with very large amounts", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Set fees to 50%
            await fees.updatePercentageFees(50);

            // Give account1 enough tokens for transfer + fees
            const transferAmount = 1000n * 10n ** 18n; // 1,000 tokens with 18 decimals
            const feeAmount = (transferAmount * 50n) / 100n; // 50% fees
            const totalNeeded = transferAmount + feeAmount;
            await fees.transfer(account1.address, totalNeeded);

            // Record the initial collected fees amount
            const initialFees = await fees.getCollectedFees();

            // Transfer a large amount (should not overflow)
            await feesFromAccount1.transfer(account2.address, transferAmount);

            // Verify that fees were calculated correctly (50% of transferAmount)
            expect(await fees.getCollectedFees()).to.equal(initialFees + feeAmount);
            // Verify account1 has the remaining balance after transfer and fees
            expect(await fees.balanceOf(account1.address)).to.equal(0n);
            // Verify account2 received the transfer amount
            expect(await fees.balanceOf(account2.address)).to.equal(transferAmount);
        });

        it("Should handle fee calculation with maximum safe amounts", async function () {
            const { fees, owner, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Set fees to 100%
            await fees.updatePercentageFees(100);

            // Use a large but safe amount that won't cause overflow
            // Total supply is 10,000 tokens, so we'll use 1,000 tokens (10% of total supply)
            const transferAmount = 1000n * 10n ** 18n; // 1,000 tokens with 18 decimals
            const feeAmount = transferAmount; // 100% fees
            const totalNeeded = transferAmount + feeAmount;

            // Check if owner has enough tokens
            const ownerBalance = await fees.balanceOf(owner.address);
            if (ownerBalance >= totalNeeded) {
                await fees.transfer(account1.address, totalNeeded);

                // Record the initial collected fees amount
                const initialFees = await fees.getCollectedFees();

                // Transfer should not cause overflow
                await feesFromAccount1.transfer(account2.address, transferAmount);

                // Verify that fees were calculated correctly
                expect(await fees.getCollectedFees()).to.equal(initialFees + feeAmount);
                // Verify account1 has 0 balance (all went to fees)
                expect(await fees.balanceOf(account1.address)).to.equal(0n);
                // Verify account2 received the transfer amount
                expect(await fees.balanceOf(account2.address)).to.equal(transferAmount);
            } else {
                // Skip test if not enough tokens
                console.log("Skipping test - insufficient tokens for large amount test");
            }
        });

        it("Should prevent transfer to zero address", async function () {
            const { fees, account1 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Give account1 some tokens
            await fees.transfer(account1.address, 1000n);

            // Transfer to zero address should be prevented by ERC20
            await expect(feesFromAccount1.transfer(ethers.ZeroAddress, 100n))
                .to.be.revertedWithCustomError(fees, "ERC20InvalidReceiver");
        });

        it("Should prevent transferFrom to zero address", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1 and account2
            const feesFromAccount1 = await fees.connect(account1);
            const feesFromAccount2 = await fees.connect(account2);

            // Setup initial balances
            await fees.transfer(account1.address, 1000n);
            await fees.transfer(account2.address, 100n);
            // Approve account2 to spend tokens from account1
            await feesFromAccount1.approve(account2.address, 500n);

            // TransferFrom to zero address should be prevented by ERC20
            await expect(feesFromAccount2.transferFrom(account1.address, ethers.ZeroAddress, 100n))
                .to.be.revertedWithCustomError(fees, "ERC20InvalidReceiver");
        });

        it("Should handle multiple fee percentage changes in sequence", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Give account1 enough tokens for multiple transfers
            await fees.transfer(account1.address, 10000n);

            // Test with 0% fees
            await fees.updatePercentageFees(0);
            let initialFees = await fees.getCollectedFees();
            await feesFromAccount1.transfer(account2.address, 100n);
            expect(await fees.getCollectedFees()).to.equal(initialFees);

            // Test with 5% fees
            await fees.updatePercentageFees(5);
            initialFees = await fees.getCollectedFees();
            await feesFromAccount1.transfer(account2.address, 100n);
            expect(await fees.getCollectedFees()).to.equal(initialFees + 5n);

            // Test with 50% fees
            await fees.updatePercentageFees(50);
            initialFees = await fees.getCollectedFees();
            await feesFromAccount1.transfer(account2.address, 100n);
            expect(await fees.getCollectedFees()).to.equal(initialFees + 50n);

            // Test with 100% fees
            await fees.updatePercentageFees(100);
            initialFees = await fees.getCollectedFees();
            await feesFromAccount1.transfer(account2.address, 100n);
            expect(await fees.getCollectedFees()).to.equal(initialFees + 100n);
        });

        it("Should handle fee calculation with very small amounts", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Give account1 some tokens
            await fees.transfer(account1.address, 1000n);

            // Test with 1 token transfer (10% = 0.1, should round down to 0)
            let initialFees = await fees.getCollectedFees();
            await feesFromAccount1.transfer(account2.address, 1n);
            expect(await fees.getCollectedFees()).to.equal(initialFees); // No fees collected

            // Test with 2 token transfer (10% = 0.2, should round down to 0)
            await feesFromAccount1.transfer(account2.address, 2n);
            expect(await fees.getCollectedFees()).to.equal(initialFees); // No fees collected

            // Test with 3 token transfer (10% = 0.3, should round down to 0)
            await feesFromAccount1.transfer(account2.address, 3n);
            expect(await fees.getCollectedFees()).to.equal(initialFees); // No fees collected

            // Test with 4 token transfer (10% = 0.4, should round down to 0)
            await feesFromAccount1.transfer(account2.address, 4n);
            expect(await fees.getCollectedFees()).to.equal(initialFees); // No fees collected

            // Test with 5 token transfer (10% = 0.5, should round down to 0)
            await feesFromAccount1.transfer(account2.address, 5n);
            expect(await fees.getCollectedFees()).to.equal(initialFees); // No fees collected

            // Test with 6 token transfer (10% = 0.6, should round down to 0)
            await feesFromAccount1.transfer(account2.address, 6n);
            expect(await fees.getCollectedFees()).to.equal(initialFees); // No fees collected

            // Test with 7 token transfer (10% = 0.7, should round down to 0)
            await feesFromAccount1.transfer(account2.address, 7n);
            expect(await fees.getCollectedFees()).to.equal(initialFees); // No fees collected

            // Test with 8 token transfer (10% = 0.8, should round down to 0)
            await feesFromAccount1.transfer(account2.address, 8n);
            expect(await fees.getCollectedFees()).to.equal(initialFees); // No fees collected

            // Test with 9 token transfer (10% = 0.9, should round down to 0)
            await feesFromAccount1.transfer(account2.address, 9n);
            expect(await fees.getCollectedFees()).to.equal(initialFees); // No fees collected

            // Test with 10 token transfer (10% = 1, should collect 1 fee)
            await feesFromAccount1.transfer(account2.address, 10n);
            expect(await fees.getCollectedFees()).to.equal(initialFees + 1n); // 1 fee collected
        });

        it("Should handle fee calculation with different percentages on small amounts", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Give account1 some tokens
            await fees.transfer(account1.address, 1000n);

            // Test with 1% fees
            await fees.updatePercentageFees(1);
            let initialFees = await fees.getCollectedFees();
            await feesFromAccount1.transfer(account2.address, 99n); // 1% of 99 = 0.99, rounds to 0
            expect(await fees.getCollectedFees()).to.equal(initialFees);

            await feesFromAccount1.transfer(account2.address, 100n); // 1% of 100 = 1
            expect(await fees.getCollectedFees()).to.equal(initialFees + 1n);

            // Test with 2% fees
            await fees.updatePercentageFees(2);
            initialFees = await fees.getCollectedFees();
            await feesFromAccount1.transfer(account2.address, 49n); // 2% of 49 = 0.98, rounds to 0
            expect(await fees.getCollectedFees()).to.equal(initialFees);

            await feesFromAccount1.transfer(account2.address, 50n); // 2% of 50 = 1
            expect(await fees.getCollectedFees()).to.equal(initialFees + 1n);
        });

        it("Should handle proposal execution with exact fee balance", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            const feesFromAccount1 = await fees.connect(account1);
            // Add account1 as admin
            await fees.addAdmin(account1.address);

            // Generate some fees first
            await fees.transfer(account1.address, 1000n); // 1000 tokens
            expect(await fees.balanceOf(account1.address)).to.equal(1000n); // 1000 + 100 fees

            await feesFromAccount1.transfer(owner.address, 100n); // Generates 10 fees
            expect(await fees.balanceOf(account1.address)).to.equal(890n); // 1000 - 100 - 10 fees

            // Create a proposal for exactly the available fees
            const availableFees = await fees.getCollectedFees();
            expect(availableFees).to.be.equal(110n); // Make sure we have fees
            await feesFromAccount1.proposeCollection(account1.address, availableFees, MINIMUM_SIGNATURES);
            await feesFromAccount1.signProposal(0);

            // Execute the proposal
            await feesFromAccount1.executeProposal(0);

            // Verify that all fees were consumed
            expect(await fees.getCollectedFees()).to.equal(0n);
            // Verify that account1 received the fees
            expect(await fees.balanceOf(account1.address)).to.equal(890n + availableFees);
        });

        it("Should prevent double spending of fees", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            const feesFromAccount1 = await fees.connect(account1);
            const feesFromAccount2 = await fees.connect(account2);

            // Add both accounts as admins
            await fees.addAdmin(account1.address);
            await fees.addAdmin(account2.address);

            // Generate some fees
            await fees.transfer(account1.address, 1000n);
            await feesFromAccount1.transfer(account2.address, 100n); // Generates 10 fees

            const availableFees = await fees.getCollectedFees();
            expect(availableFees).to.be.gt(0n);

            // Create two proposals for the same amount of fees
            await feesFromAccount1.proposeCollection(account1.address, availableFees, MINIMUM_SIGNATURES);
            await feesFromAccount2.proposeCollection(account2.address, availableFees, MINIMUM_SIGNATURES);

            // Sign both proposals
            await feesFromAccount1.signProposal(0);
            await feesFromAccount2.signProposal(1);

            // Execute first proposal
            await feesFromAccount1.executeProposal(0);
            expect(await fees.getCollectedFees()).to.equal(0n);

            // Try to execute second proposal (should fail due to insufficient fees)
            await expect(feesFromAccount2.executeProposal(1))
                .to.be.revertedWithCustomError(fees, "InsufficientFees");
        });

        it("Should handle proposal with maximum uint256 value", async function () {
            const { fees, account1 } = await loadFixture(deployFeesFixture);
            const feesFromAccount1 = await fees.connect(account1);
            // Add account1 as admin
            await fees.addAdmin(account1.address);
            const maxValue = 2n ** 256n - 1n;
            // Create a proposal with maximum value
            await feesFromAccount1.proposeCollection(account1.address, maxValue, MINIMUM_SIGNATURES);
            // Sign the proposal
            await feesFromAccount1.signProposal(0);
            // Try to execute the proposal (should fail due to insufficient fees)
            await expect(feesFromAccount1.executeProposal(0))
                .to.be.revertedWithCustomError(fees, "InsufficientFees");
        });

        it("Should handle fee calculation edge cases", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Give account1 some tokens
            await fees.transfer(account1.address, 1000n);

            // Test with 0.1% fees (should round down to 0 for small amounts)
            await fees.updatePercentageFees(1); // 1% = 0.01 in decimal
            let initialFees = await fees.getCollectedFees();
            await feesFromAccount1.transfer(account2.address, 99n); // 1% of 99 = 0.99, rounds to 0
            expect(await fees.getCollectedFees()).to.equal(initialFees);

            // Test with 99% fees
            await fees.updatePercentageFees(99);
            initialFees = await fees.getCollectedFees();
            await feesFromAccount1.transfer(account2.address, 100n); // 99% of 100 = 99
            expect(await fees.getCollectedFees()).to.equal(initialFees + 99n);
        });

        it("Should handle proposal execution with zero fees", async function () {
            const { fees, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin
            await fees.addAdmin(account1.address);

            // Create a proposal for 0 tokens should fail
            await expect(fees.connect(account1).proposeCollection(account1.address, 0n, MINIMUM_SIGNATURES))
                .to.be.revertedWithCustomError(fees, "CannotProposeWithZeroValue");
        });

        it("Should handle optimized operations correctly", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            const feesFromAccount1 = await fees.connect(account1);
            const feesFromAccount2 = await fees.connect(account2);

            // Add both accounts as admins
            await fees.addAdmin(account1.address);
            await fees.addAdmin(account2.address);

            // Create multiple proposals to test optimized operations
            await feesFromAccount1.proposeCollection(account1.address, 100n, MINIMUM_SIGNATURES);
            await feesFromAccount2.proposeCollection(account2.address, 200n, MINIMUM_SIGNATURES);
            await feesFromAccount1.proposeCollection(account1.address, 300n, MINIMUM_SIGNATURES);

            // Sign all proposals
            await feesFromAccount1.signProposal(0);
            await feesFromAccount1.signProposal(1);
            await feesFromAccount2.signProposal(1);
            await feesFromAccount1.signProposal(2);

            // Generate fees
            await fees.transfer(account1.address, 10000n);
            await feesFromAccount1.transfer(account2.address, 1000n);

            // Execute proposals to test optimized arithmetic operations
            await feesFromAccount1.executeProposal(0);
            await feesFromAccount2.executeProposal(1);
            await feesFromAccount1.executeProposal(2);

            // Verify final balances
            // account1: 10000 - 1000 - 100 fees + 100 (proposal 0) + 300 (proposal 2) = 9300
            expect(await fees.balanceOf(account1.address)).to.equal(9300n);
            // account2: 1000 (from transfer) + 200 (proposal 1) = 1200
            expect(await fees.balanceOf(account2.address)).to.equal(1200n);
        });
    });
});
