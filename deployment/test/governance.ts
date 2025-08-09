import {
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { deployFeesFixture, MINIMUM_SIGNATURES } from "./main";

// Helper function to convert user units to internal units
async function toInternalUnits(fees: any, userValue: bigint): Promise<bigint> {
    const decimals = await fees.decimals();
    return userValue * BigInt(10) ** decimals;
}

// Helper function to generate fees for testing
async function generateFees(fees: any, owner: any, account1: any, amount: bigint = 100n): Promise<void> {
    const largeAmount = toInternalUnits(fees, 1000n);
    await fees.transfer(account1.address, largeAmount);
    await fees.connect(account1).transfer(owner.address, toInternalUnits(fees, amount));
}

describe("Governance", function () {
    // --------------------------------- Admin Management
    describe("Admin Management", function () {
        it("Should allow owner to add admin", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as an admin
            await fees.addAdmin(account1.address);
            // Test that account1 can now propose (which requires admin privileges)
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            // Verify that account1 is now recognized as an admin
            expect(await fees.isAdmin(account1.address)).to.equal(true);
        });

        it("Should allow owner to remove admin", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as an admin first
            await fees.addAdmin(account1.address);
            // Verify that account1 is recognized as an admin
            expect(await fees.isAdmin(account1.address)).to.equal(true);
            // Remove account1 as admin
            await fees.removeAdmin(account1.address);
            // Test that account1 can no longer propose (should fail)
            await expect(fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES))
                .to.be.revertedWithCustomError(fees, "OnlyAdmin");
            // Verify that account1 is no longer recognized as an admin
            expect(await fees.isAdmin(account1.address)).to.equal(false);
        });

        it("Should not allow non-owner to add admin", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Try to add account2 as admin from account1 (non-owner)
            await expect(fees.connect(account1).addAdmin(account2.address))
                .to.be.revertedWithCustomError(fees, "OnlyOwner");
            // Verify that account2 is not recognized as an admin
            expect(await fees.isAdmin(account2.address)).to.equal(false);
        });

        it("Should not allow non-owner to remove admin", async function () {
            const { fees, owner, account1, account2 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin first
            await fees.addAdmin(account1.address);
            // Try to remove account1 as admin from account2 (non-owner)
            await expect(fees.connect(account2).removeAdmin(account1.address))
                .to.be.revertedWithCustomError(fees, "OnlyOwner");
            // Verify that account1 is still recognized as an admin
            expect(await fees.isAdmin(account1.address)).to.equal(true);
        });
    });

    // --------------------------------- Minimum Signatures
    describe("Minimum Signatures", function () {
        it("Should allow owner to set minimum signatures", async function () {
            const { fees, owner } = await loadFixture(deployFeesFixture);
            // Set minimum signatures to 3
            await fees.setMinimumSignatures(3);
            // Test that we can propose with the new minimum
            await fees.proposeCollection(owner.address, await toInternalUnits(fees, 100n), 3);
            // Verify that the minimum signatures was updated
            expect(await fees.getMinimumSignatures()).to.equal(3);
        });

        it("Should not allow minimum signatures less than 1", async function () {
            const { fees } = await loadFixture(deployFeesFixture);
            // Try to set minimum signatures to 0 (should fail)
            await expect(fees.setMinimumSignatures(0))
                .to.be.revertedWithCustomError(fees, "MinimumSignaturesTooLow");
            // Verify that the minimum signatures remains unchanged
            expect(await fees.getMinimumSignatures()).to.equal(MINIMUM_SIGNATURES);
        });

        it("Should not allow non-owner to set minimum signatures", async function () {
            const { fees, account1 } = await loadFixture(deployFeesFixture);
            // Try to set minimum signatures from account1 (non-owner)
            await expect(fees.connect(account1).setMinimumSignatures(2))
                .to.be.revertedWithCustomError(fees, "OnlyOwner");
            // Verify that the minimum signatures remains unchanged
            expect(await fees.getMinimumSignatures()).to.equal(MINIMUM_SIGNATURES);
        });
    });

    // --------------------------------- Proposals
    describe("Proposals", function () {
        it("Should allow admin to create proposal", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin so it can create proposals
            await fees.addAdmin(account1.address);
            // Create a proposal and verify it emits the correct event
            const proposalValue = await toInternalUnits(fees, 100n);
            await expect(fees.connect(account1).proposeCollection(account1.address, proposalValue, MINIMUM_SIGNATURES))
                .to.emit(fees, "ProposalCreated")
                .withArgs(0, account1.address, proposalValue, MINIMUM_SIGNATURES);
            // Verify that account1 is recognized as an admin
            expect(await fees.isAdmin(account1.address)).to.equal(true);
        });

        it("Should not allow non-admin to create proposal", async function () {
            const { fees, account1 } = await loadFixture(deployFeesFixture);
            // Try to create a proposal from account1 (non-admin)
            const proposalValue = await toInternalUnits(fees, 100n);
            await expect(fees.connect(account1).proposeCollection(account1.address, proposalValue, MINIMUM_SIGNATURES))
                .to.be.revertedWithCustomError(fees, "OnlyAdmin");
            // Verify that account1 is not recognized as an admin
            expect(await fees.isAdmin(account1.address)).to.equal(false);
        });

        it("Should not allow proposal with minimum signatures higher than global minimum", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin so it can create proposals
            await fees.addAdmin(account1.address);
            // Try to create a proposal with minimum signatures higher than global minimum
            const proposalValue = await toInternalUnits(fees, 100n);
            await expect(fees.connect(account1).proposeCollection(account1.address, proposalValue, 2))
                .to.be.revertedWithCustomError(fees, "MinimumSignaturesTooHigh");
            // Verify that the global minimum signatures remains unchanged
            expect(await fees.getMinimumSignatures()).to.equal(MINIMUM_SIGNATURES);
        });

        it("Should not allow proposal with minimum signatures of 0", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin so it can create proposals
            await fees.addAdmin(account1.address);
            // Try to create a proposal with minimum signatures of 0 (should fail)
            await expect(fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), 0))
                .to.be.revertedWithCustomError(fees, "MinimumSignaturesTooLow");
        });
    });

    // --------------------------------- Proposal Signing
    describe("Proposal Signing", function () {
        it("Should allow admin to sign proposal", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin so it can create and sign proposals
            await fees.addAdmin(account1);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            // Sign the proposal and verify it emits the correct event
            await expect(fees.connect(account1).signProposal(0))
                .to.emit(fees, "ProposalSigned")
                .withArgs(0, account1.address);
            // Verify that account1 is recognized as an admin
            expect(await fees.isAdmin(account1.address)).to.equal(true);
        });

        it("Should not allow non-admin to sign proposal", async function () {
            const { fees, owner, account1, account2 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin so it can create proposals
            await fees.addAdmin(account1);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            // Try to sign the proposal from account2 (non-admin)
            await expect(fees.connect(account2).signProposal(0))
                .to.be.revertedWithCustomError(fees, "OnlyAdmin");
            // Verify that account1 is recognized as an admin
            expect(await fees.isAdmin(account1.address)).to.equal(true);
        });

        it("Should not allow signing already signed proposal", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin so it can create and sign proposals
            await fees.addAdmin(account1);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            // Sign the proposal once
            await fees.connect(account1).signProposal(0);
            // Try to sign the same proposal again (should fail)
            await expect(fees.connect(account1).signProposal(0))
                .to.be.revertedWithCustomError(fees, "ProposalAlreadySigned");
            // Verify that account1 is recognized as an admin
            expect(await fees.isAdmin(account1.address)).to.equal(true);
        });

        it("Should not allow signing executed proposal", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin so it can create and execute proposals
            await fees.addAdmin(account1);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            // Sign the proposal
            await fees.connect(account1).signProposal(0);
            // Generate some fees to execute the proposal
            await generateFees(fees, owner, account1);
            // Execute the proposal
            await fees.connect(account1).executeProposal(0);
            // Try to sign the executed proposal (should fail)
            await expect(fees.connect(account1).signProposal(0))
                .to.be.revertedWithCustomError(fees, "ProposalAlreadyExecuted");
            // Verify that account1 is recognized as an admin
            expect(await fees.isAdmin(account1.address)).to.equal(true);
        });

        it("Should not allow signing cancelled proposal", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin so it can create and cancel proposals
            await fees.addAdmin(account1);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            // Cancel the proposal
            await fees.connect(account1).cancelProposal(0);
            // Try to sign the cancelled proposal (should fail)
            await expect(fees.connect(account1).signProposal(0))
                .to.be.revertedWithCustomError(fees, "ProposalAlreadyCancelled");
            // Verify that account1 is recognized as an admin
            expect(await fees.isAdmin(account1.address)).to.equal(true);
        });
    });

    // --------------------------------- Proposal Execution
    describe("Proposal Execution", function () {
        it("Should allow admin to execute proposal with enough signatures and fees", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin so it can create and execute proposals
            await fees.addAdmin(account1);
            // Create a proposal
            const proposalValue = await toInternalUnits(fees, 100n);
            await fees.connect(account1).proposeCollection(account1.address, proposalValue, MINIMUM_SIGNATURES);
            // Sign the proposal
            await fees.connect(account1).signProposal(0);
            // Generate some fees by transferring tokens
            const largeAmount = await toInternalUnits(fees, 1000n);
            await fees.transfer(account1.address, largeAmount);
            const feesToTransfer = await toInternalUnits(fees, 100n);
            await fees.connect(account1).transfer(owner.address, feesToTransfer);
            // Execute the proposal and verify it emits the correct event
            await expect(fees.connect(account1).executeProposal(0))
                .to.emit(fees, "ProposalExecuted")
                .withArgs(0, account1.address, proposalValue);
            // account1 should have the proposal value plus remaining tokens minus fees
            const remainingTokens = await toInternalUnits(fees, 900n); // 1000 - 100 = 900 tokens remaining
            const feesPaid = await toInternalUnits(fees, 10n); // 100 * 10% = 10 fees
            const expectedBalance = proposalValue + remainingTokens - feesPaid;
            expect(await fees.balanceOf(account1.address)).to.equal(expectedBalance);
            // Verify that account1 is recognized as an admin
            expect(await fees.isAdmin(account1.address)).to.equal(true);
        });

        it("Should not allow non-admin to execute proposal", async function () {
            const { fees, owner, account1, account2 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin so it can create proposals
            await fees.addAdmin(account1);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            // Sign the proposal
            await fees.connect(account1).signProposal(0);
            // Try to execute the proposal from account2 (non-admin)
            await expect(fees.connect(account2).executeProposal(0))
                .to.be.revertedWithCustomError(fees, "OnlyAdmin");
            // Verify that account1 is recognized as an admin
            expect(await fees.isAdmin(account1.address)).to.equal(true);
        });

        it("Should not allow executing proposal without enough signatures", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin so it can create proposals
            await fees.addAdmin(account1);
            // Set minimum signatures to 2
            await fees.setMinimumSignatures(2);
            // Create a proposal requiring 2 signatures
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), 2);
            // Only sign once, need 2 signatures
            await fees.connect(account1).signProposal(0);
            // Try to execute the proposal without enough signatures (should fail)
            await expect(fees.connect(account1).executeProposal(0))
                .to.be.revertedWithCustomError(fees, "ProposalNotEnoughSignatures");
            // Verify that account1 is recognized as an admin
            expect(await fees.isAdmin(account1.address)).to.equal(true);
        });

        it("Should not allow executing proposal without enough fees", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin so it can create proposals
            await fees.addAdmin(account1);
            // Create a proposal for 1000 tokens (more than available fees)
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 1000n), MINIMUM_SIGNATURES);
            // Sign the proposal
            await fees.connect(account1).signProposal(0);
            // Try to execute the proposal without enough fees (should fail)
            await expect(fees.connect(account1).executeProposal(0))
                .to.be.revertedWithCustomError(fees, "InsufficientFees");
            // Verify that account1 is recognized as an admin
            expect(await fees.isAdmin(account1.address)).to.equal(true);
        });

        it("Should not allow executing already executed proposal", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin so it can create and execute proposals
            await fees.addAdmin(account1);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            // Sign the proposal
            await fees.connect(account1).signProposal(0);
            // Generate some fees by transferring tokens
            await generateFees(fees, owner, account1);
            // Execute the proposal once
            await fees.connect(account1).executeProposal(0);
            // Try to execute the same proposal again (should fail)
            await expect(fees.connect(account1).executeProposal(0))
                .to.be.revertedWithCustomError(fees, "ProposalAlreadyExecuted");
            // Verify that account1 is recognized as an admin
            expect(await fees.isAdmin(account1.address)).to.equal(true);
        });

        it("Should not allow executing cancelled proposal", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin so it can create and cancel proposals
            await fees.addAdmin(account1);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            // Cancel the proposal
            await fees.connect(account1).cancelProposal(0);
            // Try to execute the cancelled proposal (should fail)
            await expect(fees.connect(account1).executeProposal(0))
                .to.be.revertedWithCustomError(fees, "ProposalAlreadyCancelled");
            // Verify that account1 is recognized as an admin
            expect(await fees.isAdmin(account1.address)).to.equal(true);
        });
    });

    // --------------------------------- Proposal Cancellation
    describe("Proposal Cancellation", function () {
        it("Should allow admin to cancel proposal", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin so it can create and cancel proposals
            await fees.addAdmin(account1);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            // Cancel the proposal and verify it emits the correct event
            await expect(fees.connect(account1).cancelProposal(0))
                .to.emit(fees, "ProposalCancelled")
                .withArgs(0, account1.address);
            // Verify that account1 is recognized as an admin
            expect(await fees.isAdmin(account1.address)).to.equal(true);
        });

        it("Should not allow non-admin to cancel proposal", async function () {
            const { fees, owner, account1, account2 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin so it can create proposals
            await fees.addAdmin(account1);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            // Try to cancel the proposal from account2 (non-admin)
            await expect(fees.connect(account2).cancelProposal(0))
                .to.be.revertedWithCustomError(fees, "OnlyAdmin");
            // Verify that account1 is recognized as an admin
            expect(await fees.isAdmin(account1.address)).to.equal(true);
        });

        it("Should not allow cancelling already executed proposal", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin so it can create and execute proposals
            await fees.addAdmin(account1);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            // Sign the proposal
            await fees.connect(account1).signProposal(0);
            // Generate some fees by transferring tokens
            await generateFees(fees, owner, account1);
            // Execute the proposal
            await fees.connect(account1).executeProposal(0);
            // Try to cancel the executed proposal (should fail)
            await expect(fees.connect(account1).cancelProposal(0))
                .to.be.revertedWithCustomError(fees, "ProposalAlreadyExecuted");
            // Verify that account1 is recognized as an admin
            expect(await fees.isAdmin(account1.address)).to.equal(true);
        });

        it("Should not allow cancelling already cancelled proposal", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin so it can create and cancel proposals
            await fees.addAdmin(account1);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            // Cancel the proposal once
            await fees.connect(account1).cancelProposal(0);
            // Try to cancel the same proposal again (should fail)
            await expect(fees.connect(account1).cancelProposal(0))
                .to.be.revertedWithCustomError(fees, "ProposalAlreadyCancelled");
            // Verify that account1 is recognized as an admin
            expect(await fees.isAdmin(account1.address)).to.equal(true);
        });
    });

    // --------------------------------- Multi-admin scenarios
    describe("Multi-admin scenarios", function () {
        it("Should work with multiple admins signing", async function () {
            const { fees, owner, account1, account2 } = await loadFixture(deployFeesFixture);
            // Add both accounts as admins
            await fees.addAdmin(account1.address);
            await fees.addAdmin(account2.address);
            // Set minimum signatures to 2
            await fees.setMinimumSignatures(2);
            // Create a proposal requiring 2 signatures
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), 2);
            // Sign the proposal with both admins
            await fees.connect(account1).signProposal(0);
            await fees.connect(account2).signProposal(0);
            // Generate some fees by transferring tokens
            await generateFees(fees, owner, account1);
            // Execute the proposal
            await fees.connect(account1).executeProposal(0);
            // Verify the final balance (should have the proposal value plus remaining tokens minus fees)
            const expectedValue = await toInternalUnits(fees, 100n);
            const remainingTokens = await toInternalUnits(fees, 900n); // 1000 - 100 = 900 tokens remaining
            const feesPaid = await toInternalUnits(fees, 10n); // 100 * 10% = 10 fees
            expect(await fees.balanceOf(account1.address)).to.equal(expectedValue + remainingTokens - feesPaid);
            // Verify that both accounts are recognized as admins
            expect(await fees.isAdmin(account1.address)).to.equal(true);
            expect(await fees.isAdmin(account2.address)).to.equal(true);
        });

        it("Should allow any admin to cancel", async function () {
            const { fees, owner, account1, account2 } = await loadFixture(deployFeesFixture);
            // Add both accounts as admins
            await fees.addAdmin(account1.address);
            await fees.addAdmin(account2.address);
            // Set minimum signatures to 2
            await fees.setMinimumSignatures(2);
            // Create a proposal requiring 2 signatures
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), 2);
            // Cancel the proposal from account2 (different admin)
            await fees.connect(account2).cancelProposal(0);
            // Try to sign the cancelled proposal (should fail)
            await expect(fees.connect(account1).signProposal(0))
                .to.be.revertedWithCustomError(fees, "ProposalAlreadyCancelled");
            // Verify that both accounts are recognized as admins
            expect(await fees.isAdmin(account1.address)).to.equal(true);
            expect(await fees.isAdmin(account2.address)).to.equal(true);
        });

        it("Should work with three admins", async function () {
            const { fees, owner, account1, account2, account3 } = await loadFixture(deployFeesFixture);
            // Add all three accounts as admins
            await fees.addAdmin(account1.address);
            await fees.addAdmin(account2.address);
            await fees.addAdmin(account3.address);
            // Set minimum signatures to 3
            await fees.setMinimumSignatures(3);
            // Create a proposal requiring 3 signatures
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), 3);
            // Sign the proposal with all three admins
            await fees.connect(account1).signProposal(0);
            await fees.connect(account2).signProposal(0);
            await fees.connect(account3).signProposal(0);
            // Generate some fees by transferring tokens
            await generateFees(fees, owner, account1);
            // Execute the proposal
            await fees.connect(account1).executeProposal(0);
            // Verify the final balance (should have the proposal value plus remaining tokens minus fees)
            const expectedValue = await toInternalUnits(fees, 100n);
            const remainingTokens = await toInternalUnits(fees, 900n); // 1000 - 100 = 900 tokens remaining
            const feesPaid = await toInternalUnits(fees, 10n); // 100 * 10% = 10 fees
            expect(await fees.balanceOf(account1.address)).to.equal(expectedValue + remainingTokens - feesPaid);
            // Verify that all accounts are recognized as admins
            expect(await fees.isAdmin(account1.address)).to.equal(true);
            expect(await fees.isAdmin(account2.address)).to.equal(true);
            expect(await fees.isAdmin(account3.address)).to.equal(true);
        });

        it("Should prevent admin from signing the same proposal twice", async function () {
            const { fees, owner, account1, account2 } = await loadFixture(deployFeesFixture);
            // Add both accounts as admins
            await fees.addAdmin(account1.address);
            await fees.addAdmin(account2.address);
            // Set minimum signatures to 2 first
            await fees.setMinimumSignatures(2);
            // Create a proposal requiring 2 signatures
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), 2);
            // Sign the proposal with account1
            await fees.connect(account1).signProposal(0);
            // Try to sign the same proposal again with account1 (should fail)
            await expect(fees.connect(account1).signProposal(0))
                .to.be.revertedWithCustomError(fees, "ProposalAlreadySigned");
            // Sign with account2 (should succeed)
            await fees.connect(account2).signProposal(0);
            // Verify that both accounts are recognized as admins
            expect(await fees.isAdmin(account1.address)).to.equal(true);
            expect(await fees.isAdmin(account2.address)).to.equal(true);
        });
    });

    // --------------------------------- Owner and Admin Functions
    describe("Owner and Admin Functions", function () {
        it("Should correctly identify owner", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Verify that owner is correctly identified
            expect(await fees.isOwner(owner.address)).to.equal(true);
            // Verify that non-owner is not identified as owner
            expect(await fees.isOwner(account1.address)).to.equal(false);
        });

        it("Should correctly identify admins", async function () {
            const { fees, owner, account1, account2 } = await loadFixture(deployFeesFixture);
            // Verify that owner is an admin by default
            expect(await fees.isAdmin(owner.address)).to.equal(true);
            // Verify that account1 is not an admin initially
            expect(await fees.isAdmin(account1.address)).to.equal(false);
            // Add account1 as admin
            await fees.addAdmin(account1.address);
            // Verify that account1 is now an admin
            expect(await fees.isAdmin(account1.address)).to.equal(true);
            // Verify that account2 is still not an admin
            expect(await fees.isAdmin(account2.address)).to.equal(false);
        });

        it("Should handle admin removal correctly", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin
            await fees.addAdmin(account1.address);
            // Verify that account1 is an admin
            expect(await fees.isAdmin(account1.address)).to.equal(true);
            // Remove account1 as admin
            await fees.removeAdmin(account1.address);
            // Verify that account1 is no longer an admin
            expect(await fees.isAdmin(account1.address)).to.equal(false);
            // Verify that owner is still an admin
            expect(await fees.isAdmin(owner.address)).to.equal(true);
        });

        it("Should prevent non-owner from adding admin", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Try to add account2 as admin from account1 (non-owner)
            await expect(fees.connect(account1).addAdmin(account2.address))
                .to.be.revertedWithCustomError(fees, "OnlyOwner");
            // Verify that account2 is not an admin
            expect(await fees.isAdmin(account2.address)).to.equal(false);
        });

        it("Should prevent non-owner from removing admin", async function () {
            const { fees, owner, account1, account2 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin
            await fees.addAdmin(account1.address);
            // Try to remove account1 as admin from account2 (non-owner)
            await expect(fees.connect(account2).removeAdmin(account1.address))
                .to.be.revertedWithCustomError(fees, "OnlyOwner");
            // Verify that account1 is still an admin
            expect(await fees.isAdmin(account1.address)).to.equal(true);
        });
    });

    // --------------------------------- Edge Cases and Security
    describe("Edge Cases and Security", function () {
        it("Should handle proposal with zero value", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin
            await fees.addAdmin(account1.address);
            // Create a proposal for 0 tokens
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 0n), MINIMUM_SIGNATURES);
            // Sign the proposal
            await fees.connect(account1).signProposal(0);
            // Execute the proposal (should succeed even with 0 value)
            await fees.connect(account1).executeProposal(0);
            // Verify that account1 received 0 tokens
            expect(await fees.balanceOf(account1.address)).to.equal(0n);
        });

        it("Should handle proposal with maximum uint256 value", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin
            await fees.addAdmin(account1.address);
            const maxValue = 2n ** 256n - 1n;
            // Create a proposal with maximum value
            await fees.connect(account1).proposeCollection(account1.address, maxValue, MINIMUM_SIGNATURES);
            // Sign the proposal
            await fees.connect(account1).signProposal(0);
            // Try to execute the proposal (should fail due to insufficient fees)
            await expect(fees.connect(account1).executeProposal(0))
                .to.be.revertedWithCustomError(fees, "InsufficientFees");
        });

        it("Should handle multiple proposals correctly", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin
            await fees.addAdmin(account1.address);
            // Create multiple proposals
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 200n), MINIMUM_SIGNATURES);
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 300n), MINIMUM_SIGNATURES);
            // Sign all proposals
            await fees.connect(account1).signProposal(0);
            await fees.connect(account1).signProposal(1);
            await fees.connect(account1).signProposal(2);
            // Generate enough fees
            const largeAmount = await toInternalUnits(fees, 5000n); // Use smaller amount
            await fees.transfer(account1.address, largeAmount);
            await fees.connect(account1).transfer(owner.address, await toInternalUnits(fees, 3000n));
            // Execute proposals in order
            await fees.connect(account1).executeProposal(0);
            await fees.connect(account1).executeProposal(1);
            await fees.connect(account1).executeProposal(2);
            // Verify final balance (5000 - 3000 - 300 fees + 100 + 200 + 300 = 2300)
            const expectedBalance = await toInternalUnits(fees, 2300n);
            expect(await fees.balanceOf(account1.address)).to.equal(expectedBalance);
        });

        it("Should prevent proposal execution with insufficient fees", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin
            await fees.addAdmin(account1.address);
            // Create a proposal for more fees than available
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 1000n), MINIMUM_SIGNATURES);
            // Sign the proposal
            await fees.connect(account1).signProposal(0);
            // Try to execute without enough fees
            await expect(fees.connect(account1).executeProposal(0))
                .to.be.revertedWithCustomError(fees, "InsufficientFees");
        });

        it("Should handle proposal cancellation after signing", async function () {
            const { fees, owner, account1, account2 } = await loadFixture(deployFeesFixture);
            // Add both accounts as admins
            await fees.addAdmin(account1.address);
            await fees.addAdmin(account2.address);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            // Sign the proposal
            await fees.connect(account1).signProposal(0);
            // Cancel the proposal
            await fees.connect(account2).cancelProposal(0);
            // Try to execute the cancelled proposal (should fail)
            await expect(fees.connect(account1).executeProposal(0))
                .to.be.revertedWithCustomError(fees, "ProposalAlreadyCancelled");
        });

        it("Should handle proposal execution after cancellation attempt", async function () {
            const { fees, owner, account1, account2 } = await loadFixture(deployFeesFixture);
            // Add both accounts as admins
            await fees.addAdmin(account1.address);
            await fees.addAdmin(account2.address);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            // Sign the proposal
            await fees.connect(account1).signProposal(0);
            // Generate fees
            await generateFees(fees, owner, account1);
            // Execute the proposal
            await fees.connect(account1).executeProposal(0);
            // Try to cancel the executed proposal (should fail)
            await expect(fees.connect(account2).cancelProposal(0))
                .to.be.revertedWithCustomError(fees, "ProposalAlreadyExecuted");
        });
    });

    // --------------------------------- Open Proposals Management
    describe("Open Proposals Management", function () {
        it("Should add proposal to open proposals when created", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin
            await fees.addAdmin(account1.address);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            // Check that the proposal is in open proposals
            const openProposals = await fees.getOpenProposals();
            expect(openProposals.length).to.equal(1);
            expect(openProposals[0]).to.equal(0n);
            expect(await fees.getOpenProposalsCount()).to.equal(1);
        });

        it("Should remove proposal from open proposals when executed", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin
            await fees.addAdmin(account1.address);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            // Sign the proposal
            await fees.connect(account1).signProposal(0);
            // Generate fees
            await generateFees(fees, owner, account1);
            // Execute the proposal
            await fees.connect(account1).executeProposal(0);
            // Check that the proposal is no longer in open proposals
            const openProposals = await fees.getOpenProposals();
            expect(openProposals.length).to.equal(0);
            expect(await fees.getOpenProposalsCount()).to.equal(0);
        });

        it("Should remove proposal from open proposals when cancelled", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin
            await fees.addAdmin(account1.address);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            // Cancel the proposal
            await fees.connect(account1).cancelProposal(0);
            // Check that the proposal is no longer in open proposals
            const openProposals = await fees.getOpenProposals();
            expect(openProposals.length).to.equal(0);
            expect(await fees.getOpenProposalsCount()).to.equal(0);
        });

        it("Should handle multiple open proposals correctly", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin
            await fees.addAdmin(account1.address);
            // Create multiple proposals
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 200n), MINIMUM_SIGNATURES);
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 300n), MINIMUM_SIGNATURES);
            // Check that all proposals are in open proposals
            const openProposals = await fees.getOpenProposals();
            expect(openProposals.length).to.equal(3);
            expect(openProposals[0]).to.equal(0n);
            expect(openProposals[1]).to.equal(1n);
            expect(openProposals[2]).to.equal(2n);
            expect(await fees.getOpenProposalsCount()).to.equal(3);
        });

        it("Should handle removal of middle proposal correctly", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin
            await fees.addAdmin(account1.address);
            // Create three proposals
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 200n), MINIMUM_SIGNATURES);
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 300n), MINIMUM_SIGNATURES);
            // Sign and execute the middle proposal (proposal 1)
            await fees.connect(account1).signProposal(1);
            // Generate enough fees for proposal 1 (200 tokens)
            const largeAmount = await toInternalUnits(fees, 5000n);
            await fees.transfer(account1.address, largeAmount);
            const feesToTransfer = await toInternalUnits(fees, 3000n);
            await fees.connect(account1).transfer(owner.address, feesToTransfer);
            await fees.connect(account1).executeProposal(1);
            // Check that only proposals 0 and 2 remain
            const openProposals = await fees.getOpenProposals();
            expect(openProposals.length).to.equal(2);
            // The order might change due to the pop technique, so check both possibilities
            expect(openProposals).to.include(0n);
            expect(openProposals).to.include(2n);
            expect(await fees.getOpenProposalsCount()).to.equal(2);
        });

        it("Should handle removal of last proposal correctly", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin
            await fees.addAdmin(account1.address);
            // Create two proposals
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 200n), MINIMUM_SIGNATURES);
            // Cancel the last proposal (proposal 1)
            await fees.connect(account1).cancelProposal(1);
            // Check that only proposal 0 remains
            const openProposals = await fees.getOpenProposals();
            expect(openProposals.length).to.equal(1);
            expect(openProposals[0]).to.equal(0n);
            expect(await fees.getOpenProposalsCount()).to.equal(1);
        });

        it("Should handle removal of first proposal correctly", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin
            await fees.addAdmin(account1.address);
            // Create two proposals
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 200n), MINIMUM_SIGNATURES);
            // Cancel the first proposal (proposal 0)
            await fees.connect(account1).cancelProposal(0);
            // Check that only proposal 1 remains
            const openProposals = await fees.getOpenProposals();
            expect(openProposals.length).to.equal(1);
            expect(openProposals[0]).to.equal(1n);
            expect(await fees.getOpenProposalsCount()).to.equal(1);
        });

        it("Should handle complex scenario with multiple removals", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin
            await fees.addAdmin(account1.address);
            // Create four proposals
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 200n), MINIMUM_SIGNATURES);
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 300n), MINIMUM_SIGNATURES);
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 400n), MINIMUM_SIGNATURES);
            
            // Check initial state
            expect(await fees.getOpenProposalsCount()).to.equal(4);
            
            // Cancel proposal 1 (middle)
            await fees.connect(account1).cancelProposal(1);
            expect(await fees.getOpenProposalsCount()).to.equal(3);
            
            // Execute proposal 0 (first)
            await fees.connect(account1).signProposal(0);
            await generateFees(fees, owner, account1);
            await fees.connect(account1).executeProposal(0);
            expect(await fees.getOpenProposalsCount()).to.equal(2);
            
            // Cancel proposal 3 (last)
            await fees.connect(account1).cancelProposal(3);
            expect(await fees.getOpenProposalsCount()).to.equal(1);
            
            // Check final state - only proposal 2 should remain
            const openProposals = await fees.getOpenProposals();
            expect(openProposals.length).to.equal(1);
            expect(openProposals[0]).to.equal(2n);
        });

        it("Should handle removal of non-existent proposal gracefully", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin
            await fees.addAdmin(account1.address);
            // Create one proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            // Try to cancel a non-existent proposal (should not affect open proposals)
            await fees.connect(account1).cancelProposal(0);
            // Check that no proposals remain
            const openProposals = await fees.getOpenProposals();
            expect(openProposals.length).to.equal(0);
            expect(await fees.getOpenProposalsCount()).to.equal(0);
        });

        it("Should maintain correct order after multiple operations", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin
            await fees.addAdmin(account1.address);
            // Create three proposals
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 200n), MINIMUM_SIGNATURES);
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 300n), MINIMUM_SIGNATURES);
            
            // Remove proposal 1 (middle)
            await fees.connect(account1).cancelProposal(1);
            
            // Add a new proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 400n), MINIMUM_SIGNATURES);
            
            // Check that we have 3 proposals: 0, 2, 3
            const openProposals = await fees.getOpenProposals();
            expect(openProposals.length).to.equal(3);
            expect(openProposals).to.include(0n);
            expect(openProposals).to.include(2n);
            expect(openProposals).to.include(3n);
            expect(await fees.getOpenProposalsCount()).to.equal(3);
        });
    });

    // --------------------------------- Proposal Retrieval
    describe("Proposal Retrieval", function () {
        it("Should return correct proposal data for new proposal", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin
            await fees.addAdmin(account1.address);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            // Get the proposal data
            const proposal = await fees.getProposal(0);
            // Verify all fields are correct
            expect(proposal.signatureCount).to.equal(0);
            expect(proposal.to).to.equal(account1.address);
            const proposalValue = await toInternalUnits(fees, 100n);
            expect(proposal.value).to.equal(proposalValue);
            expect(proposal.minimumSignatures).to.equal(MINIMUM_SIGNATURES);
            expect(proposal.executed).to.equal(false);
            expect(proposal.cancelledBy).to.equal("0x0000000000000000000000000000000000000000");
        });

        it("Should return correct proposal data after signing", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin
            await fees.addAdmin(account1.address);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            // Sign the proposal
            await fees.connect(account1).signProposal(0);
            // Get the proposal data
            const proposal = await fees.getProposal(0);
            // Verify signature count increased
            expect(proposal.signatureCount).to.equal(1);
            expect(proposal.to).to.equal(account1.address);
            const proposalValue = await toInternalUnits(fees, 100n);
            expect(proposal.value).to.equal(proposalValue);
            expect(proposal.minimumSignatures).to.equal(MINIMUM_SIGNATURES);
            expect(proposal.executed).to.equal(false);
            expect(proposal.cancelledBy).to.equal("0x0000000000000000000000000000000000000000");
        });

        it("Should return correct proposal data after execution", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin
            await fees.addAdmin(account1.address);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            // Sign the proposal
            await fees.connect(account1).signProposal(0);
            // Generate fees
            await generateFees(fees, owner, account1);
            // Execute the proposal
            await fees.connect(account1).executeProposal(0);
            // Get the proposal data
            const proposal = await fees.getProposal(0);
            // Verify execution status
            expect(proposal.signatureCount).to.equal(1);
            expect(proposal.to).to.equal(account1.address);
            const decimals = await fees.decimals();
            expect(proposal.value).to.equal(100n * BigInt(10) ** decimals);
            expect(proposal.minimumSignatures).to.equal(MINIMUM_SIGNATURES);
            expect(proposal.executed).to.equal(true);
            expect(proposal.cancelledBy).to.equal("0x0000000000000000000000000000000000000000");
        });

        it("Should return correct proposal data after cancellation", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin
            await fees.addAdmin(account1.address);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            // Cancel the proposal
            await fees.connect(account1).cancelProposal(0);
            // Get the proposal data
            const proposal = await fees.getProposal(0);
            // Verify cancellation status
            expect(proposal.signatureCount).to.equal(0);
            expect(proposal.to).to.equal(account1.address);
            const proposalValue = await toInternalUnits(fees, 100n);
            expect(proposal.value).to.equal(proposalValue);
            expect(proposal.minimumSignatures).to.equal(MINIMUM_SIGNATURES);
            expect(proposal.executed).to.equal(false);
            expect(proposal.cancelledBy).to.equal(account1.address);
        });

        it("Should return correct data for multiple proposals", async function () {
            const { fees, owner, account1, account2 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin
            await fees.addAdmin(account1.address);
            // Set minimum signatures to 2 first
            await fees.setMinimumSignatures(2);
            // Create multiple proposals
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            await fees.connect(account1).proposeCollection(account2.address, await toInternalUnits(fees, 200n), 2);
            await fees.connect(account1).proposeCollection(owner.address, await toInternalUnits(fees, 300n), MINIMUM_SIGNATURES);
            
            // Get all proposals
            const proposal0 = await fees.getProposal(0);
            const proposal1 = await fees.getProposal(1);
            const proposal2 = await fees.getProposal(2);
            
            // Verify proposal 0
            expect(proposal0.to).to.equal(account1.address);
            const expectedValue0 = await toInternalUnits(fees, 100n);
            expect(proposal0.value).to.equal(expectedValue0); // getProposal returns internal units
            expect(proposal0.minimumSignatures).to.equal(MINIMUM_SIGNATURES);
            
            // Verify proposal 1
            expect(proposal1.to).to.equal(account2.address);
            const expectedValue1 = await toInternalUnits(fees, 200n);
            expect(proposal1.value).to.equal(expectedValue1); // getProposal returns internal units
            expect(proposal1.minimumSignatures).to.equal(2);
            
            // Verify proposal 2
            expect(proposal2.to).to.equal(owner.address);
            const expectedValue2 = await toInternalUnits(fees, 300n);
            expect(proposal2.value).to.equal(expectedValue2); // getProposal returns internal units
            expect(proposal2.minimumSignatures).to.equal(MINIMUM_SIGNATURES);
        });

        it("Should return correct data for proposal with multiple signatures", async function () {
            const { fees, owner, account1, account2 } = await loadFixture(deployFeesFixture);
            // Add both accounts as admins
            await fees.addAdmin(account1.address);
            await fees.addAdmin(account2.address);
            // Set minimum signatures to 2
            await fees.setMinimumSignatures(2);
            // Create a proposal requiring 2 signatures
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), 2);
            // Sign with both admins
            await fees.connect(account1).signProposal(0);
            await fees.connect(account2).signProposal(0);
            // Get the proposal data
            const proposal = await fees.getProposal(0);
            // Verify signature count
            expect(proposal.signatureCount).to.equal(2);
            expect(proposal.to).to.equal(account1.address);
            const proposalValue = await toInternalUnits(fees, 100n);
            expect(proposal.value).to.equal(proposalValue);
            expect(proposal.minimumSignatures).to.equal(2);
            expect(proposal.executed).to.equal(false);
            expect(proposal.cancelledBy).to.equal("0x0000000000000000000000000000000000000000");
        });

        it("Should handle non-existent proposal gracefully", async function () {
            const { fees } = await loadFixture(deployFeesFixture);
            // Try to get a non-existent proposal (should revert with array bounds error)
            await expect(fees.getProposal(999))
                .to.be.revertedWithPanic(0x32); // Array index out of bounds
        });

        it("Should return correct data after proposal state changes", async function () {
            const { fees, owner, account1, account2 } = await loadFixture(deployFeesFixture);
            // Add both accounts as admins
            await fees.addAdmin(account1.address);
            await fees.addAdmin(account2.address);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            
            // Check initial state
            let proposal = await fees.getProposal(0);
            expect(proposal.signatureCount).to.equal(0);
            expect(proposal.executed).to.equal(false);
            expect(proposal.cancelledBy).to.equal("0x0000000000000000000000000000000000000000");
            
            // Sign the proposal
            await fees.connect(account1).signProposal(0);
            proposal = await fees.getProposal(0);
            expect(proposal.signatureCount).to.equal(1);
            
            // Sign with second admin
            await fees.connect(account2).signProposal(0);
            proposal = await fees.getProposal(0);
            expect(proposal.signatureCount).to.equal(2);
            
            // Generate fees and execute
            await generateFees(fees, owner, account1);
            await fees.connect(account1).executeProposal(0);
            proposal = await fees.getProposal(0);
            expect(proposal.executed).to.equal(true);
        });
    });

    // --------------------------------- Additional Getter Functions
    describe("Additional Getter Functions", function () {
        it("Should return correct proposals count", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin
            await fees.addAdmin(account1.address);
            // Initially no proposals
            expect(await fees.getProposalsCount()).to.equal(0);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            expect(await fees.getProposalsCount()).to.equal(1);
            // Create another proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 200n), MINIMUM_SIGNATURES);
            expect(await fees.getProposalsCount()).to.equal(2);
        });

        it("Should return correct signature status", async function () {
            const { fees, owner, account1, account2 } = await loadFixture(deployFeesFixture);
            // Add both accounts as admins
            await fees.addAdmin(account1.address);
            await fees.addAdmin(account2.address);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            // Check initial signature status
            expect(await fees.hasSignedProposal(0, account1.address)).to.equal(false);
            expect(await fees.hasSignedProposal(0, account2.address)).to.equal(false);
            // Sign with account1
            await fees.connect(account1).signProposal(0);
            expect(await fees.hasSignedProposal(0, account1.address)).to.equal(true);
            expect(await fees.hasSignedProposal(0, account2.address)).to.equal(false);
            // Sign with account2
            await fees.connect(account2).signProposal(0);
            expect(await fees.hasSignedProposal(0, account1.address)).to.equal(true);
            expect(await fees.hasSignedProposal(0, account2.address)).to.equal(true);
        });

        it("Should return correct signature status for non-admin", async function () {
            const { fees, owner, account1, account2 } = await loadFixture(deployFeesFixture);
            // Add only account1 as admin
            await fees.addAdmin(account1.address);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            // Check signature status for non-admin
            expect(await fees.hasSignedProposal(0, account2.address)).to.equal(false);
        });

        it("Should return correct signature status for non-existent proposal", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Check signature status for non-existent proposal
            expect(await fees.hasSignedProposal(999, account1.address)).to.equal(false);
        });

        it("Should return all proposals correctly", async function () {
            const { fees, owner, account1, account2 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin
            await fees.addAdmin(account1.address);
            // Create multiple proposals
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            await fees.connect(account1).proposeCollection(account2.address, await toInternalUnits(fees, 200n), MINIMUM_SIGNATURES);
            await fees.connect(account1).proposeCollection(owner.address, await toInternalUnits(fees, 300n), MINIMUM_SIGNATURES);
            
            // Debug: Check if proposals were created
            expect(await fees.getProposalsCount()).to.equal(3);
            
            // Get all proposals
            const allProposals = await fees.getAllProposals();
            
            // Verify the structure
            expect(allProposals.proposalIds.length).to.equal(3);
            expect(allProposals.recipients.length).to.equal(3);
            expect(allProposals.minimumSignatures.length).to.equal(3);
            expect(allProposals.executed.length).to.equal(3);
            expect(allProposals.cancelledBy.length).to.equal(3);
            
            // Verify proposal 0
            expect(allProposals.proposalIds[0]).to.equal(0n);
            expect(allProposals.recipients[0]).to.equal(account1.address);
            const expectedValue0 = await toInternalUnits(fees, 100n);
            expect(allProposals[2][0]).to.equal(expectedValue0); // getAllProposals returns internal units
            expect(allProposals.minimumSignatures[0]).to.equal(MINIMUM_SIGNATURES);
            expect(allProposals.executed[0]).to.equal(false);
            expect(allProposals.cancelledBy[0]).to.equal("0x0000000000000000000000000000000000000000");
            
            // Verify proposal 1
            expect(allProposals.proposalIds[1]).to.equal(1n);
            expect(allProposals.recipients[1]).to.equal(account2.address);
            const expectedValue1 = await toInternalUnits(fees, 200n);
            expect(allProposals[2][1]).to.equal(expectedValue1); // getAllProposals returns internal units
            expect(allProposals.minimumSignatures[1]).to.equal(MINIMUM_SIGNATURES);
            expect(allProposals.executed[1]).to.equal(false);
            expect(allProposals.cancelledBy[1]).to.equal("0x0000000000000000000000000000000000000000");
            
            // Verify proposal 2
            expect(allProposals.proposalIds[2]).to.equal(2n);
            expect(allProposals.recipients[2]).to.equal(owner.address);
            const expectedValue2 = await toInternalUnits(fees, 300n);
            expect(allProposals[2][2]).to.equal(expectedValue2); // getAllProposals returns internal units
            expect(allProposals.minimumSignatures[2]).to.equal(MINIMUM_SIGNATURES);
            expect(allProposals.executed[2]).to.equal(false);
            expect(allProposals.cancelledBy[2]).to.equal("0x0000000000000000000000000000000000000000");
        });

        it("Should return empty arrays when no proposals exist", async function () {
            const { fees } = await loadFixture(deployFeesFixture);
            // Get all proposals when none exist
            const allProposals = await fees.getAllProposals();
            
            // Verify empty arrays
            expect(allProposals.proposalIds.length).to.equal(0);
            expect(allProposals.recipients.length).to.equal(0);
            expect(allProposals.values.length).to.equal(0);
            expect(allProposals.minimumSignatures.length).to.equal(0);
            expect(allProposals.executed.length).to.equal(0);
            expect(allProposals.cancelledBy.length).to.equal(0);
        });

        it("Should return single proposal correctly", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin
            await fees.addAdmin(account1.address);
            // Create single proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            
            // Debug: Check if proposal was created
            expect(await fees.getProposalsCount()).to.equal(1);
            
            // Debug: Check if we can access the proposal directly
            const proposal = await fees.getProposal(0);
            expect(proposal.to).to.equal(account1.address);
            const expectedValue = await toInternalUnits(fees, 100n);
            expect(proposal.value).to.equal(expectedValue); // getProposal returns internal units
            
            // Get all proposals
            const allProposals = await fees.getAllProposals();
            
            // Verify the structure
            expect(allProposals.proposalIds.length).to.equal(1);
            expect(allProposals.recipients.length).to.equal(1);
            expect(allProposals.minimumSignatures.length).to.equal(1);
            expect(allProposals.executed.length).to.equal(1);
            expect(allProposals.cancelledBy.length).to.equal(1);
            
            // Verify proposal 0
            expect(allProposals.proposalIds[0]).to.equal(0n);
            expect(allProposals.recipients[0]).to.equal(account1.address);
            const expectedValue0 = await toInternalUnits(fees, 100n);
            expect(allProposals[2][0]).to.equal(expectedValue0); // getAllProposals returns internal units
            expect(allProposals.minimumSignatures[0]).to.equal(MINIMUM_SIGNATURES);
            expect(allProposals.executed[0]).to.equal(false);
            expect(allProposals.cancelledBy[0]).to.equal("0x0000000000000000000000000000000000000000");
        });

        it("Should return all proposals with executed and cancelled states", async function () {
            const { fees, owner, account1, account2 } = await loadFixture(deployFeesFixture);
            // Add both accounts as admins
            await fees.addAdmin(account1.address);
            await fees.addAdmin(account2.address);
            // Create three proposals
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            await fees.connect(account1).proposeCollection(account2.address, await toInternalUnits(fees, 200n), MINIMUM_SIGNATURES);
            await fees.connect(account1).proposeCollection(owner.address, await toInternalUnits(fees, 300n), MINIMUM_SIGNATURES);
            
            // Execute proposal 0
            await fees.connect(account1).signProposal(0);
            await generateFees(fees, owner, account1);
            await fees.connect(account1).executeProposal(0);
            
            // Cancel proposal 1
            await fees.connect(account1).cancelProposal(1);
            
            // Get all proposals
            const allProposals = await fees.getAllProposals();
            
            // Verify proposal 0 is executed
            expect(allProposals.executed[0]).to.equal(true);
            expect(allProposals.cancelledBy[0]).to.equal("0x0000000000000000000000000000000000000000");
            
            // Verify proposal 1 is cancelled
            expect(allProposals.executed[1]).to.equal(false);
            expect(allProposals.cancelledBy[1]).to.equal(account1.address);
            
            // Verify proposal 2 is still open
            expect(allProposals.executed[2]).to.equal(false);
            expect(allProposals.cancelledBy[2]).to.equal("0x0000000000000000000000000000000000000000");
        });

        it("Should handle multiple signatures correctly in hasSignedProposal", async function () {
            const { fees, owner, account1, account2, account3 } = await loadFixture(deployFeesFixture);
            // Add all three accounts as admins
            await fees.addAdmin(account1.address);
            await fees.addAdmin(account2.address);
            await fees.addAdmin(account3.address);
            // Set minimum signatures to 3
            await fees.setMinimumSignatures(3);
            // Create a proposal requiring 3 signatures
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), 3);
            
            // Check initial state
            expect(await fees.hasSignedProposal(0, account1.address)).to.equal(false);
            expect(await fees.hasSignedProposal(0, account2.address)).to.equal(false);
            expect(await fees.hasSignedProposal(0, account3.address)).to.equal(false);
            
            // Sign with account1
            await fees.connect(account1).signProposal(0);
            expect(await fees.hasSignedProposal(0, account1.address)).to.equal(true);
            expect(await fees.hasSignedProposal(0, account2.address)).to.equal(false);
            expect(await fees.hasSignedProposal(0, account3.address)).to.equal(false);
            
            // Sign with account2
            await fees.connect(account2).signProposal(0);
            expect(await fees.hasSignedProposal(0, account1.address)).to.equal(true);
            expect(await fees.hasSignedProposal(0, account2.address)).to.equal(true);
            expect(await fees.hasSignedProposal(0, account3.address)).to.equal(false);
            
            // Sign with account3
            await fees.connect(account3).signProposal(0);
            expect(await fees.hasSignedProposal(0, account1.address)).to.equal(true);
            expect(await fees.hasSignedProposal(0, account2.address)).to.equal(true);
            expect(await fees.hasSignedProposal(0, account3.address)).to.equal(true);
        });

        it("Should return empty array for getProposalSignatures when no signatures", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin
            await fees.addAdmin(account1.address);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            // Get signatures (should return empty array when no signatures)
            const signatures = await fees.getProposalSignatures(0);
            expect(signatures.length).to.equal(0);
        });

        it("Should return correct signatures for getProposalSignatures with one signature", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin
            await fees.addAdmin(account1.address);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            // Sign the proposal
            await fees.connect(account1).signProposal(0);
            // Get signatures
            const signatures = await fees.getProposalSignatures(0);
            expect(signatures.length).to.equal(1);
            expect(signatures[0]).to.equal(account1.address);
        });

        it("Should return correct signatures for getProposalSignatures with multiple signatures", async function () {
            const { fees, owner, account1, account2, account3 } = await loadFixture(deployFeesFixture);
            // Add all accounts as admins
            await fees.addAdmin(account1.address);
            await fees.addAdmin(account2.address);
            await fees.addAdmin(account3.address);
            // Set minimum signatures to 3
            await fees.setMinimumSignatures(3);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), 3);
            // Sign with all three admins
            await fees.connect(account1).signProposal(0);
            await fees.connect(account2).signProposal(0);
            await fees.connect(account3).signProposal(0);
            // Get signatures
            const signatures = await fees.getProposalSignatures(0);
            expect(signatures.length).to.equal(3);
            expect(signatures).to.include(account1.address);
            expect(signatures).to.include(account2.address);
            expect(signatures).to.include(account3.address);
        });

        it("Should return correct signatures order for getProposalSignatures", async function () {
            const { fees, owner, account1, account2 } = await loadFixture(deployFeesFixture);
            // Add both accounts as admins
            await fees.addAdmin(account1.address);
            await fees.addAdmin(account2.address);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            // Sign with account2 first
            await fees.connect(account2).signProposal(0);
            // Sign with account1 second
            await fees.connect(account1).signProposal(0);
            // Get signatures
            const signatures = await fees.getProposalSignatures(0);
            expect(signatures.length).to.equal(2);
            expect(signatures[0]).to.equal(account2.address); // First signer
            expect(signatures[1]).to.equal(account1.address); // Second signer
        });

        it("Should return empty array for getProposalSignatures on non-existent proposal", async function () {
            const { fees } = await loadFixture(deployFeesFixture);
            // Get signatures for non-existent proposal
            const signatures = await fees.getProposalSignatures(999);
            expect(signatures.length).to.equal(0);
        });

        it("Should return correct signatures after proposal execution", async function () {
            const { fees, owner, account1, account2 } = await loadFixture(deployFeesFixture);
            // Add both accounts as admins
            await fees.addAdmin(account1.address);
            await fees.addAdmin(account2.address);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            // Sign with both admins
            await fees.connect(account1).signProposal(0);
            await fees.connect(account2).signProposal(0);
            // Generate fees
            await generateFees(fees, owner, account1);
            // Execute the proposal
            await fees.connect(account1).executeProposal(0);
            // Get signatures (should still return the signatures even after execution)
            const signatures = await fees.getProposalSignatures(0);
            expect(signatures.length).to.equal(2);
            expect(signatures).to.include(account1.address);
            expect(signatures).to.include(account2.address);
        });

        it("Should return correct signatures after proposal cancellation", async function () {
            const { fees, owner, account1, account2 } = await loadFixture(deployFeesFixture);
            // Add both accounts as admins
            await fees.addAdmin(account1.address);
            await fees.addAdmin(account2.address);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            // Sign with both admins
            await fees.connect(account1).signProposal(0);
            await fees.connect(account2).signProposal(0);
            // Cancel the proposal
            await fees.connect(account1).cancelProposal(0);
            // Get signatures (should still return the signatures even after cancellation)
            const signatures = await fees.getProposalSignatures(0);
            expect(signatures.length).to.equal(2);
            expect(signatures).to.include(account1.address);
            expect(signatures).to.include(account2.address);
        });

        it("Should return correct signatures for multiple proposals", async function () {
            const { fees, owner, account1, account2 } = await loadFixture(deployFeesFixture);
            // Add both accounts as admins
            await fees.addAdmin(account1.address);
            await fees.addAdmin(account2.address);
            // Create two proposals
            await fees.connect(account1).proposeCollection(account1.address, await toInternalUnits(fees, 100n), MINIMUM_SIGNATURES);
            await fees.connect(account1).proposeCollection(account2.address, await toInternalUnits(fees, 200n), MINIMUM_SIGNATURES);
            // Sign proposal 0 with account1 only
            await fees.connect(account1).signProposal(0);
            // Sign proposal 1 with both accounts
            await fees.connect(account1).signProposal(1);
            await fees.connect(account2).signProposal(1);
            // Get signatures for both proposals
            const signatures0 = await fees.getProposalSignatures(0);
            const signatures1 = await fees.getProposalSignatures(1);
            // Verify proposal 0 signatures
            expect(signatures0.length).to.equal(1);
            expect(signatures0[0]).to.equal(account1.address);
            // Verify proposal 1 signatures
            expect(signatures1.length).to.equal(2);
            expect(signatures1).to.include(account1.address);
            expect(signatures1).to.include(account2.address);
        });
    });
});