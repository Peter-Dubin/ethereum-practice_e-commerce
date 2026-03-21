// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IEuroToken} from "./interfaces/IEuroToken.sol";

/// @title Ecommerce - Main e-commerce smart contract
/// @notice Handles companies, products, carts, invoices, and payments
contract Ecommerce is Ownable {
    /// @notice The EuroToken contract interface
    IEuroToken public immutable euroToken;

    // ============ Company Data Structures ============
    
    struct Company {
        uint256 companyId;
        string name;
        address companyAddress;
        string taxId;
        bool isActive;
        address owner;
    }

    /// @notice Event emitted when a company is registered
    event CompanyRegistered(
        uint256 indexed companyId,
        string name,
        address indexed companyAddress,
        string taxId
    );

    /// @notice Event emitted when a company is updated
    event CompanyUpdated(
        uint256 indexed companyId,
        string name,
        string taxId,
        bool isActive
    );

    mapping(uint256 => Company) public companies;
    mapping(address => uint256) public ownerToCompanyId;
    uint256 public companyCount;

    // ============ Product Data Structures ============

    struct Product {
        uint256 productId;
        uint256 companyId;
        string name;
        string description;
        uint256 price;
        uint256 stock;
        string ipfsImageHash;
        bool isActive;
    }

    event ProductAdded(
        uint256 indexed productId,
        uint256 indexed companyId,
        string name,
        uint256 price,
        uint256 stock
    );

    event ProductUpdated(
        uint256 indexed productId,
        uint256 price,
        uint256 stock,
        bool isActive
    );

    event StockUpdated(
        uint256 indexed productId,
        uint256 quantitySold,
        uint256 remainingStock
    );

    mapping(uint256 => Product) public products;
    mapping(uint256 => uint256[]) public companyProducts;
    uint256 public productCount;

    // ============ Cart Data Structures ============

    struct CartItem {
        uint256 productId;
        uint256 quantity;
        uint256 priceAtAdd;
    }

    struct Cart {
        CartItem[] items;
        uint256 totalAmount;
    }

    event ItemAddedToCart(
        address indexed customer,
        uint256 indexed productId,
        uint256 quantity
    );

    event ItemRemovedFromCart(
        address indexed customer,
        uint256 indexed productId
    );

    event CartCleared(address indexed customer);

    mapping(address => Cart) public carts;

    // ============ Invoice Data Structures ============

    struct Invoice {
        uint256 invoiceId;
        uint256 companyId;
        address customerAddress;
        uint256 totalAmount;
        uint256 timestamp;
        bool isPaid;
        bytes32 paymentTxHash;
        string invoiceNumber;
    }

    event InvoiceCreated(
        uint256 indexed invoiceId,
        uint256 indexed companyId,
        address indexed customerAddress,
        uint256 totalAmount,
        string invoiceNumber
    );

    event InvoicePaid(
        uint256 indexed invoiceId,
        address indexed customerAddress,
        address indexed merchantAddress,
        uint256 amount,
        bytes32 paymentTxHash
    );

    mapping(uint256 => Invoice) public invoices;
    mapping(address => uint256[]) public customerInvoices;
    mapping(uint256 => uint256[]) public companyInvoices;
    uint256 public invoiceCount;

    // ============ Payment Events ============

    event PaymentProcessed(
        uint256 indexed invoiceId,
        address indexed customer,
        address indexed merchant,
        uint256 amount
    );

    error InsufficientBalance(uint256 required, uint256 available);
    error TransferFailed(address from, address to, uint256 amount);

    /// @notice Event emitted when EuroToken address is set
    event EuroTokenSet(address indexed euroToken);

    /// @notice Constructor
    /// @param _euroToken The address of the EuroToken contract
    constructor(address _euroToken) Ownable(msg.sender) {
        require(_euroToken != address(0), "Invalid EuroToken address");
        euroToken = IEuroToken(_euroToken);
        emit EuroTokenSet(_euroToken);
    }

    // ============ Company Functions ============

    /// @notice Register a new company
    function registerCompany(string memory name, string memory taxId) external returns (uint256) {
        require(bytes(name).length > 0, "Company name cannot be empty");
        require(ownerToCompanyId[msg.sender] == 0, "Owner already has a company");

        companyCount++;
        uint256 newCompanyId = companyCount;

        companies[newCompanyId] = Company({
            companyId: newCompanyId,
            name: name,
            companyAddress: msg.sender,
            taxId: taxId,
            isActive: true,
            owner: msg.sender
        });

        ownerToCompanyId[msg.sender] = newCompanyId;

        emit CompanyRegistered(newCompanyId, name, msg.sender, taxId);

        return newCompanyId;
    }

    /// @notice Get company details
    function getCompany(uint256 companyId) external view returns (Company memory) {
        require(companyId > 0 && companyId <= companyCount, "Company does not exist");
        return companies[companyId];
    }

    /// @notice Update company details
    function updateCompany(uint256 companyId, string memory name, string memory taxId, bool isActive) external {
        require(companyId > 0 && companyId <= companyCount, "Company does not exist");
        require(companies[companyId].owner == msg.sender, "Not the company owner");
        
        Company storage company = companies[companyId];
        company.name = name;
        company.taxId = taxId;
        company.isActive = isActive;

        emit CompanyUpdated(companyId, name, taxId, isActive);
    }

    // ============ Product Functions ============

    /// @notice Add a new product
    function addProduct(
        uint256 companyId,
        string memory name,
        string memory description,
        uint256 price,
        uint256 stock,
        string memory ipfsImageHash
    ) external returns (uint256) {
        require(companyId > 0 && companyId <= companyCount, "Company does not exist");
        require(companies[companyId].owner == msg.sender, "Not the company owner");
        require(bytes(name).length > 0, "Product name cannot be empty");
        require(price > 0, "Price must be greater than 0");
        require(stock > 0, "Stock must be greater than 0");

        productCount++;
        uint256 newProductId = productCount;

        products[newProductId] = Product({
            productId: newProductId,
            companyId: companyId,
            name: name,
            description: description,
            price: price,
            stock: stock,
            ipfsImageHash: ipfsImageHash,
            isActive: true
        });

        companyProducts[companyId].push(newProductId);

        emit ProductAdded(newProductId, companyId, name, price, stock);

        return newProductId;
    }

    /// @notice Update product
    function updateProduct(uint256 productId, uint256 price, uint256 stock, bool isActive) external {
        require(productId > 0 && productId <= productCount, "Product does not exist");
        
        Product storage product = products[productId];
        require(companies[product.companyId].owner == msg.sender, "Not the company owner");
        
        if (price > 0) {
            product.price = price;
        }
        if (stock > 0) {
            product.stock = stock;
        }
        product.isActive = isActive;

        emit ProductUpdated(productId, product.price, product.stock, product.isActive);
    }

    /// @notice Get product details
    function getProduct(uint256 productId) external view returns (Product memory) {
        require(productId > 0 && productId <= productCount, "Product does not exist");
        return products[productId];
    }

    /// @notice Get all product IDs for a company
    function getCompanyProductIds(uint256 companyId) external view returns (uint256[] memory) {
        return companyProducts[companyId];
    }

    /// @notice Get all active products
    function getAllProducts() external view returns (Product[] memory) {
        Product[] memory allProducts = new Product[](productCount);
        
        for (uint256 i = 1; i <= productCount; i++) {
            allProducts[i - 1] = products[i];
        }
        
        return allProducts;
    }

    // ============ Cart Functions ============

    /// @notice Add product to cart
    function addToCart(uint256 productId, uint256 quantity) external {
        require(productId > 0 && productId <= productCount, "Product does not exist");
        Product memory product = products[productId];
        require(product.isActive, "Product not active");
        require(product.stock >= quantity, "Insufficient stock");
        
        Cart storage cart = carts[msg.sender];
        
        // Check if product already in cart
        bool found = false;
        for (uint256 i = 0; i < cart.items.length; i++) {
            if (cart.items[i].productId == productId) {
                cart.items[i].quantity += quantity;
                cart.items[i].priceAtAdd = product.price;
                found = true;
                break;
            }
        }
        
        if (!found) {
            cart.items.push(CartItem({
                productId: productId,
                quantity: quantity,
                priceAtAdd: product.price
            }));
        }
        
        // Recalculate total
        cart.totalAmount = calculateCartTotal(cart.items);
        
        emit ItemAddedToCart(msg.sender, productId, quantity);
    }

    /// @notice Remove product from cart
    function removeFromCart(uint256 productId) external {
        Cart storage cart = carts[msg.sender];
        
        for (uint256 i = 0; i < cart.items.length; i++) {
            if (cart.items[i].productId == productId) {
                cart.items[i] = cart.items[cart.items.length - 1];
                cart.items.pop();
                cart.totalAmount = calculateCartTotal(cart.items);
                emit ItemRemovedFromCart(msg.sender, productId);
                return;
            }
        }
    }

    /// @notice Update cart item quantity
    function updateCartQuantity(uint256 productId, uint256 quantity) external {
        require(quantity > 0, "Quantity must be greater than 0");
        
        Cart storage cart = carts[msg.sender];
        
        for (uint256 i = 0; i < cart.items.length; i++) {
            if (cart.items[i].productId == productId) {
                require(products[productId].stock >= quantity, "Insufficient stock");
                cart.items[i].quantity = quantity;
                cart.totalAmount = calculateCartTotal(cart.items);
                return;
            }
        }
        
        revert("Product not in cart");
    }

    /// @notice Clear cart
    function clearCart() external {
        delete carts[msg.sender];
        emit CartCleared(msg.sender);
    }

    /// @notice Get cart details
    function getCart() external view returns (CartItem[] memory items, uint256 total) {
        Cart storage cart = carts[msg.sender];
        return (cart.items, cart.totalAmount);
    }

    /// @notice Calculate cart total
    function calculateCartTotal(CartItem[] storage items) internal view returns (uint256 total) {
        total = 0;
        for (uint256 i = 0; i < items.length; i++) {
            total += items[i].priceAtAdd * items[i].quantity;
        }
    }

    // ============ Invoice Functions ============

    /// @notice Generate invoice number
    function generateInvoiceNumber(uint256 invoiceId) internal pure returns (string memory) {
        return string(abi.encodePacked("INV-", uintToString(invoiceId)));
    }

    /// @notice Helper function to convert uint to string
    function uintToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        
        uint256 temp = value;
        uint256 digits;
        
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        
        bytes memory buffer = new bytes(digits);
        
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        
        return string(buffer);
    }

    /// @notice Create invoice from cart
    function createInvoice(uint256 companyId) external returns (uint256) {
        require(companyId > 0 && companyId <= companyCount, "Company does not exist");
        Company memory company = companies[companyId];
        require(company.isActive, "Company not active");
        
        Cart storage cart = carts[msg.sender];
        require(cart.items.length > 0, "Cart is empty");
        
        // Verify all items are from the same company and in stock
        for (uint256 i = 0; i < cart.items.length; i++) {
            Product memory product = products[cart.items[i].productId];
            require(product.companyId == companyId, "Products from different companies");
            require(product.isActive, "Product not active");
            require(product.stock >= cart.items[i].quantity, "Insufficient stock");
        }
        
        // Create invoice
        invoiceCount++;
        uint256 newInvoiceId = invoiceCount;
        string memory invoiceNumber = generateInvoiceNumber(newInvoiceId);

        invoices[newInvoiceId] = Invoice({
            invoiceId: newInvoiceId,
            companyId: companyId,
            customerAddress: msg.sender,
            totalAmount: cart.totalAmount,
            timestamp: block.timestamp,
            isPaid: false,
            paymentTxHash: bytes32(0),
            invoiceNumber: invoiceNumber
        });

        customerInvoices[msg.sender].push(newInvoiceId);
        companyInvoices[companyId].push(newInvoiceId);

        emit InvoiceCreated(newInvoiceId, companyId, msg.sender, cart.totalAmount, invoiceNumber);
        
        // Reduce stock for each item
        for (uint256 i = 0; i < cart.items.length; i++) {
            products[cart.items[i].productId].stock -= cart.items[i].quantity;
            emit StockUpdated(cart.items[i].productId, cart.items[i].quantity, products[cart.items[i].productId].stock);
        }
        
        // Clear cart after creating invoice
        delete carts[msg.sender];
        emit CartCleared(msg.sender);
        
        return newInvoiceId;
    }

    /// @notice Get invoice details
    function getInvoice(uint256 invoiceId) external view returns (Invoice memory) {
        require(invoiceId > 0 && invoiceId <= invoiceCount, "Invoice does not exist");
        return invoices[invoiceId];
    }

    /// @notice Get customer invoices
    function getCustomerInvoices(address customer) external view returns (uint256[] memory) {
        return customerInvoices[customer];
    }

    /// @notice Get company invoices
    function getCompanyInvoices(uint256 companyId) external view returns (uint256[] memory) {
        return companyInvoices[companyId];
    }

    // ============ Payment Functions ============

    /// @notice Process payment for an invoice
    function processPayment(uint256 invoiceId, uint256 amount) external {
        require(invoiceId > 0 && invoiceId <= invoiceCount, "Invoice does not exist");
        Invoice storage invoice = invoices[invoiceId];
        
        require(invoice.customerAddress == msg.sender, "Not the invoice customer");
        require(!invoice.isPaid, "Invoice already paid");
        require(amount >= invoice.totalAmount, "Amount less than invoice total");
        
        Company memory company = companies[invoice.companyId];
        require(company.isActive, "Company not active");
        
        // Check balance
        uint256 balance = euroToken.balanceOf(msg.sender);
        if (balance < invoice.totalAmount) {
            revert InsufficientBalance(invoice.totalAmount, balance);
        }
        
        // Transfer tokens
        bool success = euroToken.transferFrom(msg.sender, company.companyAddress, invoice.totalAmount);
        if (!success) {
            revert TransferFailed(msg.sender, company.companyAddress, invoice.totalAmount);
        }
        
        // Mark invoice as paid
        invoice.isPaid = true;
        invoice.paymentTxHash = keccak256(abi.encodePacked(block.number, block.timestamp, msg.sender));
        
        emit PaymentProcessed(invoiceId, msg.sender, company.companyAddress, invoice.totalAmount);
        emit InvoicePaid(invoiceId, msg.sender, company.companyAddress, invoice.totalAmount, invoice.paymentTxHash);
    }

    /// @notice Process payment directly (for payment gateway)
    function processDirectPayment(
        uint256 invoiceId,
        address customer,
        uint256 amount
    ) external {
        require(invoiceId > 0 && invoiceId <= invoiceCount, "Invoice does not exist");
        Invoice storage invoice = invoices[invoiceId];
        
        require(invoice.customerAddress == customer, "Invalid customer");
        require(!invoice.isPaid, "Invoice already paid");
        
        Company memory company = companies[invoice.companyId];
        
        // Check balance
        uint256 balance = euroToken.balanceOf(customer);
        if (balance < amount) {
            revert InsufficientBalance(amount, balance);
        }
        
        // Transfer tokens
        bool success = euroToken.transferFrom(customer, company.companyAddress, amount);
        if (!success) {
            revert TransferFailed(customer, company.companyAddress, amount);
        }
        
        // Mark invoice as paid
        invoice.isPaid = true;
        invoice.paymentTxHash = keccak256(abi.encodePacked(block.number, block.timestamp, customer));
        
        emit PaymentProcessed(invoiceId, customer, company.companyAddress, amount);
        emit InvoicePaid(invoiceId, customer, company.companyAddress, amount, invoice.paymentTxHash);
    }

    /// @notice Check if customer can afford amount
    function canAfford(address customer, uint256 amount) external view returns (bool) {
        return euroToken.balanceOf(customer) >= amount;
    }

    /// @notice Get customer EURT balance
    function getBalance(address account) external view returns (uint256) {
        return euroToken.balanceOf(account);
    }
}
