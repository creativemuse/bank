// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "@forge-std/Script.sol";
import {CreativeBankBouncer} from "../contracts/CreativeBankBouncer.sol";

/**
 * @title DeployCreativeBankBouncer
 * @notice Deploys the Creative Bank Bouncer (Yearn V3 deposit limit module) on Base.
 * @dev Membership NFT addresses (Unlock locks on Base):
 *      - Creative Brand:  0x9c3744c96200A52D05a630D4AEC0db707D7509Be
 *      - Creative Investor: 0x13b818dAf7016B302383737bA60c3A39FeF231cF
 *      - Creative Creator:  0xf7c4cd399395D80f9d61FDe833849106775269c6
 *
 * Forge loads .env from the project root only. If your PRIVATE_KEY is in contracts/.env, run:
 *   forge script script/DeployCreativeBankBouncer.s.sol --rpc-url base --broadcast --env-file contracts/.env
 *
 * After deployment:
 * 1. Set NEXT_PUBLIC_CREATIVE_BANK_BOUNCER_ADDRESS in your app .env
 * 2. On the Yearn vault, call set_deposit_limit_module(bouncerAddress) (vault owner only)
 *
 * Verify on Basescan (set BASESCAN_API_KEY; get one at https://basescan.org/myapikey):
 *   forge verify-contract <BOUNCER_ADDRESS> CreativeBankBouncer --chain base \
 *     --constructor-args $(cast abi-encode "constructor(address,address,address)" \
 *       0x9c3744c96200A52D05a630D4AEC0db707D7509Be \
 *       0x13b818dAf7016B302383737bA60c3A39FeF231cF \
 *       0xf7c4cd399395D80f9d61FDe833849106775269c6)
 */
contract DeployCreativeBankBouncer is Script {
    address constant CREATIVE_BRAND = 0x9c3744c96200A52D05a630D4AEC0db707D7509Be;
    address constant CREATIVE_INVESTOR = 0x13b818dAf7016B302383737bA60c3A39FeF231cF;
    address constant CREATIVE_CREATOR = 0xf7c4cd399395D80f9d61FDe833849106775269c6;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        CreativeBankBouncer bouncer = new CreativeBankBouncer(
            CREATIVE_BRAND,
            CREATIVE_INVESTOR,
            CREATIVE_CREATOR
        );

        console.log("CreativeBankBouncer deployed at:", address(bouncer));
        console.log("Next: set vault deposit_limit_module to this address (vault owner only).");
        console.log("Then set NEXT_PUBLIC_CREATIVE_BANK_BOUNCER_ADDRESS=%s", address(bouncer));

        vm.stopBroadcast();
    }
}
