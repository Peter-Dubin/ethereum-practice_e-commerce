const { ethers } = require('ethers');
const fs = require('fs');

async function main() {
    const provider = new ethers.JsonRpcProvider('http://localhost:8545');
    // anvil dev account 0
    const wallet = new ethers.Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', provider);

    // Get ecommerce address from web-admin/.env.local
    const envFile = fs.readFileSync('web-admin/.env.local', 'utf8');
    const ecommerceAddrMatch = envFile.match(/NEXT_PUBLIC_ECOMMERCE_CONTRACT_ADDRESS=(0x[a-fA-F0-9]{40})/);
    if (!ecommerceAddrMatch) throw new Error("Ecommerce address not found");
    const ecommerceAddress = ecommerceAddrMatch[1];
    
    console.log("Ecommerce:", ecommerceAddress);

    const ECOMMERCE_ABI = [
        'function addProduct(uint256 companyId, string name, string description, uint256 price, uint256 stock, string ipfsImageHash) returns (uint256)',
        'function registerCompany(string name, string description) returns (uint256)',
        'function addToCart(uint256 productId, uint256 quantity)',
        'function getCart() view returns (tuple(uint256 productId, uint256 quantity, uint256 priceAtAdd)[] cartItems, uint256 total)',
        'function decimals() view returns (uint8)'
    ];

    const contract = new ethers.Contract(ecommerceAddress, ECOMMERCE_ABI, wallet);

    try {
        console.log("Registering company...");
        const tx1 = await contract.registerCompany("Test Co", "Desc");
        await tx1.wait();
        console.log("Added company");

        console.log("Adding product...");
        const tx2 = await contract.addProduct(1, "Test Product", "Desc", 100, 10, "ipfs://");
        await tx2.wait();
        console.log("Added product");

        console.log("Adding to cart...");
        const tx3 = await contract.addToCart(1, 1);
        await tx3.wait();
        console.log("Added to cart successfully");
        
        const cart = await contract.getCart();
        console.log("Cart items:", cart.cartItems.length);
    } catch(e) {
        console.error("Error:", e);
    }
}
main();
