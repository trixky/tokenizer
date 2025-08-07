import {
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { deployFeesFixture, MINIMUM_SIGNATURES } from "./main";

describe("Governance", function () {
    // --------------------------------- Admin Management
    describe("Admin Management", function () {
        it("Should allow owner to add admin", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as an admin
            await fees.addAdmin(account1.address);
            // Test that account1 can now propose (which requires admin privileges)
            await fees.connect(account1).proposeCollection(account1.address, 100n, MINIMUM_SIGNATURES);
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
            await expect(fees.connect(account1).proposeCollection(account1.address, 100n, MINIMUM_SIGNATURES))
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
            await fees.proposeCollection(owner.address, 100n, 3);
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
            await expect(fees.connect(account1).proposeCollection(account1.address, 100n, MINIMUM_SIGNATURES))
                .to.emit(fees, "ProposalCreated")
                .withArgs(0, account1.address, 100n, MINIMUM_SIGNATURES);
            // Verify that account1 is recognized as an admin
            expect(await fees.isAdmin(account1.address)).to.equal(true);
        });

        it("Should not allow non-admin to create proposal", async function () {
            const { fees, account1 } = await loadFixture(deployFeesFixture);
            // Try to create a proposal from account1 (non-admin)
            await expect(fees.connect(account1).proposeCollection(account1.address, 100n, MINIMUM_SIGNATURES))
                .to.be.revertedWithCustomError(fees, "OnlyAdmin");
            // Verify that account1 is not recognized as an admin
            expect(await fees.isAdmin(account1.address)).to.equal(false);
        });

        it("Should not allow proposal with minimum signatures higher than global minimum", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin so it can create proposals
            await fees.addAdmin(account1.address);
            // Try to create a proposal with minimum signatures higher than global minimum
            await expect(fees.connect(account1).proposeCollection(account1.address, 100n, 2))
                .to.be.revertedWithCustomError(fees, "MinimumSignaturesTooHigh");
            // Verify that the global minimum signatures remains unchanged
            expect(await fees.getMinimumSignatures()).to.equal(MINIMUM_SIGNATURES);
        });

        it("Should not allow proposal with minimum signatures of 0", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin so it can create proposals
            await fees.addAdmin(account1.address);
            // Try to create a proposal with minimum signatures of 0 (should fail)
            await expect(fees.connect(account1).proposeCollection(account1.address, 100n, 0))
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
            await fees.connect(account1).proposeCollection(account1.address, 100n, MINIMUM_SIGNATURES);
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
            await fees.connect(account1).proposeCollection(account1.address, 100n, MINIMUM_SIGNATURES);
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
            await fees.connect(account1).proposeCollection(account1.address, 100n, MINIMUM_SIGNATURES);
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
            await fees.connect(account1).proposeCollection(account1.address, 100n, MINIMUM_SIGNATURES);
            // Sign the proposal
            await fees.connect(account1).signProposal(0);
            // Generate some fees to execute the proposal
            await fees.transfer(account1.address, 1000n);
            await fees.connect(account1).transfer(owner.address, 100n);
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
            await fees.connect(account1).proposeCollection(account1.address, 100n, MINIMUM_SIGNATURES);
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
            await fees.connect(account1).proposeCollection(account1.address, 100n, MINIMUM_SIGNATURES);
            // Sign the proposal
            await fees.connect(account1).signProposal(0);
            // Generate some fees by transferring tokens
            await fees.transfer(account1.address, 1000n);
            await fees.connect(account1).transfer(owner.address, 100n);
            // Execute the proposal and verify it emits the correct event
            await expect(fees.connect(account1).executeProposal(0))
                .to.emit(fees, "ProposalExecuted")
                .withArgs(0, account1.address, 100n);
            // account1 should have 990 tokens: 1000 - 100 - 10 (fees) + 100 (from proposal)
            expect(await fees.balanceOf(account1.address)).to.equal(990n);
            // Verify that account1 is recognized as an admin
            expect(await fees.isAdmin(account1.address)).to.equal(true);
        });

        it("Should not allow non-admin to execute proposal", async function () {
            const { fees, owner, account1, account2 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin so it can create proposals
            await fees.addAdmin(account1);
            // Create a proposal
            await fees.connect(account1).proposeCollection(account1.address, 100n, MINIMUM_SIGNATURES);
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
            await fees.connect(account1).proposeCollection(account1.address, 100n, 2);
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
            await fees.connect(account1).proposeCollection(account1.address, 1000n, MINIMUM_SIGNATURES);
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
            await fees.connect(account1).proposeCollection(account1.address, 100n, MINIMUM_SIGNATURES);
            // Sign the proposal
            await fees.connect(account1).signProposal(0);
            // Generate some fees by transferring tokens
            await fees.transfer(account1.address, 1000n);
            await fees.connect(account1).transfer(owner.address, 100n);
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
            await fees.connect(account1).proposeCollection(account1.address, 100n, MINIMUM_SIGNATURES);
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
            await fees.connect(account1).proposeCollection(account1.address, 100n, MINIMUM_SIGNATURES);
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
            await fees.connect(account1).proposeCollection(account1.address, 100n, MINIMUM_SIGNATURES);
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
            await fees.connect(account1).proposeCollection(account1.address, 100n, MINIMUM_SIGNATURES);
            // Sign the proposal
            await fees.connect(account1).signProposal(0);
            // Generate some fees by transferring tokens
            await fees.transfer(account1.address, 1000n);
            await fees.connect(account1).transfer(owner.address, 100n);
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
            await fees.connect(account1).proposeCollection(account1.address, 100n, MINIMUM_SIGNATURES);
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
            await fees.connect(account1).proposeCollection(account1.address, 100n, 2);
            // Sign the proposal with both admins
            await fees.connect(account1).signProposal(0);
            await fees.connect(account2).signProposal(0);
            // Generate some fees by transferring tokens
            await fees.transfer(account1.address, 1000n);
            await fees.connect(account1).transfer(owner.address, 100n);
            // Execute the proposal
            await fees.connect(account1).executeProposal(0);
            // Verify the final balance
            expect(await fees.balanceOf(account1.address)).to.equal(990n);
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
            await fees.connect(account1).proposeCollection(account1.address, 100n, 2);
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
            await fees.connect(account1).proposeCollection(account1.address, 100n, 3);
            // Sign the proposal with all three admins
            await fees.connect(account1).signProposal(0);
            await fees.connect(account2).signProposal(0);
            await fees.connect(account3).signProposal(0);
            // Generate some fees by transferring tokens
            await fees.transfer(account1.address, 1000n);
            await fees.connect(account1).transfer(owner.address, 100n);
            // Execute the proposal
            await fees.connect(account1).executeProposal(0);
            // Verify the final balance
            expect(await fees.balanceOf(account1.address)).to.equal(990n);
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
            await fees.connect(account1).proposeCollection(account1.address, 100n, 2);
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
            await fees.connect(account1).proposeCollection(account1.address, 0n, MINIMUM_SIGNATURES);
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
            await fees.connect(account1).proposeCollection(account1.address, 100n, MINIMUM_SIGNATURES);
            await fees.connect(account1).proposeCollection(account1.address, 200n, MINIMUM_SIGNATURES);
            await fees.connect(account1).proposeCollection(account1.address, 300n, MINIMUM_SIGNATURES);
            // Sign all proposals
            await fees.connect(account1).signProposal(0);
            await fees.connect(account1).signProposal(1);
            await fees.connect(account1).signProposal(2);
            // Generate enough fees
            await fees.transfer(account1.address, 10000n);
            await fees.connect(account1).transfer(owner.address, 6000n);
            // Execute proposals in order
            await fees.connect(account1).executeProposal(0);
            await fees.connect(account1).executeProposal(1);
            await fees.connect(account1).executeProposal(2);
            // Verify final balance (10000 - 6000 - 600 fees + 100 + 200 + 300 = 4000)
            expect(await fees.balanceOf(account1.address)).to.equal(4000n);
        });

        it("Should prevent proposal execution with insufficient fees", async function () {
            const { fees, owner, account1 } = await loadFixture(deployFeesFixture);
            // Add account1 as admin
            await fees.addAdmin(account1.address);
            // Create a proposal for more fees than available
            await fees.connect(account1).proposeCollection(account1.address, 1000n, MINIMUM_SIGNATURES);
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
            await fees.connect(account1).proposeCollection(account1.address, 100n, MINIMUM_SIGNATURES);
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
            await fees.connect(account1).proposeCollection(account1.address, 100n, MINIMUM_SIGNATURES);
            // Sign the proposal
            await fees.connect(account1).signProposal(0);
            // Generate fees
            await fees.transfer(account1.address, 1000n);
            await fees.connect(account1).transfer(owner.address, 100n);
            // Execute the proposal
            await fees.connect(account1).executeProposal(0);
            // Try to cancel the executed proposal (should fail)
            await expect(fees.connect(account2).cancelProposal(0))
                .to.be.revertedWithCustomError(fees, "ProposalAlreadyExecuted");
        });
    });
});