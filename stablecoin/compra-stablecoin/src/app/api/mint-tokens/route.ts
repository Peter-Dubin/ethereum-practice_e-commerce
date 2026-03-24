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

    console.log('[MINT-TOKENS] Token address:', tokenAddress);
    console.log('[MINT-TOKENS] Private key present:', !!privateKey);
    console.log('[MINT-TOKENS] Private key value:', privateKey ? `${privateKey.substring(0, 10)}...` : 'undefined');

    if (!tokenAddress) {
      console.error('[MINT-TOKENS] Token contract address not configured');
      return NextResponse.json(
        { error: 'Token contract address not configured' },
        { status: 500 }
      );
    }

    if (!privateKey) {
      console.error('[MINT-TOKENS] Wallet private key not configured');
      return NextResponse.json(
        { error: 'Wallet private key not configured' },
        { status: 500 }
      );
    }

    // Connect to local Anvil (or configured RPC)
    console.log('[MINT-TOKENS] Connecting to RPC at http://localhost:8545');
    const provider = new ethers.JsonRpcProvider('http://localhost:8545');
    const wallet = new ethers.Wallet(privateKey, provider);
    console.log('[MINT-TOKENS] Wallet address:', wallet.address);

    // Create contract instance
    console.log('[MINT-TOKENS] Creating contract at:', tokenAddress);
    const tokenContract = new ethers.Contract(tokenAddress, EUROTOKEN_ABI, wallet);

    // Mint tokens
    console.log('[MINT-TOKENS] Calling mint for:', walletAddress, 'amount:', amount);
    try {
      const tx = await tokenContract.mint(walletAddress, amount);
      console.log('[MINT-TOKENS] Transaction sent:', tx.hash);
      const receipt = await tx.wait();
      console.log('[MINT-TOKENS] Transaction confirmed:', receipt.hash);

    return NextResponse.json({
      success: true,
      transactionHash: receipt.hash,
      amount,
      recipient: walletAddress
    });
    } catch (mintError: any) {
      console.error('[MINT-TOKENS] Mint error:', mintError);
      console.error('[MINT-TOKENS] Error message:', mintError.message);
      console.error('[MINT-TOKENS] Error code:', mintError.code);
      console.error('[MINT-TOKENS] Error reason:', mintError.reason);
      return NextResponse.json(
        { error: 'Failed to mint tokens', details: mintError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[MINT-TOKENS] General error:', error);
    console.error('[MINT-TOKENS] Error message:', error?.message);
    return NextResponse.json(
      { error: 'Failed to mint tokens', details: error?.message },
      { status: 500 }
    );
  }
}
