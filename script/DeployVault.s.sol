// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "@forge-std/Script.sol";
import {BaseAddresses} from "../contracts/config/BaseAddresses.sol";

// Interface for Role Manager Factory
interface IRoleManagerFactory {
    function newProject(
        string memory projectName,
        address governance,
        address management
    ) external returns (address roleManager);
}

// Interface for Role Manager
interface IRoleManager {
    function newVault(
        address asset,
        uint256 category,
        string memory vaultName,
        string memory vaultSymbol
    ) external returns (address vault);
}

/**
 * @title DeployVault
 * @notice Script to deploy Yearn V3 Allocator Vault using RoleManagerFactory
 */
contract DeployVault is Script {
    // Role Manager Factory address (same across all chains)
    address constant ROLE_MANAGER_FACTORY = BaseAddresses.ROLE_MANAGER_FACTORY;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Get addresses from environment or use deployer as default
        address governance = vm.envOr("GOVERNANCE_ADDRESS", vm.addr(deployerPrivateKey));
        address management = vm.envOr("MANAGEMENT_ADDRESS", vm.addr(deployerPrivateKey));

        require(governance != management, "Governance and management must be different addresses");

        IRoleManagerFactory factory = IRoleManagerFactory(ROLE_MANAGER_FACTORY);

        console.log("Deploying Role Manager...");
        console.log("Project Name: Creative Bank");
        console.log("Governance:", governance);
        console.log("Management:", management);

        // Deploy new Role Manager for Creative Bank project
        address roleManager = factory.newProject(
            "Creative Bank",
            governance,
            management
        );

        console.log("Role Manager deployed at:", roleManager);

        // Deploy the Allocator Vault
        IRoleManager rm = IRoleManager(roleManager);
        address asset = BaseAddresses.USDC;
        uint256 category = 1; // Category 1 for conservative strategies

        console.log("\nDeploying Allocator Vault...");
        console.log("Asset (USDC):", asset);
        console.log("Category:", category);

        address vault = rm.newVault(
            asset,
            category,
            "Creative Bank Multi-Strategy USDC",
            "cbUSDC-v2"
        );

        console.log("\n=== Vault Deployment Complete ===");
        console.log("Vault Address:", vault);
        console.log("Role Manager:", roleManager);
        console.log("Asset:", asset);

        vm.stopBroadcast();
    }
}
