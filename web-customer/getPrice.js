const { ethers } = require('ethers');
const fs = require('fs');

async function main() {
    const provider = new ethers.JsonRpcProvider('http://localhost:8545');
    const envFile = fs.readFileSync('web-customer/.env.local', 'utf8');
    const address = envFile.match(/NEXT_PUBLIC_ECOMMERCE_CONTRACT_ADDRESS=(0x[a-fA-F0-9]{40})/)[1];
    
    const abi = ['function getProduct(uint256) view returns (tuple(uint256,uint256,string,string,uint256 price,uint256,string,bool))'];
    const contract = new ethers.Contract(address, abi, provider);
    
    const p1 = await contract.getProduct(1);
    console.log("Product 1 price:", p1.price.toString());
}
main();
