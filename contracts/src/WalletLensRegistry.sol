// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title WalletLensRegistry
/// @notice Lets a wallet publish a snapshot of its own Base history onchain.
/// @dev Self-attested and self-sovereign: a wallet can only ever write its own
///      entry, and anyone can read any entry. Values are packed into a single
///      storage slot pair so a snapshot costs one cold write plus one warm one.
contract WalletLensRegistry {
    /// @param txCount        Transactions signed by the wallet on Base.
    /// @param gasSpentWei    Cumulative L2 execution gas paid, in wei.
    /// @param bridgedInWei   ETH deposited from Ethereum L1, in wei.
    /// @param firstTxDay     Days since the Unix epoch of the first transaction.
    /// @param activeDays     Distinct UTC days with activity.
    /// @param longestStreak  Longest run of consecutive active days.
    /// @param updatedAt      Block timestamp of this snapshot.
    struct Snapshot {
        uint64 txCount;
        uint128 gasSpentWei;
        uint128 bridgedInWei;
        uint32 firstTxDay;
        uint32 activeDays;
        uint32 longestStreak;
        uint64 updatedAt;
    }

    mapping(address => Snapshot) private _snapshots;

    /// @notice Wallets that have ever published a snapshot, in insertion order.
    address[] public wallets;

    mapping(address => bool) private _known;

    event SnapshotPublished(
        address indexed wallet,
        uint64 txCount,
        uint128 gasSpentWei,
        uint128 bridgedInWei,
        uint32 activeDays,
        uint32 longestStreak
    );

    error EmptySnapshot();

    /// @notice Publish or overwrite the caller's snapshot.
    /// @dev Only `msg.sender`'s entry can be written, so no access control is
    ///      needed and no snapshot can be forged on someone else's behalf.
    function publish(
        uint64 txCount,
        uint128 gasSpentWei,
        uint128 bridgedInWei,
        uint32 firstTxDay,
        uint32 activeDays,
        uint32 longestStreak
    ) external {
        if (txCount == 0 && activeDays == 0) revert EmptySnapshot();

        if (!_known[msg.sender]) {
            _known[msg.sender] = true;
            wallets.push(msg.sender);
        }

        _snapshots[msg.sender] = Snapshot({
            txCount: txCount,
            gasSpentWei: gasSpentWei,
            bridgedInWei: bridgedInWei,
            firstTxDay: firstTxDay,
            activeDays: activeDays,
            longestStreak: longestStreak,
            updatedAt: uint64(block.timestamp)
        });

        emit SnapshotPublished(
            msg.sender, txCount, gasSpentWei, bridgedInWei, activeDays, longestStreak
        );
    }

    /// @notice Read a wallet's latest snapshot. Returns a zeroed struct if none.
    function snapshotOf(address wallet) external view returns (Snapshot memory) {
        return _snapshots[wallet];
    }

    /// @notice Whether `wallet` has ever published a snapshot.
    function hasSnapshot(address wallet) external view returns (bool) {
        return _known[wallet];
    }

    /// @notice Number of wallets that have published at least one snapshot.
    function walletCount() external view returns (uint256) {
        return wallets.length;
    }
}
