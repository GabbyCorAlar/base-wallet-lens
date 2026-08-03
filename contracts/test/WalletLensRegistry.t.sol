// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {WalletLensRegistry} from "../src/WalletLensRegistry.sol";

contract WalletLensRegistryTest is Test {
    WalletLensRegistry internal registry;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    function setUp() public {
        registry = new WalletLensRegistry();
    }

    function test_PublishStoresSnapshot() public {
        vm.prank(alice);
        registry.publish(42, 1 ether, 2 ether, 20000, 15, 7);

        WalletLensRegistry.Snapshot memory snap = registry.snapshotOf(alice);
        assertEq(snap.txCount, 42);
        assertEq(snap.gasSpentWei, 1 ether);
        assertEq(snap.bridgedInWei, 2 ether);
        assertEq(snap.activeDays, 15);
        assertEq(snap.longestStreak, 7);
        assertTrue(registry.hasSnapshot(alice));
        assertEq(registry.walletCount(), 1);
    }

    function test_RepublishOverwritesWithoutDuplicatingWallet() public {
        vm.startPrank(alice);
        registry.publish(42, 1 ether, 0, 20000, 15, 7);
        registry.publish(100, 2 ether, 0, 20000, 30, 12);
        vm.stopPrank();

        assertEq(registry.snapshotOf(alice).txCount, 100);
        assertEq(registry.walletCount(), 1);
    }

    function test_WalletsAreIsolated() public {
        vm.prank(alice);
        registry.publish(42, 0, 0, 20000, 15, 7);

        assertEq(registry.snapshotOf(bob).txCount, 0);
        assertFalse(registry.hasSnapshot(bob));
    }

    function test_RevertsOnEmptySnapshot() public {
        vm.expectRevert(WalletLensRegistry.EmptySnapshot.selector);
        vm.prank(alice);
        registry.publish(0, 0, 0, 0, 0, 0);
    }

    function testFuzz_RoundTrip(uint64 txCount, uint32 activeDays, uint32 streak) public {
        vm.assume(txCount > 0);
        vm.prank(bob);
        registry.publish(txCount, 0, 0, 19000, activeDays, streak);

        WalletLensRegistry.Snapshot memory snap = registry.snapshotOf(bob);
        assertEq(snap.txCount, txCount);
        assertEq(snap.activeDays, activeDays);
        assertEq(snap.longestStreak, streak);
    }
}
