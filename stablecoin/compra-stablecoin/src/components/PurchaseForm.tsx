'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import StripeCheckout from './StripeCheckout';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

interface PurchaseFormProps {
  walletAddress: string;
  onSuccess?: (txHash: string, amount: string) => void;
}

export default function PurchaseForm({ walletAddress, onSuccess }: PurchaseFormProps) {
  const [eurAmount, setEurAmount] = useState<string>('100');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [eurtBalance, setEurtBalance] = useState<string>('0.0');

  // Fetch balance from the EuroToken contract
  const fetchBalance = async () => {
    if (!walletAddress || !window.ethereum) return;

    try {
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const contractAddress = process.env.NEXT_PUBLIC_EUROTOKEN_CONTRACT_ADDRESS || '';
      
      if (!contractAddress) return;

      const abi = ['function balanceOf(address account) view returns (uint256)'];
      const contract = new ethers.Contract(contractAddress, abi, provider);
      const balance = await contract.balanceOf(walletAddress);
      
      // EURT has 0 decimals
      setEurtBalance(balance.toString());
    } catch (err) {
      console.error('Error fetching EURT balance:', err);
    }
  };

  useEffect(() => {
    fetchBalance();

    // Check for balance updates on new blocks or events could go here
    // For now, simple initial fetch and fetch-after-mint
  }, [walletAddress]);

  const handleCreateIntent = async () => {
    if (!eurAmount || parseFloat(eurAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(eurAmount) * 100, // Stripe uses cents
          walletAddress
        })
      });

      if (!response.ok) {
        throw new Error('Error creating payment intent');
      }

      const { clientSecret: secret } = await response.json();
      setClientSecret(secret);
    } catch (err) {
      console.error('Error creating intent:', err);
      setError(err instanceof Error ? err.message : 'Error starting payment');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaymentSuccess = async (paymentIntentId: string) => {
    setIsProcessing(true);
    setSuccess('Payment successful! Tokens will be issued shortly.');
    
    try {
      console.log('[PurchaseForm] Payment confirmed, minting tokens for:', walletAddress, 'amount:', eurAmount);
      const mintResponse = await fetch('/api/mint-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          amount: parseFloat(eurAmount)
        })
      });

      if (!mintResponse.ok) {
        const errorData = await mintResponse.json();
        throw new Error(errorData.details || 'Error issuing tokens');
      }

      const mintData = await mintResponse.json();
      const { transactionHash } = mintData;
      
      setSuccess(`Purchase completed! ${eurAmount} EURT have been issued.`);
      onSuccess?.(transactionHash, eurAmount);
      
      // Refresh balance after successful mint
      setTimeout(fetchBalance, 2000);
      
    } catch (err) {
      console.error('Minting error:', err);
      setError(err instanceof Error ? err.message : 'Error issuing tokens after payment');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatAmountInput = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return parts[0] + '.' + parts[1];
    return cleaned;
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Purchase Details */}
        <div className="space-y-6">
          <section className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-8">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Purchase Details</h3>
            
            <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-xl border border-blue-100 dark:border-blue-800 mb-8">
              <h4 className="text-blue-700 dark:text-blue-400 font-bold text-lg mb-2">EuroToken (EURT)</h4>
              <p className="text-blue-600 dark:text-blue-500 text-sm leading-relaxed">
                Stablecoin backed 1:1 with EUR. Perfect for stable transactions in the DeFi ecosystem.
              </p>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Purchase Amount (EUR)
              </label>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-lg">€</span>
                <input
                  type="text"
                  value={eurAmount}
                  onChange={(e) => setEurAmount(formatAmountInput(e.target.value))}
                  placeholder="0.00"
                  className="w-full pl-10 pr-4 py-4 text-xl font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                  disabled={!!clientSecret}
                />
              </div>
              <div className="flex justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 px-1">
                <span>Min: €10, Max: €10,000</span>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-800 space-y-4">
              <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl">
                <span className="text-gray-600 dark:text-gray-400 font-medium">Tokens to receive:</span>
                <span className="text-xl font-black text-blue-600 dark:text-blue-400">
                  {eurAmount || '0'} EURT
                </span>
              </div>
              <div className="flex justify-between items-center px-4">
                <span className="text-gray-500 dark:text-gray-400 text-sm">Exchange rate:</span>
                <span className="text-gray-900 dark:text-white font-bold">1 EUR = 1 EURT</span>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Payment Info */}
        <div className="space-y-6">
          <section className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="p-8">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Payment Information</h3>
              
              <div className="space-y-4 mb-8">
                <div className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 p-4 rounded-xl">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-green-700 dark:text-green-400 font-bold text-sm">Connected Wallet</span>
                    </div>
                    <button className="text-red-500 hover:text-red-600 text-xs font-bold underline decoration-2 underline-offset-4">Disconnect</button>
                  </div>
                  <div className="bg-white dark:bg-gray-800 border border-green-200/50 dark:border-green-800/30 p-4 rounded-lg">
                    <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">EuroToken Balance</p>
                    <p className="text-2xl font-black text-green-600 dark:text-green-400">{eurtBalance} EURT</p>
                  </div>
                </div>
                
                <div className="bg-blue-50/50 dark:bg-blue-900/5 p-3 rounded-lg border border-blue-100/50 dark:border-blue-800/30">
                  <p className="text-blue-700/70 dark:text-blue-400/70 text-[10px] font-bold uppercase mb-1">Connected wallet:</p>
                  <p className="font-mono text-xs text-blue-600 dark:text-blue-400 break-all">{walletAddress}</p>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/30 p-6 rounded-xl space-y-4 mb-8">
                <h4 className="font-bold text-gray-900 dark:text-white text-sm">Order Summary</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Quantity:</span>
                    <span className="font-bold text-gray-900 dark:text-white">{eurAmount} EURT</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Price per token:</span>
                    <span className="font-bold text-gray-900 dark:text-white">€1.00</span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {!clientSecret ? (
                  <button
                    onClick={handleCreateIntent}
                    disabled={isProcessing || !eurAmount || parseFloat(eurAmount) <= 10}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {isProcessing ? 'Preparing Payment...' : `Proceed to Payment`}
                  </button>
                ) : (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                     <h4 className="font-bold text-gray-700 dark:text-gray-300 text-sm mb-4 uppercase tracking-widest">Payment Information</h4>
                    <Elements stripe={stripePromise} options={{ clientSecret }}>
                      <StripeCheckout 
                        amount={eurAmount} 
                        onSuccess={handlePaymentSuccess}
                        onError={setError}
                      />
                    </Elements>
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl animate-in shake duration-300">
                  <p className="text-red-700 dark:text-red-400 text-sm font-medium">{error}</p>
                </div>
              )}

              {success && (
                <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl animate-in zoom-in duration-300">
                  <p className="text-green-700 dark:text-green-400 text-sm font-medium">{success}</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
