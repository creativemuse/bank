// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "@forge-std/Script.sol";

// Interface for Yearn V3 Vault
interface IVault {
    function addStrategy(address strategy) external;
    function updateMaxDebtForStrategy(address strategy, uint256 maxDebt) external;
}

/**
 * @title AddStrategies
 * @notice Script to add all 4 strategies to the deployed vault and configure allocations
 */
contract AddStrategies is Script {

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Get addresses from environment variables
        address vaultAddress = vm.envAddress("VAULT_ADDRESS");
        address aaveStrategy = vm.envAddress("AAVE_STRATEGY");
        address compoundStrategy = vm.envAddress("COMPOUND_STRATEGY");
        address curveStrategy = vm.envAddress("CURVE_STRATEGY");
        address sparkStrategy = vm.envAddress("SPARK_STRATEGY");

        IVault vault = IVault(vaultAddress);

        console.log("Adding strategies to vault:", vaultAddress);
        console.log("\nStrategies to add:");
        console.log("  - Aave V3:", aaveStrategy);
        console.log("  - Compound V3:", compoundStrategy);
        console.log("  - Curve:", curveStrategy);
        console.log("  - Spark:", sparkStrategy);

        // Add all strategies
        console.log("\nAdding Aave V3 Strategy...");
        vault.addStrategy(aaveStrategy);

        console.log("Adding Compound V3 Strategy...");
        vault.addStrategy(compoundStrategy);

        console.log("Adding Curve Strategy...");
        vault.addStrategy(curveStrategy);

        console.log("Adding Spark Strategy...");
        vault.addStrategy(sparkStrategy);

        // Set max debt for each strategy (25% each = 25% of total vault capacity)
        // Max debt is in asset units (USDC), using 1e6 for USDC decimals
        // Example: 1,000,000 USDC max debt = 1e6 * 1e6 = 1e12
        // For unlimited, use type(uint256).max
        uint256 maxDebtPerStrategy = type(uint256).max; // No limit for now

        console.log("\nSetting max debt for strategies...");
        console.log("Max debt per strategy:", maxDebtPerStrategy);

        vault.updateMaxDebtForStrategy(aaveStrategy, maxDebtPerStrategy);
        vault.updateMaxDebtForStrategy(compoundStrategy, maxDebtPerStrategy);
        vault.updateMaxDebtForStrategy(curveStrategy, maxDebtPerStrategy);
        vault.updateMaxDebtForStrategy(sparkStrategy, maxDebtPerStrategy);

        console.log("\n=== Strategies Added Successfully ===");
        console.log("All 4 strategies are now available in the vault");

        vm.stopBroadcast();
    }
}
