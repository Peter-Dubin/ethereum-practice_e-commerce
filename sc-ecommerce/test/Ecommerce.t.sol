// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {Ecommerce} from "../src/Ecommerce.sol";
import {IEuroToken} from "../src/interfaces/IEuroToken.sol";

// Mock EuroToken
contract MockEuroToken is IEuroToken {
    string public override name = "EuroToken";
    string public override symbol = "EURT";
    uint8 public override decimals = 0;
    uint256 public override totalSupply;

    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    function transfer(address to, uint256 amount) external override returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function mint(address to, uint256 amount) external override {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function burn(uint256 amount) external override {
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
    }
}

contract EcommerceTest is Test {
    Ecommerce public ecommerce;
    MockEuroToken public euroToken;

    address public owner;
    address public merchant;
    address public customer;

    function setUp() public {
        owner = address(this);
        merchant = makeAddr("merchant");
        customer = makeAddr("customer");

        euroToken = new MockEuroToken();
        ecommerce = new Ecommerce(address(euroToken));

        // give customer some EURT
        euroToken.mint(customer, 10000);
        
        // customer approves Ecommerce to spend their EURT
        vm.prank(customer);
        euroToken.approve(address(ecommerce), 100000);
    }

    // ============ Company Tests ============
    function test_RegisterCompany() public {
        vm.prank(merchant);
        uint256 companyId = ecommerce.registerCompany("Test Co", "Test Description");
        
        Ecommerce.Company memory company = ecommerce.getCompany(companyId);
        assertEq(company.name, "Test Co");
        assertEq(company.description, "Test Description");
        assertEq(company.owner, merchant);
        assertTrue(company.isActive);
    }

    function test_RevertIf_RegisterCompanyEmptyName() public {
        vm.prank(merchant);
        vm.expectRevert();
        ecommerce.registerCompany("", "Description");
    }

    function test_UpdateCompany() public {
        vm.startPrank(merchant);
        uint256 companyId = ecommerce.registerCompany("Test Co", "Test Description");
        ecommerce.updateCompany(companyId, "New Co", "New Desc", false);
        vm.stopPrank();

        Ecommerce.Company memory company = ecommerce.getCompany(companyId);
        assertEq(company.name, "New Co");
        assertEq(company.description, "New Desc");
        assertFalse(company.isActive);
    }

    function test_RevertIf_UpdateCompanyNotOwner() public {
        vm.prank(merchant);
        uint256 companyId = ecommerce.registerCompany("Test Co", "Test Description");
        
        vm.prank(customer);
        vm.expectRevert();
        ecommerce.updateCompany(companyId, "New Co", "New Desc", false);
    }

    // ============ Product Tests ============
    modifier withCompany() {
        vm.startPrank(merchant);
        ecommerce.registerCompany("Test Co", "Desc");
        vm.stopPrank();
        _;
    }

    function test_AddProduct() public withCompany {
        vm.prank(merchant);
        uint256 productId = ecommerce.addProduct(1, "Prod", "Desc", 100, 10, "ipfs://hash");
        
        Ecommerce.Product memory p = ecommerce.getProduct(productId);
        assertEq(p.name, "Prod");
        assertEq(p.price, 100);
        assertEq(p.stock, 10);
        assertEq(p.companyId, 1);
        assertTrue(p.isActive);
    }

    function test_UpdateProduct() public withCompany {
        vm.startPrank(merchant);
        uint256 productId = ecommerce.addProduct(1, "Prod", "Desc", 100, 10, "ipfs://hash");
        ecommerce.updateProduct(productId, 200, 20, false);
        vm.stopPrank();

        Ecommerce.Product memory p = ecommerce.getProduct(productId);
        assertEq(p.price, 200);
        assertEq(p.stock, 20);
        assertFalse(p.isActive);
    }

    function test_GetAllProducts() public withCompany {
        vm.startPrank(merchant);
        ecommerce.addProduct(1, "Prod1", "Desc", 100, 10, "ipfs1");
        ecommerce.addProduct(1, "Prod2", "Desc", 200, 20, "ipfs2");
        vm.stopPrank();

        Ecommerce.Product[] memory all = ecommerce.getAllProducts();
        assertEq(all.length, 2);
    }

    function test_GetCompanyProductIds() public withCompany {
        vm.startPrank(merchant);
        ecommerce.addProduct(1, "Prod1", "Desc", 100, 10, "ipfs1");
        uint256 p2 = ecommerce.addProduct(1, "Prod2", "Desc", 200, 20, "ipfs2");
        vm.stopPrank();

        uint256[] memory ids = ecommerce.getCompanyProductIds(1);
        assertEq(ids.length, 2);
        assertEq(ids[1], p2);
    }

    // ============ Cart Tests ============
    modifier withProduct() {
        vm.startPrank(merchant);
        ecommerce.registerCompany("Test Co", "Desc");
        ecommerce.addProduct(1, "Prod", "Desc", 100, 10, "ipfs");
        uint256 p2 = ecommerce.addProduct(1, "Prod2", "Desc", 50, 5, "ipfs2");
        vm.stopPrank();
        _;
    }

    function test_AddToCart() public withProduct {
        vm.startPrank(customer);
        ecommerce.addToCart(1, 2);

        (Ecommerce.CartItem[] memory items, uint256 total) = ecommerce.getCart();
        vm.stopPrank();
        assertEq(items.length, 1);
        assertEq(items[0].productId, 1);
        assertEq(items[0].quantity, 2);
        assertEq(items[0].priceAtAdd, 100);
        assertEq(total, 200);
    }

    function test_AddToCartExisting() public withProduct {
        vm.startPrank(customer);
        ecommerce.addToCart(1, 2);
        ecommerce.addToCart(1, 3);

        (Ecommerce.CartItem[] memory items, uint256 total) = ecommerce.getCart();
        vm.stopPrank();
        assertEq(items.length, 1);
        assertEq(items[0].quantity, 5);
        assertEq(total, 500);
    }

    function test_RemoveFromCart() public withProduct {
        vm.startPrank(customer);
        ecommerce.addToCart(1, 2);
        ecommerce.addToCart(2, 1);
        ecommerce.removeFromCart(1);

        (Ecommerce.CartItem[] memory items, uint256 total) = ecommerce.getCart();
        vm.stopPrank();
        assertEq(items.length, 1);
        assertEq(items[0].productId, 2);
        assertEq(total, 50);
    }

    function test_UpdateCartQuantity() public withProduct {
        vm.startPrank(customer);
        ecommerce.addToCart(1, 2);
        ecommerce.updateCartQuantity(1, 5);

        (Ecommerce.CartItem[] memory items, uint256 total) = ecommerce.getCart();
        vm.stopPrank();
        assertEq(items[0].quantity, 5);
        assertEq(total, 500);
    }

    function test_ClearCart() public withProduct {
        vm.startPrank(customer);
        ecommerce.addToCart(1, 2);
        ecommerce.clearCart();

        (Ecommerce.CartItem[] memory items, uint256 total) = ecommerce.getCart();
        vm.stopPrank();
        assertEq(items.length, 0);
        assertEq(total, 0);
    }

    // ============ Invoice & Payment Tests ============
    modifier withCart() {
        vm.startPrank(merchant);
        ecommerce.registerCompany("Test Co", "Desc");
        ecommerce.addProduct(1, "Prod", "Desc", 100, 10, "ipfs");
        vm.stopPrank();

        vm.prank(customer);
        ecommerce.addToCart(1, 2); // total 200
        _;
    }

    function test_CreateInvoice() public withCart {
        vm.prank(customer);
        uint256 invoiceId = ecommerce.createInvoice(1);

        Ecommerce.Invoice memory inv = ecommerce.getInvoice(invoiceId);
        assertEq(inv.invoiceId, invoiceId);
        assertEq(inv.companyId, 1);
        assertEq(inv.customerAddress, customer);
        assertEq(inv.totalAmount, 200);
        assertFalse(inv.isPaid);

        // stock reduced
        Ecommerce.Product memory p = ecommerce.getProduct(1);
        assertEq(p.stock, 8); // 10 - 2

        // cart cleared
        (Ecommerce.CartItem[] memory items, ) = ecommerce.getCart();
        assertEq(items.length, 0);
    }

    function test_ProcessPayment() public withCart {
        vm.startPrank(customer);
        uint256 invoiceId = ecommerce.createInvoice(1);
        
        ecommerce.processPayment(invoiceId, 200);
        vm.stopPrank();

        Ecommerce.Invoice memory inv = ecommerce.getInvoice(invoiceId);
        assertTrue(inv.isPaid);
        assertEq(euroToken.balanceOf(customer), 10000 - 200);
        
        Ecommerce.Company memory co = ecommerce.getCompany(1);
        assertEq(euroToken.balanceOf(co.companyAddress), 200);
    }

    function test_ProcessDirectPayment() public withCart {
        vm.prank(customer);
        uint256 invoiceId = ecommerce.createInvoice(1);
        
        // anyone can call processDirectPayment as long as customer has funds approved
        vm.prank(owner);
        ecommerce.processDirectPayment(invoiceId, customer, 200);

        Ecommerce.Invoice memory inv = ecommerce.getInvoice(invoiceId);
        assertTrue(inv.isPaid);
        assertEq(euroToken.balanceOf(customer), 10000 - 200);
    }

    function test_CanAffordAndBalance() public {
        assertTrue(ecommerce.canAfford(customer, 1000));
        assertFalse(ecommerce.canAfford(customer, 100000));
        assertEq(ecommerce.getBalance(customer), 10000);
    }

    function test_RevertIf_CreateInvoiceDifferentCompanies() public {
        vm.startPrank(merchant);
        ecommerce.registerCompany("Test Co 1", "Desc"); // ID 1
        ecommerce.registerCompany("Test Co 2", "Desc"); // ID 2
        ecommerce.addProduct(1, "Prod1", "Desc", 100, 10, "ipfs"); // ID 1
        ecommerce.addProduct(2, "Prod2", "Desc", 100, 10, "ipfs"); // ID 2
        vm.stopPrank();

        vm.startPrank(customer);
        ecommerce.addToCart(1, 1);
        ecommerce.addToCart(2, 1);
        
        // creating invoice for Company 1 while having Company 2 products should fail
        vm.expectRevert();
        ecommerce.createInvoice(1);
        vm.stopPrank();
    }
}
