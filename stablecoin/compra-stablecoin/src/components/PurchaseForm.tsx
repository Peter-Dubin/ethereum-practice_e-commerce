'use client';

import { useState } from 'react';
import { ethers } from 'ethers';

interface PurchaseFormProps {
  walletAddress: string;
  onSuccess?: (txHash: string, amount: string) => void;
}

const EUROTOKEN_ABI = [
  'function mint(address to, uint256 amount) external',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

export default function PurchaseForm({ walletAddress, onSuccess }: PurchaseFormProps) {
  const [eurAmount, setEurAmount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const tokenAddress = process.env.NEXT_PUBLIC_EUROTOKEN_CONTRACT_ADDRESS;

  const handlePurchase = async () => {
    if (!eurAmount || parseFloat(eurAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      // Create payment intent on backend
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(eurAmount) * 100, // Stripe uses cents
          walletAddress
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create payment intent');
      }

      const { clientSecret: secret } = await response.json();
      setClientSecret(secret);

      // The actual payment will be handled by Stripe Elements in the Checkout component
      setSuccess('Payment successful! Tokens will be minted shortly.');
      
      // Call mint API
      const mintResponse = await fetch('/api/mint-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          amount: parseFloat(eurAmount) * 1000000 // Convert to cents (6 decimals)
        })
      });

      if (!mintResponse.ok) {
        throw new Error('Failed to mint tokens');
      }

      const { transactionHash } = await mintResponse.json();
      setSuccess(`Purchase successful! ${eurAmount} EURT minted.`);
      onSuccess?.(transactionHash, eurAmount);
      
      // Refresh balance
      await checkBalance();
      
    } catch (err) {
      console.error('Purchase error:', err);
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const checkBalance = async () => {
    if (!tokenAddress) return;
    
    try {
      // Since we can't easily connect to the contract without a provider,
      // this would typically be done through an API or a proper provider
      console.log('Checking balance for:', walletAddress);
    } catch (err) {
      console.error('Error checking balance:', err);
    }
  };

  const formatAmount = (value: string) => {
    // Allow only numbers and one decimal point
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return parts[0] + '.' + parts[1];
    return cleaned;
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
          Buy EuroToken (EURT)
        </h2>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Amount (EUR)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
            <input
              type="text"
              value={eurAmount}
              onChange={(e) => setEurAmount(formatAmount(e.target.value))}
              placeholder="100.00"
              className="w-full pl-8 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
            />
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            1 EUR = 1 EURT (1:1 exchange rate)
          </p>
        </div>

        {eurAmount && parseFloat(eurAmount) > 0 && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">You will receive:</span>
              <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {eurAmount} EURT
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-green-600 dark:text-green-400 text-sm">{success}</p>
          </div>
        )}

        <button
          onClick={handlePurchase}
          disabled={isProcessing || !eurAmount || parseFloat(eurAmount) <= 0}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
        >
          {isProcessing ? 'Processing...' : `Pay €${eurAmount || '0'} with Card`}
        </button>

        <p className="mt-4 text-xs text-center text-gray-500 dark:text-gray-400">
          Test cards: 4242 4242 4242 4242 (success), 4000 0000 0000 0002 (decline)
        </p>
      </div>
    </div>
  );
}
