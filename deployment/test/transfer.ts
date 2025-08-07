import {
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployFeesFixture, TOTAL_SUPPLY, PERCENTAGE_FEES } from "./main";

// --------------------------------- Transfer
describe("Transfers", function () {
    describe("Transfer", function () {
        it("insufficient balance (total supply + fees)", async function () {
            const { fees, account1 } = await loadFixture(deployFeesFixture);
            const decimals = await fees.decimals();
            // Calculate total supply with proper decimal places
            const totalSupply = TOTAL_SUPPLY * BigInt(10) ** decimals;
            // Try to transfer more than the total supply (which should fail)
            await expect(fees.transfer(account1.address, totalSupply)).to.be.revertedWithCustomError(fees, "ERC20InsufficientBalance");
        });

        it("insufficient balance (0 balance)", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Try to transfer 1 token when account1 has 0 balance
            await expect(feesFromAccount1.transfer(account2.address, 1n)).to.be.revertedWithCustomError(fees, "ERC20InsufficientBalance");
        });

        it("insufficient balance (can't pay fees)", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Transfer 100 tokens to account1 from the owner
            await fees.transfer(account1.address, 100n);
            // Try to transfer 100 tokens to account2 (should fail because account1 needs 110 tokens: 100 + 10 fees)
            await expect(feesFromAccount1.transfer(account2.address, 100n)).to.be.revertedWithCustomError(fees, "ERC20InsufficientBalance");
            // Try to transfer 92 tokens to account2 (should fail because account1 needs 101.2 tokens: 92 + 9.2 fees, but has only 100)
            await expect(feesFromAccount1.transfer(account2.address, 92n)).to.be.revertedWithCustomError(fees, "ERC20InsufficientBalance");
        });

        it("sufficient balance (can pay fees)", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Transfer 100 tokens to account1 from the owner
            await fees.transfer(account1.address, 100n);
            // Verify that account1 has 100 tokens
            expect(await fees.balanceOf(account1.address)).to.equal(100n);
            // Transfer 10 tokens to account2 (account1 will pay 1 token in fees, so total cost is 11 tokens)
            await feesFromAccount1.transfer(account2.address, 10n);
            // Verify that account1 has 89 tokens (100 - 10 - 1 fee)
            expect(await fees.balanceOf(account1.address)).to.equal(89n);
            // Verify that account2 has 10 tokens
            expect(await fees.balanceOf(account2.address)).to.equal(10);
        });

        // Tests supplémentaires pour transfer
        it("transfer to zero address should revert", async function () {
            const { fees, account1 } = await loadFixture(deployFeesFixture);
            // Give account1 some tokens to work with
            await fees.transfer(account1.address, 100n);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Try to transfer to zero address (should fail)
            await expect(feesFromAccount1.transfer("0x0000000000000000000000000000000000000000", 10n))
                .to.be.revertedWithCustomError(fees, "ERC20InvalidReceiver");
        });

        it("transfer from zero address should revert", async function () {
            const { fees, account1 } = await loadFixture(deployFeesFixture);
            // Test transferFrom from zero address, not transfer
            await expect(fees.transferFrom("0x0000000000000000000000000000000000000000", account1.address, 10n))
                .to.be.revertedWithCustomError(fees, "ERC20InsufficientAllowance");
        });

        it("transfer with exact balance (including fees)", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Transfer exactly what account1 needs: 100 tokens + 10 fees = 110 tokens
            await fees.transfer(account1.address, 110n); // 100 + 10 fees
            // Transfer 100 tokens to account2 (account1 will pay 10 fees, leaving 0 balance)
            await feesFromAccount1.transfer(account2.address, 100n);
            // Verify that account1 has 0 tokens (110 - 100 - 10 fees)
            expect(await fees.balanceOf(account1.address)).to.equal(0n);
            // Verify that account2 has 100 tokens
            expect(await fees.balanceOf(account2.address)).to.equal(100n);
        });

        it("transfer with minimum amount (1 wei)", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Transfer 11 tokens to account1 (1 token + 10 fees, but 1 * 10% = 0.1, rounded down to 0)
            await fees.transfer(account1.address, 11n); // 1 + 10 fees (1 * 10% = 0.1, rounded down to 0)
            // Transfer 1 token to account2 (no fees since 1 * 10% = 0.1, rounded down to 0)
            await feesFromAccount1.transfer(account2.address, 1n);
            // Verify that account1 has 10 tokens (11 - 1 - 0 fees)
            expect(await fees.balanceOf(account1.address)).to.equal(10n); // 11 - 1 - 0 fees
            // Verify that account2 has 1 token
            expect(await fees.balanceOf(account2.address)).to.equal(1n);
        });

        it("transfer with large amount", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Define a large transfer amount
            const largeAmount = 1000000n;
            // Calculate fees: 10% of the transfer amount
            const feesAmount = (largeAmount * BigInt(PERCENTAGE_FEES)) / 100n; // 10% fees
            // Calculate total needed: transfer amount + fees
            const totalNeeded = largeAmount + feesAmount;
            // Transfer the total amount needed to account1
            await fees.transfer(account1.address, totalNeeded);
            // Transfer the large amount to account2
            await feesFromAccount1.transfer(account2.address, largeAmount);
            // Verify that account1 has 0 tokens (all tokens were used for transfer + fees)
            expect(await fees.balanceOf(account1.address)).to.equal(0n);
            // Verify that account2 has the large amount
            expect(await fees.balanceOf(account2.address)).to.equal(largeAmount);
        });

        it("transfer to self should work", async function () {
            const { fees, account1 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Give account1 enough tokens to transfer to itself
            await fees.transfer(account1.address, 110n);
            // Record initial balance
            const initialBalance = await fees.balanceOf(account1.address);
            // Transfer 100 tokens to self (will pay 10 fees)
            await feesFromAccount1.transfer(account1.address, 100n);
            // Record final balance
            const finalBalance = await fees.balanceOf(account1.address);
            // Should lose 10 tokens in fees (110 - 100 - 10 fees = 0, but we're transferring to self)
            expect(finalBalance).to.equal(initialBalance - 10n);
        });

        it("multiple transfers should accumulate fees correctly", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Give account1 1000 tokens to work with
            await fees.transfer(account1.address, 1000n);

            // First transfer: 100 tokens, fees = 10
            await feesFromAccount1.transfer(account2.address, 100n);
            // Verify account1 has 890 tokens (1000 - 100 - 10 fees)
            expect(await fees.balanceOf(account1.address)).to.equal(890n); // 1000 - 100 - 10

            // Second transfer: 200 tokens, fees = 20
            await feesFromAccount1.transfer(account2.address, 200n);
            // Verify account1 has 670 tokens (890 - 200 - 20 fees)
            expect(await fees.balanceOf(account1.address)).to.equal(670n); // 890 - 200 - 20

            // Third transfer: 300 tokens, fees = 30
            await feesFromAccount1.transfer(account2.address, 300n);
            // Verify account1 has 340 tokens (670 - 300 - 30 fees)
            expect(await fees.balanceOf(account1.address)).to.equal(340n); // 670 - 300 - 30

            // Verify account2 has 600 tokens (100 + 200 + 300)
            expect(await fees.balanceOf(account2.address)).to.equal(600n); // 100 + 200 + 300
        });

        it("transfer should emit Transfer event", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Give account1 enough tokens to transfer
            await fees.transfer(account1.address, 110n);
            // Verify that the transfer emits a Transfer event with correct parameters
            await expect(feesFromAccount1.transfer(account2.address, 100n))
                .to.emit(fees, "Transfer")
                .withArgs(account1.address, account2.address, 100n);
        });

        it("transfer with fees calculation edge case", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Transfer amount that results in fractional fees (should round down)
            await fees.transfer(account1.address, 15n); // 15 total
            // Transfer 5 tokens (5 * 10% = 0.5 fees, but fees should be 0 due to rounding down)
            await feesFromAccount1.transfer(account2.address, 5n); // 5 + 0.5 fees = 5.5, but fees should be 0
            // Verify account1 has 10 tokens (15 - 5 - 0 fees)
            expect(await fees.balanceOf(account1.address)).to.equal(10n);
            // Verify account2 has 5 tokens
            expect(await fees.balanceOf(account2.address)).to.equal(5n);
        });
    });

    // --------------------------------- TransferFrom
    describe("TransferFrom", function () {
        it("insufficient allowance", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Give account1 some tokens
            await fees.transfer(account1.address, 100n);
            // Try to transferFrom without approval (should fail)
            await expect(feesFromAccount1.transferFrom(account1.address, account2.address, 100n)).to.be.revertedWithCustomError(fees, "ERC20InsufficientAllowance");
        });

        it("insufficient balance", async function () {
            const { fees, account1, account2, owner } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1 and account2
            const feesFromAccount1 = await fees.connect(account1);
            const feesFromAccount2 = await fees.connect(account2);
            // Give account1 100 tokens
            await fees.transfer(account1.address, 100n);
            // Approve account2 to spend 30 tokens from account1
            await feesFromAccount1.approve(account2.address, 30n);
            // Try to transfer 50 tokens (more than approved allowance)
            await expect(feesFromAccount2.transferFrom(account1.address, owner.address, 50n)).to.be.revertedWithCustomError(fees, "ERC20InsufficientBalance");
        });

        it("sufficient allowance and balance", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1 and account2
            const feesFromAccount1 = await fees.connect(account1);
            const feesFromAccount2 = await fees.connect(account2);
            // Give both accounts some tokens
            await fees.transfer(account1.address, 100n);
            await fees.transfer(account2.address, 100n);
            // Approve account2 to spend 100 tokens from account1
            await feesFromAccount1.approve(account2.address, 100n);
            // Transfer 10 tokens from account1 to account2 (account2 pays the fees)
            await feesFromAccount2.transferFrom(account1.address, account2.address, 10n);
            // Verify account1 has 90 tokens (100 - 10)
            expect(await fees.balanceOf(account1.address)).to.equal(90n);
            // Verify account2 has 109 tokens (100 + 10 - 1 fee)
            expect(await fees.balanceOf(account2.address)).to.equal(109n);
        });

        // Tests supplémentaires pour transferFrom
        it("transferFrom with unlimited allowance", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1 and account2
            const feesFromAccount1 = await fees.connect(account1);
            const feesFromAccount2 = await fees.connect(account2);
            // Give accounts tokens
            await fees.transfer(account1.address, 1000n);
            await fees.transfer(account2.address, 100n);
            // Approve unlimited allowance (MaxUint256)
            await feesFromAccount1.approve(account2.address, ethers.MaxUint256);
            // Transfer 500 tokens from account1 to account2
            await feesFromAccount2.transferFrom(account1.address, account2.address, 500n);
            // Verify account1 has 500 tokens (1000 - 500)
            expect(await fees.balanceOf(account1.address)).to.equal(500n);
            // Verify account2 has 550 tokens (100 + 500 - 50 fees)
            expect(await fees.balanceOf(account2.address)).to.equal(550n); // 100 + 500 - 50 fees
        });

        it("transferFrom should reduce allowance correctly", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1 and account2
            const feesFromAccount1 = await fees.connect(account1);
            const feesFromAccount2 = await fees.connect(account2);
            // Give accounts tokens
            await fees.transfer(account1.address, 100n);
            await fees.transfer(account2.address, 100n);
            // Approve 50 tokens
            await feesFromAccount1.approve(account2.address, 50n);
            // Transfer 30 tokens (less than approved)
            await feesFromAccount2.transferFrom(account1.address, account2.address, 30n);
            // Verify allowance is reduced to 20 tokens (50 - 30)
            expect(await fees.allowance(account1.address, account2.address)).to.equal(20n);
        });

        it("transferFrom with exact allowance", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1 and account2
            const feesFromAccount1 = await fees.connect(account1);
            const feesFromAccount2 = await fees.connect(account2);
            // Give accounts tokens
            await fees.transfer(account1.address, 100n);
            await fees.transfer(account2.address, 100n);
            // Approve exactly 50 tokens
            await feesFromAccount1.approve(account2.address, 50n);
            // Transfer exactly 50 tokens (using all allowance)
            await feesFromAccount2.transferFrom(account1.address, account2.address, 50n);
            // Verify allowance is now 0
            expect(await fees.allowance(account1.address, account2.address)).to.equal(0n);
            // Verify account1 has 50 tokens (100 - 50)
            expect(await fees.balanceOf(account1.address)).to.equal(50n);
            // Verify account2 has 145 tokens (100 + 50 - 5 fees)
            expect(await fees.balanceOf(account2.address)).to.equal(145n); // 100 + 50 - 5 fees
        });

        it("transferFrom should fail with insufficient allowance after partial transfer", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1 and account2
            const feesFromAccount1 = await fees.connect(account1);
            const feesFromAccount2 = await fees.connect(account2);
            // Give accounts tokens
            await fees.transfer(account1.address, 100n);
            await fees.transfer(account2.address, 100n);
            // Approve 50 tokens
            await feesFromAccount1.approve(account2.address, 50n);
            // Transfer 30 tokens (uses 30 of 50 allowance)
            await feesFromAccount2.transferFrom(account1.address, account2.address, 30n);
            // Try to transfer 30 more tokens (should fail, only 20 allowance remaining)
            await expect(feesFromAccount2.transferFrom(account1.address, account2.address, 30n))
                .to.be.revertedWithCustomError(fees, "ERC20InsufficientAllowance");
        });

        it("transferFrom should pay fees from spender", async function () {
            const { fees, account1, account2, account3 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1 and account2
            const feesFromAccount1 = await fees.connect(account1);
            const feesFromAccount2 = await fees.connect(account2);
            // Give accounts tokens
            await fees.transfer(account1.address, 100n);
            await fees.transfer(account2.address, 100n);
            // Approve account2 to spend 50 tokens from account1
            await feesFromAccount1.approve(account2.address, 50n);
            // Transfer 50 tokens from account1 to account3 (account2 pays the fees)
            await feesFromAccount2.transferFrom(account1.address, account3.address, 50n);
            // Verify account1 has 50 tokens (100 - 50)
            expect(await fees.balanceOf(account1.address)).to.equal(50n);
            // Verify account2 has 95 tokens (100 - 5 fees)
            expect(await fees.balanceOf(account2.address)).to.equal(95n); // 100 - 5 fees
            // Verify account3 has 50 tokens
            expect(await fees.balanceOf(account3.address)).to.equal(50n);
        });

        it("transferFrom to zero address should revert", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1 and account2
            const feesFromAccount1 = await fees.connect(account1);
            const feesFromAccount2 = await fees.connect(account2);
            // Give accounts tokens
            await fees.transfer(account1.address, 100n);
            await fees.transfer(account2.address, 100n);
            // Approve account2 to spend tokens from account1
            await feesFromAccount1.approve(account2.address, 50n);
            // Try to transfer to zero address (should fail)
            await expect(feesFromAccount2.transferFrom(account1.address, "0x0000000000000000000000000000000000000000", 50n))
                .to.be.revertedWithCustomError(fees, "ERC20InvalidReceiver");
        });

        it("transferFrom from zero address should revert", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account2
            const feesFromAccount2 = await fees.connect(account2);
            // Give account2 some tokens
            await fees.transfer(account2.address, 100n);
            // Try to transfer from zero address (should fail)
            await expect(feesFromAccount2.transferFrom("0x0000000000000000000000000000000000000000", account1.address, 50n))
                .to.be.revertedWithCustomError(fees, "ERC20InsufficientAllowance");
        });

        it("transferFrom should emit Transfer event", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1 and account2
            const feesFromAccount1 = await fees.connect(account1);
            const feesFromAccount2 = await fees.connect(account2);
            // Give accounts tokens
            await fees.transfer(account1.address, 100n);
            await fees.transfer(account2.address, 100n);
            // Approve account2 to spend tokens from account1
            await feesFromAccount1.approve(account2.address, 50n);
            // Verify that transferFrom emits a Transfer event with correct parameters
            await expect(feesFromAccount2.transferFrom(account1.address, account2.address, 50n))
                .to.emit(fees, "Transfer")
                .withArgs(account1.address, account2.address, 50n);
        });

        it("multiple transferFrom operations should work correctly", async function () {
            const { fees, account1, account2, account3 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as all accounts
            const feesFromAccount1 = await fees.connect(account1);
            const feesFromAccount2 = await fees.connect(account2);
            const feesFromAccount3 = await fees.connect(account3);

            // Give all accounts tokens
            await fees.transfer(account1.address, 1000n);
            await fees.transfer(account2.address, 100n);
            await fees.transfer(account3.address, 100n);

            // Approve account2 and account3 to spend tokens from account1
            await feesFromAccount1.approve(account2.address, 300n);
            await feesFromAccount1.approve(account3.address, 200n);

            // First transferFrom: 100 tokens, fees = 10
            await feesFromAccount2.transferFrom(account1.address, account2.address, 100n);
            // Verify account1 has 900 tokens (1000 - 100)
            expect(await fees.balanceOf(account1.address)).to.equal(900n);
            // Verify account2 has 190 tokens (100 + 100 - 10 fees)
            expect(await fees.balanceOf(account2.address)).to.equal(190n); // 100 + 100 - 10 fees
            // Verify allowance is reduced to 200 tokens (300 - 100)
            expect(await fees.allowance(account1.address, account2.address)).to.equal(200n);

            // Second transferFrom: 150 tokens, fees = 15
            await feesFromAccount3.transferFrom(account1.address, account3.address, 150n);
            // Verify account1 has 750 tokens (900 - 150)
            expect(await fees.balanceOf(account1.address)).to.equal(750n);
            // Verify account3 has 235 tokens (100 + 150 - 15 fees)
            expect(await fees.balanceOf(account3.address)).to.equal(235n); // 100 + 150 - 15 fees
            // Verify allowance is reduced to 50 tokens (200 - 150)
            expect(await fees.allowance(account1.address, account3.address)).to.equal(50n);

            // Third transferFrom: 200 tokens, fees = 20
            await feesFromAccount2.transferFrom(account1.address, account2.address, 200n);
            // Verify account1 has 550 tokens (750 - 200)
            expect(await fees.balanceOf(account1.address)).to.equal(550n);
            // Verify account2 has 370 tokens (190 + 200 - 20 fees)
            expect(await fees.balanceOf(account2.address)).to.equal(370n); // 190 + 200 - 20 fees
            // Verify allowance is now 0 (200 - 200)
            expect(await fees.allowance(account1.address, account2.address)).to.equal(0n);
        });

        it("transferFrom with fees calculation edge case", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1 and account2
            const feesFromAccount1 = await fees.connect(account1);
            const feesFromAccount2 = await fees.connect(account2);
            // Give accounts tokens
            await fees.transfer(account1.address, 100n);
            await fees.transfer(account2.address, 15n);
            // Approve account2 to spend tokens from account1
            await feesFromAccount1.approve(account2.address, 10n);
            // Transfer 5 tokens (5 * 10% = 0.5 fees, but fees should be 0 due to rounding down)
            await feesFromAccount2.transferFrom(account1.address, account2.address, 5n);
            // Verify account1 has 95 tokens (100 - 5)
            expect(await fees.balanceOf(account1.address)).to.equal(95n);
            // Verify account2 has 20 tokens (15 - 0.5 fees rounded down to 0 + 5)
            expect(await fees.balanceOf(account2.address)).to.equal(20n); // 15 - 0.5 fees (rounded down to 0) + 5
        });

        it("transferFrom should fail when spender has no balance for fees", async function () {
            const { fees, account1, account2, account3 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1 and account2
            const feesFromAccount1 = await fees.connect(account1);
            const feesFromAccount2 = await fees.connect(account2);
            // Give account1 tokens but not account2
            await fees.transfer(account1.address, 100n);
            // Approve account2 to spend tokens from account1
            await feesFromAccount1.approve(account2.address, 50n);
            // Try to transfer (should fail because account2 has no balance to pay fees)
            await expect(feesFromAccount2.transferFrom(account1.address, account3.address, 50n))
                .to.be.revertedWithCustomError(fees, "ERC20InsufficientBalance");
        });
    });
});

