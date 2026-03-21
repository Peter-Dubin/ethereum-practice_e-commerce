// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title EuroToken - ERC20 Stablecoin representing Euros
/// @notice This token is pegged 1:1 to EUR (1 EURT = 1 EUR)
contract EuroToken is ERC20, Ownable {
    /// @notice Initial supply of 1,000,000 tokens (in cents with 6 decimals)
    uint256 public constant INITIAL_SUPPLY = 1_000_000 * 10**6;

    /// @notice Emitted when tokens are minted
    event TokensMinted(address indexed to, uint256 amount);
    /// @notice Emitted when tokens are burned
    event TokensBurned(address indexed from, uint256 amount);

    /// @notice Constructor initializes the token with owner and initial supply
    /// @param initialOwner The address that will own the contract
    constructor(address initialOwner) ERC20("EuroToken", "EURT") Ownable(initialOwner) {
        _mint(initialOwner, INITIAL_SUPPLY);
    }

    /// @notice Returns the number of decimals used for token amounts
    /// @dev Uses 6 decimals to represent euro cents
    /// @return The number of decimals (6)
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mints new tokens to a specified address
    /// @dev Only callable by the contract owner
    /// @param to The address to receive the minted tokens
    /// @param amount The amount of tokens to mint (in smallest units)
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Cannot mint to zero address");
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    /// @notice Burns tokens from the caller's balance
    /// @param amount The amount of tokens to burn
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
        emit TokensBurned(msg.sender, amount);
    }
}
