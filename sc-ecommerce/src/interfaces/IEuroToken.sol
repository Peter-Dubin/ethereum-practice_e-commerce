// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IEuroToken - Interface for EuroToken ERC20 stablecoin
/// @notice Interface for interacting with the EuroToken contract
interface IEuroToken {
    /// @notice Returns the name of the token
    function name() external view returns (string memory);
    
    /// @notice Returns the symbol of the token
    function symbol() external view returns (string memory);
    
    /// @notice Returns the number of decimals used by the token
    function decimals() external view returns (uint8);
    
    /// @notice Returns the total supply of tokens
    function totalSupply() external view returns (uint256);
    
    /// @notice Returns the balance of the specified address
    function balanceOf(address account) external view returns (uint256);
    
    /// @notice Transfers tokens from the caller to the specified address
    function transfer(address to, uint256 amount) external returns (bool);
    
    /// @notice Returns the remaining number of tokens that a spender can spend
    function allowance(address owner, address spender) external view returns (uint256);
    
    /// @notice Sets the amount of tokens that a spender can spend
    function approve(address spender, uint256 amount) external returns (bool);
    
    /// @notice Transfers tokens from one address to another
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    
    /// @notice Mints new tokens to the specified address (only owner)
    function mint(address to, uint256 amount) external;
    
    /// @notice Burns tokens from the caller's balance
    function burn(uint256 amount) external;
}