describe("Transfer Edge Cases", function () {
    // --------------------------------- Transfer Edge Cases
    describe("Transfer Edge Cases", function () {
        it("Should handle transfer with insufficient balance", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Give account1 only 50 tokens
            await fees.transfer(account1.address, 50n);

            // Try to transfer 100 tokens (more than balance)
            await expect(feesFromAccount1.transfer(account2.address, 100n))
                .to.be.revertedWithCustomError(fees, "ERC20InsufficientBalance");
        });

        it("Should handle transferFrom with insufficient balance", async function () {
            const { fees, account1, account2, account3 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1 and account2
            const feesFromAccount1 = await fees.connect(account1);
            const feesFromAccount2 = await fees.connect(account2);

            // Give account1 only 50 tokens
            await fees.transfer(account1.address, 50n);
            await fees.transfer(account2.address, 100n);
            // Approve account2 to spend 100 tokens from account1
            await feesFromAccount1.approve(account2.address, 100n);

            // Try to transferFrom 100 tokens (more than account1's balance)
            await expect(feesFromAccount2.transferFrom(account1.address, account3.address, 100n))
                .to.be.revertedWithCustomError(fees, "ERC20InsufficientBalance");
        });

        it("Should handle transferFrom with insufficient allowance", async function () {
            const { fees, account1, account2, account3 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1 and account2
            const feesFromAccount1 = await fees.connect(account1);
            const feesFromAccount2 = await fees.connect(account2);

            // Give accounts tokens
            await fees.transfer(account1.address, 1000n);
            await fees.transfer(account2.address, 100n);
            // Approve account2 to spend only 50 tokens from account1
            await feesFromAccount1.approve(account2.address, 50n);

            // Try to transferFrom 100 tokens (more than allowance)
            await expect(feesFromAccount2.transferFrom(account1.address, account3.address, 100n))
                .to.be.revertedWithCustomError(fees, "ERC20InsufficientAllowance");
        });

        it("Should handle transfer to self", async function () {
            const { fees, account1 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Give account1 some tokens
            await fees.transfer(account1.address, 1000n);

            const initialBalance = await fees.balanceOf(account1.address);
            const initialFees = await fees.getCollectedFees();

            // Transfer to self should still collect fees
            await feesFromAccount1.transfer(account1.address, 100n);

            // Verify balance is reduced by fees only
            expect(await fees.balanceOf(account1.address)).to.equal(initialBalance - 10n);
            // Verify fees were collected
            expect(await fees.getCollectedFees()).to.equal(initialFees + 10n);
        });

        it("Should handle transferFrom to self", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1 and account2
            const feesFromAccount1 = await fees.connect(account1);
            const feesFromAccount2 = await fees.connect(account2);

            // Give accounts tokens
            await fees.transfer(account1.address, 1000n);
            await fees.transfer(account2.address, 100n);
            // Approve account2 to spend tokens from account1
            await feesFromAccount1.approve(account2.address, 500n);

            const initialBalance1 = await fees.balanceOf(account1.address);
            const initialBalance2 = await fees.balanceOf(account2.address);
            const initialFees = await fees.getCollectedFees();

            // TransferFrom to self should still collect fees
            await feesFromAccount2.transferFrom(account1.address, account2.address, 100n);

            // Verify account1 balance is reduced by transfer amount
            expect(await fees.balanceOf(account1.address)).to.equal(initialBalance1 - 100n);
            // Verify account2 balance is increased by transfer amount minus fees
            expect(await fees.balanceOf(account2.address)).to.equal(initialBalance2 + 100n - 10n);
            // Verify fees were collected
            expect(await fees.getCollectedFees()).to.equal(initialFees + 10n);
        });

        it("Should handle transfer with exact balance", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Give account1 exactly 110 tokens (100 for transfer + 10 for fees)
            await fees.transfer(account1.address, 110n);

            // Transfer exactly 100 tokens
            await feesFromAccount1.transfer(account2.address, 100n);

            // Verify account1 has 0 tokens (110 - 100 - 10 fees)
            expect(await fees.balanceOf(account1.address)).to.equal(0n);
            // Verify account2 has 100 tokens
            expect(await fees.balanceOf(account2.address)).to.equal(100n);
        });

        it("Should handle transferFrom with exact balance", async function () {
            const { fees, account1, account2, account3 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1 and account2
            const feesFromAccount1 = await fees.connect(account1);
            const feesFromAccount2 = await fees.connect(account2);

            // Give account1 exactly 100 tokens
            await fees.transfer(account1.address, 100n);
            // Give account2 exactly 110 tokens (100 for transfer + 10 for fees)
            await fees.transfer(account2.address, 110n);
            // Approve account2 to spend tokens from account1
            await feesFromAccount1.approve(account2.address, 500n);

            // TransferFrom exactly 100 tokens
            await feesFromAccount2.transferFrom(account1.address, account3.address, 100n);

            // Verify account1 has 0 tokens (100 - 100)
            expect(await fees.balanceOf(account1.address)).to.equal(0n);
            // Verify account2 has 100 tokens (110 - 10 fees)
            expect(await fees.balanceOf(account2.address)).to.equal(100n);
            // Verify account3 has 100 tokens
            expect(await fees.balanceOf(account3.address)).to.equal(100n);
        });

        it("Should handle transfer with zero amount", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Give account1 some tokens
            await fees.transfer(account1.address, 1000n);

            const initialBalance1 = await fees.balanceOf(account1.address);
            const initialBalance2 = await fees.balanceOf(account2.address);
            const initialFees = await fees.getCollectedFees();

            // Transfer 0 tokens
            await feesFromAccount1.transfer(account2.address, 0n);

            // Verify balances unchanged
            expect(await fees.balanceOf(account1.address)).to.equal(initialBalance1);
            expect(await fees.balanceOf(account2.address)).to.equal(initialBalance2);
            // Verify no fees collected
            expect(await fees.getCollectedFees()).to.equal(initialFees);
        });

        it("Should handle transferFrom with zero amount", async function () {
            const { fees, account1, account2, account3 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1 and account2
            const feesFromAccount1 = await fees.connect(account1);
            const feesFromAccount2 = await fees.connect(account2);

            // Give accounts tokens
            await fees.transfer(account1.address, 1000n);
            await fees.transfer(account2.address, 100n);
            // Approve account2 to spend tokens from account1
            await feesFromAccount1.approve(account2.address, 500n);

            const initialBalance1 = await fees.balanceOf(account1.address);
            const initialBalance2 = await fees.balanceOf(account2.address);
            const initialBalance3 = await fees.balanceOf(account3.address);
            const initialFees = await fees.getCollectedFees();

            // TransferFrom 0 tokens
            await feesFromAccount2.transferFrom(account1.address, account3.address, 0n);

            // Verify balances unchanged
            expect(await fees.balanceOf(account1.address)).to.equal(initialBalance1);
            expect(await fees.balanceOf(account2.address)).to.equal(initialBalance2);
            expect(await fees.balanceOf(account3.address)).to.equal(initialBalance3);
            // Verify no fees collected
            expect(await fees.getCollectedFees()).to.equal(initialFees);
        });

        it("Should handle approval edge cases", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);

            // Test approval of 0
            await feesFromAccount1.approve(account2.address, 0n);
            expect(await fees.allowance(account1.address, account2.address)).to.equal(0n);

            // Test approval of maximum uint256
            const maxApproval = 2n ** 256n - 1n;
            await feesFromAccount1.approve(account2.address, maxApproval);
            expect(await fees.allowance(account1.address, account2.address)).to.equal(maxApproval);

            // Test approval to zero address (should fail)
            await expect(feesFromAccount1.approve(ethers.ZeroAddress, 100n))
                .to.be.revertedWithCustomError(fees, "ERC20InvalidSpender");
        });

        it("Should handle allowance updates correctly", async function () {
            const { fees, account1, account2 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);

            // Initial approval
            await feesFromAccount1.approve(account2.address, 100n);
            expect(await fees.allowance(account1.address, account2.address)).to.equal(100n);

            // Update approval to higher value
            await feesFromAccount1.approve(account2.address, 200n);
            expect(await fees.allowance(account1.address, account2.address)).to.equal(200n);

            // Update approval to lower value
            await feesFromAccount1.approve(account2.address, 50n);
            expect(await fees.allowance(account1.address, account2.address)).to.equal(50n);

            // Update approval to 0
            await feesFromAccount1.approve(account2.address, 0n);
            expect(await fees.allowance(account1.address, account2.address)).to.equal(0n);
        });

        it("Should handle transferFrom with partial allowance usage", async function () {
            const { fees, account1, account2, account3 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1 and account2
            const feesFromAccount1 = await fees.connect(account1);
            const feesFromAccount2 = await fees.connect(account2);

            // Give accounts tokens
            await fees.transfer(account1.address, 1000n);
            await fees.transfer(account2.address, 100n);
            // Approve account2 to spend 500 tokens from account1
            await feesFromAccount1.approve(account2.address, 500n);

            // Use only 100 tokens of the 500 allowance
            await feesFromAccount2.transferFrom(account1.address, account3.address, 100n);

            // Verify allowance is reduced
            expect(await fees.allowance(account1.address, account2.address)).to.equal(400n);

            // Use another 200 tokens
            await feesFromAccount2.transferFrom(account1.address, account3.address, 200n);

            // Verify allowance is further reduced
            expect(await fees.allowance(account1.address, account2.address)).to.equal(200n);
        });

        it("Should handle transferFrom with exact allowance", async function () {
            const { fees, account1, account2, account3 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1 and account2
            const feesFromAccount1 = await fees.connect(account1);
            const feesFromAccount2 = await fees.connect(account2);

            // Give accounts tokens
            await fees.transfer(account1.address, 1000n);
            await fees.transfer(account2.address, 100n);
            // Approve account2 to spend exactly 100 tokens from account1
            await feesFromAccount1.approve(account2.address, 100n);

            // Use exactly 100 tokens
            await feesFromAccount2.transferFrom(account1.address, account3.address, 100n);

            // Verify allowance is 0
            expect(await fees.allowance(account1.address, account2.address)).to.equal(0n);

            // Try to use more tokens (should fail)
            await expect(feesFromAccount2.transferFrom(account1.address, account3.address, 1n))
                .to.be.revertedWithCustomError(fees, "ERC20InsufficientAllowance");
        });

        it("Should handle multiple transfers in sequence", async function () {
            const { fees, account1, account2, account3 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1
            const feesFromAccount1 = await fees.connect(account1);
            // Give account1 enough tokens
            await fees.transfer(account1.address, 1000n);

            const initialFees = await fees.getCollectedFees();

            // Multiple transfers
            await feesFromAccount1.transfer(account2.address, 100n); // 10 fees
            await feesFromAccount1.transfer(account3.address, 200n); // 20 fees
            await feesFromAccount1.transfer(account2.address, 50n);  // 5 fees

            // Verify final balances
            expect(await fees.balanceOf(account1.address)).to.equal(615n); // 1000 - 100 - 200 - 50 - 10 - 20 - 5
            expect(await fees.balanceOf(account2.address)).to.equal(150n); // 100 + 50
            expect(await fees.balanceOf(account3.address)).to.equal(200n); // 200
            // Verify total fees collected
            expect(await fees.getCollectedFees()).to.equal(initialFees + 35n); // 10 + 20 + 5
        });

        it("Should handle multiple transferFrom operations in sequence", async function () {
            const { fees, account1, account2, account3 } = await loadFixture(deployFeesFixture);
            // Connect to the contract as account1 and account2
            const feesFromAccount1 = await fees.connect(account1);
            const feesFromAccount2 = await fees.connect(account2);

            // Give accounts tokens
            await fees.transfer(account1.address, 1000n);
            await fees.transfer(account2.address, 500n);
            // Approve account2 to spend tokens from account1
            await feesFromAccount1.approve(account2.address, 500n);

            const initialFees = await fees.getCollectedFees();

            // Multiple transferFrom operations
            await feesFromAccount2.transferFrom(account1.address, account3.address, 100n); // 10 fees
            await feesFromAccount2.transferFrom(account1.address, account2.address, 200n); // 20 fees
            await feesFromAccount2.transferFrom(account1.address, account3.address, 50n);  // 5 fees

            // Verify final balances
            expect(await fees.balanceOf(account1.address)).to.equal(650n); // 1000 - 100 - 200 - 50
            expect(await fees.balanceOf(account2.address)).to.equal(665n); // 500 - 10 - 20 - 5 + 200
            expect(await fees.balanceOf(account3.address)).to.equal(150n); // 100 + 50
            // Verify total fees collected
            expect(await fees.getCollectedFees()).to.equal(initialFees + 35n); // 10 + 20 + 5
        });
    });
});
