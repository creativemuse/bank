// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "@forge-std/Script.sol";
import {AaveV3Strategy} from "../contracts/strategies/AaveV3Strategy.sol";
import {CompoundV3Strategy} from "../contracts/strategies/CompoundV3Strategy.sol";
import {CurveStrategy} from "../contracts/strategies/CurveStrategy.sol";
import {SparkStrategy} from "../contracts/strategies/SparkStrategy.sol";
import {BaseAddresses} from "../contracts/config/BaseAddresses.sol";

/**
 * @title DeployStrategies
 * @notice Script to deploy all 4 Tokenized Strategies on Base
 */
contract DeployStrategies is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        address usdc = BaseAddresses.USDC;

        // Deploy Aave V3 Strategy
        AaveV3Strategy aaveStrategy = new AaveV3Strategy(
            usdc,
            "Creative Bank Aave V3 USDC Strategy"
        );
        console.log("Aave V3 Strategy deployed at:", address(aaveStrategy));

        // Deploy Compound V3 Strategy
        CompoundV3Strategy compoundStrategy = new CompoundV3Strategy(
            usdc,
            "Creative Bank Compound V3 USDC Strategy"
        );
        console.log("Compound V3 Strategy deployed at:", address(compoundStrategy));

        // Deploy Curve Strategy
        CurveStrategy curveStrategy = new CurveStrategy(
            usdc,
            "Creative Bank Curve 3pool USDC Strategy"
        );
        console.log("Curve Strategy deployed at:", address(curveStrategy));

        // Deploy Spark Strategy
        SparkStrategy sparkStrategy = new SparkStrategy(
            usdc,
            "Creative Bank Spark USDC Strategy"
        );
        console.log("Spark Strategy deployed at:", address(sparkStrategy));

        vm.stopBroadcast();

        // Output addresses for frontend integration
        console.log("\n=== Strategy Deployment Summary ===");
        console.log("Aave V3 Strategy:", address(aaveStrategy));
        console.log("Compound V3 Strategy:", address(compoundStrategy));
        console.log("Curve Strategy:", address(curveStrategy));
        console.log("Spark Strategy:", address(sparkStrategy));
    }
}
