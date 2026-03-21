import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

const EUROTOKEN_ABI = [
  'function mint(address to, uint256 amount) external',
  'function decimals() view returns (uint8)'
];

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, amount } = await request.json();

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      );
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    const tokenAddress = process.env.NEXT_PUBLIC_EUROTOKEN_CONTRACT_ADDRESS;
    const privateKey = process.env.WALLET_PRIVATE_KEY;

    if (!tokenAddress) {
      return NextResponse.json(
        { error: 'Token contract address not configured' },
        { status: 500 }
      );
    }

    if (!privateKey) {
      return NextResponse.json(
        { error: 'Wallet private key not configured' },
        { status: 500 }
      );
    }

    // Connect to local Anvil (or configured RPC)
    const provider = new ethers.JsonRpcProvider('http://localhost:8545');
    const wallet = new ethers.Wallet(privateKey, provider);

    // Create contract instance
    const tokenContract = new ethers.Contract(tokenAddress, EUROTOKEN_ABI, wallet);

    // Mint tokens
    const tx = await tokenContract.mint(walletAddress, amount);
    const receipt = await tx.wait();

    return NextResponse.json({
      success: true,
      transactionHash: receipt.hash,
      amount,
      recipient: walletAddress
    });
  } catch (error) {
    console.error('Error minting tokens:', error);
    return NextResponse.json(
      { error: 'Failed to mint tokens' },
      { status: 500 }
    );
  }
}
