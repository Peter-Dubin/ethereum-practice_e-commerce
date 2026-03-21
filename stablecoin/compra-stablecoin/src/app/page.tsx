'use client';

import { useState } from 'react';
import WalletConnect from '@/components/WalletConnect';
import PurchaseForm from '@/components/PurchaseForm';

export default function Home() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <header className="bg-white dark:bg-gray-900 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            EuroToken Purchase
          </h1>
          <WalletConnect onAddressChange={setWalletAddress} />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-4">
            Buy EuroToken (EURT)
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Purchase EuroTokens using your credit card and shop on our blockchain-powered e-commerce platform
          </p>
        </div>

        {walletAddress ? (
          <div className="flex justify-center">
            <PurchaseForm walletAddress={walletAddress} />
          </div>
        ) : (
          <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-xl shadow-lg max-w-md mx-auto">
            <div className="mb-6">
              <svg
                className="mx-auto h-16 w-16 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Connect Your Wallet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Please connect your MetaMask wallet to purchase EuroTokens
            </p>
            <WalletConnect onAddressChange={setWalletAddress} />
          </div>
        )}

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6">
            <div className="text-3xl mb-4">💳</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Secure Payments
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Pay with your credit card through Stripe's secure payment system
            </p>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6">
            <div className="text-3xl mb-4">⚡</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Instant Delivery
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Receive your EuroTokens instantly after successful payment
            </p>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6">
            <div className="text-3xl mb-4">🔒</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              1:1 Pegged
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              1 EURT = 1 EUR - Stable and reliable value
            </p>
          </div>
        </div>
      </main>

      <footer className="bg-white dark:bg-gray-900 mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 dark:text-gray-400">
          <p>EuroToken - Blockchain E-Commerce Platform</p>
        </div>
      </footer>
    </div>
  );
}
