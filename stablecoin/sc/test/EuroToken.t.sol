// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {EuroToken} from "../src/EuroToken.sol";

/// @title EuroToken Test Suite
/// @notice Tests for EuroToken ERC20 stablecoin
contract EuroTokenTest is Test {
    EuroToken public euroToken;
    address public owner;
    address public user1;
    address public user2;

    /// @notice Set up test environment
    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        
        // Deploy EuroToken with owner address
        euroToken = new EuroToken(owner);
    }

    /// @notice Test initial deployment
    function test_Deployment() public view {
        assertEq(euroToken.name(), "EuroToken");
        assertEq(euroToken.symbol(), "EURT");
        assertEq(euroToken.decimals(), 6);
        assertEq(euroToken.owner(), owner);
    }

    /// @notice Test initial supply is minted to owner
    function test_InitialSupply() public view {
        uint256 expectedSupply = 1_000_000 * 10**6;
        assertEq(euroToken.totalSupply(), expectedSupply);
        assertEq(euroToken.balanceOf(owner), expectedSupply);
    }

    /// @notice Test minting by owner succeeds
    function test_MintByOwner() public {
        uint256 mintAmount = 1000 * 10**6; // 1000 EURT
        
        euroToken.mint(user1, mintAmount);
        
        assertEq(euroToken.balanceOf(user1), mintAmount);
        assertEq(euroToken.totalSupply(), 1_000_000 * 10**6 + mintAmount);
    }

    /// @notice Test minting by non-owner fails
    function test_MintByNonOwner() public {
        vm.prank(user1);
        vm.expectRevert();
        euroToken.mint(user2, 1000 * 10**6);
    }

    /// @notice Test minting to zero address fails
    function test_MintToZeroAddress() public {
        vm.expectRevert("Cannot mint to zero address");
        euroToken.mint(address(0), 1000 * 10**6);
    }

    /// @notice Test transfer between accounts
    function test_Transfer() public {
        uint256 transferAmount = 500 * 10**6; // 500 EURT
        
        euroToken.transfer(user1, transferAmount);
        
        assertEq(euroToken.balanceOf(user1), transferAmount);
        assertEq(euroToken.balanceOf(owner), 1_000_000 * 10**6 - transferAmount);
    }

    /// @notice Test transfer from owner to user, then user to user2
    function test_TransferFrom() public {
        uint256 amount = 300 * 10**6;
        
        // Transfer from owner to user1
        euroToken.transfer(user1, amount);
        
        // Check user1 balance
        assertEq(euroToken.balanceOf(user1), amount);
    }

    /// @notice Test burn by token holder
    function test_Burn() public {
        uint256 burnAmount = 100 * 10**6;
        uint256 initialBalance = euroToken.balanceOf(owner);
        uint256 initialSupply = euroToken.totalSupply();
        
        euroToken.burn(burnAmount);
        
        assertEq(euroToken.balanceOf(owner), initialBalance - burnAmount);
        assertEq(euroToken.totalSupply(), initialSupply - burnAmount);
    }

    /// @notice Test decimal precision
    function test_DecimalPrecision() public view {
        // 1 EUR = 1 * 10^6 (cents)
        uint256 oneEuro = 1 * 10**6;
        
        assertEq(euroToken.decimals(), 6);
        
        // Verify that 1 EUR equals 1,000,000 smallest units
        assertEq(oneEuro, 1_000_000);
    }

    /// @notice Test total supply calculation with decimals
    function test_TotalSupplyCalculation() public view {
        uint256 totalSupply = euroToken.totalSupply();
        uint256 expectedEuros = totalSupply / 10**6;
        
        assertEq(expectedEuros, 1_000_000); // 1 million euros
    }

    /// @notice Test multiple transfers
    function test_MultipleTransfers() public {
        uint256 amount = 100 * 10**6;
        
        // Transfer to user1
        euroToken.transfer(user1, amount);
        assertEq(euroToken.balanceOf(user1), amount);
        
        // Transfer to user2
        euroToken.transfer(user2, amount);
        assertEq(euroToken.balanceOf(user2), amount);
        
        // Owner should have initial - 2*amount
        assertEq(euroToken.balanceOf(owner), 1_000_000 * 10**6 - 2 * amount);
    }

    /// @notice Test approve and transferFrom
    function test_ApproveAndTransferFrom() public {
        uint256 amount = 200 * 10**6;
        
        // Owner approves user1 to spend tokens
        euroToken.approve(user1, amount);
        
        // User1 transfers from owner to themselves
        vm.prank(user1);
        euroToken.transferFrom(owner, user1, amount);
        
        assertEq(euroToken.balanceOf(user1), amount);
    }

    /// @notice Test events are emitted on mint
    function test_MintEvent() public {
        vm.expectEmit(true, true, true, true);
        emit IERC20.Transfer(address(0), user1, 1000 * 10**6);
        euroToken.mint(user1, 1000 * 10**6);
    }

    /// @notice Test events are emitted on burn
    function test_BurnEvent() public {
        vm.expectEmit(true, true, true, true);
        emit IERC20.Transfer(owner, address(0), 100 * 10**6);
        euroToken.burn(100 * 10**6);
    }
}
