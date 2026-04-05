const { ethers } = require('ethers');
const fs = require('fs');

async function main() {
    const provider = new ethers.JsonRpcProvider('http://localhost:8545');
    const signer = new ethers.Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', provider);

    const envFile = fs.readFileSync('web-customer/.env.local', 'utf8');
    const ecommerceAddrMatch = envFile.match(/NEXT_PUBLIC_ECOMMERCE_CONTRACT_ADDRESS=(0x[a-fA-F0-9]{40})/);
    const ecommerceAddress = ecommerceAddrMatch[1];
    
    const abi = ['function getCart() view returns (tuple(uint256,uint256,uint256)[] cartItems, uint256 total)', 'function addToCart(uint256,uint256)'];
    
    // Contract WITH signer
    const contractWithSigner = new ethers.Contract(ecommerceAddress, abi, signer);
    // Contract WITH provider
    const contractWithProvider = new ethers.Contract(ecommerceAddress, abi, provider);

    // add something to cart just in case
    try {
        console.log("adding to cart...");
        const tx = await contractWithSigner.addToCart(1, 1);
        await tx.wait();
        console.log("added to cart");
    } catch(e) { /* ignore or print */ console.log(e.message.split('\n')[0]); }

    const resSigner = await contractWithSigner.getCart();
    console.log("Cart with signer length:", resSigner.cartItems.length);

    try {
        const resProvider = await contractWithProvider.getCart();
        console.log("Cart with provider length:", resProvider.cartItems.length);
    } catch(e) {
        console.log("Provider fail:", e);
    }
}
main();
