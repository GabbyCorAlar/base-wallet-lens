// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {WalletLensRegistry} from "../src/WalletLensRegistry.sol";

/// @notice Deploys WalletLensRegistry.
/// @dev forge script script/Deploy.s.sol:Deploy \
///        --rpc-url base --broadcast --verify -vvvv
contract Deploy is Script {
    function run() external returns (WalletLensRegistry registry) {
        uint256 pk = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(pk);
        registry = new WalletLensRegistry();
        vm.stopBroadcast();

        console.log("WalletLensRegistry deployed at:", address(registry));
    }
}
