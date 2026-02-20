// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title CreativeBankBouncer
 * @notice Yearn V3 deposit limit module. Gates vault deposits behind Creative Bank
 *         membership (Creative Brand, Creative Investor, or Creative Creator NFT).
 * @dev Deploy with (brandNFT, investorNFT, creatorNFT) then set as the vault's
 *      deposit_limit_module via set_deposit_limit_module(bouncerAddress).
 */
interface IERC721 {
    function balanceOf(address owner) external view returns (uint256);
}

contract CreativeBankBouncer {
    address public immutable brandNFT;
    address public immutable investorNFT;
    address public immutable creatorNFT;

    constructor(address _brand, address _investor, address _creator) {
        brandNFT = _brand;
        investorNFT = _investor;
        creatorNFT = _creator;
    }

    /**
     * @notice Yearn V3 calls this to see if a deposit is allowed.
     * @param user The address trying to deposit.
     * @return The maximum amount they can deposit (type(uint256).max if they have an NFT, 0 otherwise).
     */
    function availableDepositLimit(address user) external view returns (uint256) {
        bool hasAccess =
            IERC721(brandNFT).balanceOf(user) > 0 ||
            IERC721(investorNFT).balanceOf(user) > 0 ||
            IERC721(creatorNFT).balanceOf(user) > 0;

        return hasAccess ? type(uint256).max : 0;
    }
}
