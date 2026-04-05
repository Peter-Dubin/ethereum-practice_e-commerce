'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ethers } from 'ethers';

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)'
];

const ECOMMERCE_ABI = [
  'function processDirectPayment(uint256 invoiceId, address customer, uint256 amount)',
  'function getInvoice(uint256 invoiceId) view returns (tuple(uint256 invoiceId, uint256 companyId, address customerAddress, uint256 totalAmount, uint256 timestamp, bool isPaid, bytes32 paymentTxHash, string invoiceNumber))'
];

function PaymentContent() {
  const searchParams = useSearchParams();
  
  const [status, setStatus] = useState<'loading' | 'ready' | 'processing' | 'success' | 'error'>('loading');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Payment details from URL
  const merchantAddress = searchParams.get('merchant_address') || '';
  const amount = searchParams.get('amount') || '0';
  const invoice = searchParams.get('invoice') || '';
  const date = searchParams.get('date') || '';
  const redirect = searchParams.get('redirect') || '';
  const invoiceId = searchParams.get('invoice_id') || '0';

  useEffect(() => {
    // Validate params
    if (!merchantAddress || !amount) {
      setStatus('error');
      setError('Missing payment parameters');
      return;
    }
    setStatus('ready');
  }, [merchantAddress, amount]);
  const connectWallet = async () => {
    if (!window.ethereum) {
      setError('MetaMask not installed');
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const accounts = await provider.send('eth_requestAccounts', []);
      
      if (accounts.length > 0) {
        setWalletAddress(accounts[0]);
      }
    } catch (err) {
      console.error('Error connecting wallet:', err);
      setError('Failed to connect wallet');
    }
  };

  const processPayment = async () => {
    if (!walletAddress || !invoiceId) return;

    setStatus('processing');
    setError(null);

    try {
      if (!window.ethereum) throw new Error('MetaMask not installed');
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const signer = await provider.getSigner();

      const euroTokenAddress = process.env.NEXT_PUBLIC_EUROTOKEN_CONTRACT_ADDRESS;
      const ecommerceAddress = process.env.NEXT_PUBLIC_ECOMMERCE_CONTRACT_ADDRESS;

      if (!euroTokenAddress || !ecommerceAddress) {
        throw new Error('Contract addresses not configured');
      }

      // Get amount in smallest units (0 decimals for EURT)
      const amountWei = ethers.parseUnits(amount, 0);

      // Check balance
      const tokenContract = new ethers.Contract(euroTokenAddress, ERC20_ABI, provider);
      const balance = await tokenContract.balanceOf(walletAddress);
      
      if (balance < amountWei) {
        throw new Error('Insufficient EURT balance. Please buy more tokens.');
      }

      // Check allowance
      const allowance = await tokenContract.allowance(walletAddress, ecommerceAddress);
      
      if (allowance < amountWei) {
        // Approve tokens
        const approveTx = await (tokenContract.connect(signer) as any).approve(ecommerceAddress, amountWei);
        await approveTx.wait();
      }

      // Process payment through ecommerce contract
      const ecommerceContract = new ethers.Contract(ecommerceAddress, ECOMMERCE_ABI, signer);
      const payTx = await (ecommerceContract as any).processDirectPayment(
        invoiceId,
        walletAddress,
        amountWei
      );
      
      await payTx.wait();

      setStatus('success');

      // Redirect after success
      if (redirect) {
        setTimeout(() => {
          const redirectUrl = new URL(redirect);
          redirectUrl.searchParams.set('status', 'success');
          redirectUrl.searchParams.set('invoice', invoice);
          window.location.href = redirectUrl.toString();
        }, 2000);
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'Payment failed');
      setStatus('error');
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatAmount = (amt: string) => {
    try {
      // EURT has 0 decimals
      return ethers.formatUnits(amt, 0);
    } catch {
      return amt;
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading payment details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="bg-blue-600 px-6 py-4">
          <h1 className="text-2xl font-bold text-white">Payment Gateway</h1>
          <p className="text-blue-100">EuroToken Payment</p>
        </div>

        <div className="p-6">
          {status === 'error' && error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-green-600 font-semibold">Payment Successful!</p>
              </div>
              <p className="text-green-600 text-sm">Redirecting...</p>
            </div>
          )}

          <div className="space-y-4 mb-6">
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-900 font-semibold">Invoice</span>
              <span className="font-bold text-blue-800">{invoice || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-900 font-semibold">Date</span>
              <span className="font-bold text-blue-800">{date || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-900 font-semibold">Merchant</span>
              <span className="font-mono text-sm font-bold text-blue-800">{formatAddress(merchantAddress)}</span>
            </div>
            <div className="flex justify-between items-center py-4">
              <span className="text-lg font-bold text-gray-900">Amount</span>
              <span className="text-2xl font-black text-blue-700">€{formatAmount(amount)}</span>
            </div>
          </div>

          {status !== 'success' && (
            <>
              {!walletAddress ? (
                <button
                  onClick={connectWallet}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Connect Wallet
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="font-mono text-sm">{formatAddress(walletAddress)}</span>
                  </div>
                  
                  <button
                    onClick={processPayment}
                    disabled={status === 'processing'}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
                  >
                    {status === 'processing' ? 'Processing...' : `Pay €${formatAmount(amount)}`}
                  </button>
                </div>
              )}

              <p className="mt-4 text-xs text-center text-gray-700 font-medium">
                Payment will be processed on the blockchain. Make sure you have sufficient EURT balance.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <PaymentContent />
    </Suspense>
  );
}

// Add Ethereum type declaration
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}
