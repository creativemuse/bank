// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title BaseAddresses
 * @notice Centralized configuration for Base mainnet protocol addresses
 */
library BaseAddresses {
    // USDC on Base (Mainnet: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
    // Base Sepolia Testnet: 0x29684075a3C86ea11D9964BcAf0F956e801396bD
    address public constant USDC = 0x29684075a3C86ea11D9964BcAf0F956e801396bD; // Using testnet address for deployment

    // Aave V3 on Base
    address public constant AAVE_POOL = 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5; // Pool contract
    address public constant AAVE_POOL_ADDRESSES_PROVIDER = 0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D;
    address public constant AAVE_REWARDS_CONTROLLER = 0x6A0406B8103Ec68EE9A713A073C7bD587c5e04aD;

    // Spark Protocol on Base (Spark is an Aave fork)
    address public constant SPARK_POOL = 0x2f6571d3eB9a4e350C68C36Bcd2afBA01f7e3253;
    address public constant SPARK_POOL_ADDRESSES_PROVIDER = 0x78F8Bd884C3D738B74B420540659c82f392820e0;

    // Compound V3 on Base
    address public constant COMPOUND_COMET = 0xb125E6687d4313864e53df431d5425969c15Eb2F; // Comet USDC market

    // Curve on Base - USDC/USDT pool
    address public constant CURVE_3POOL = 0x7f90122BF0700F9E7e1F688fe926940E8839F353; // 3pool
    address public constant CURVE_3CRV_TOKEN = 0x1337BedC9D22ecbe766dF105c9623922A27963EC; // LP token

    // Yearn V3 Infrastructure
    address public constant ROLE_MANAGER_FACTORY = 0xca12459a931643BF28388c67639b3F352fe9e5Ce;
    address public constant PROTOCOL_ADDRESS_PROVIDER = 0x775F09d6f3c8D2182DFA8bce8628acf51105653c;
    address public constant TOKENIZED_STRATEGY = 0xD377919FA87120584B21279a491F82D5265A139c; // Version 3.0.4
}
