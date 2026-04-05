'use client';

import { useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';

interface StripeCheckoutProps {
  amount: string;
  onSuccess: (paymentIntentId: string) => Promise<void>;
  onError: (message: string) => void;
}

export default function StripeCheckout({ amount, onSuccess, onError }: StripeCheckoutProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js has not yet loaded.
      return;
    }

    setIsProcessing(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Return URL is required, but with redirect: 'if_required', 
        // it won't actually redirect if the payment is successful immediately.
        return_url: `${window.location.origin}/purchase-completion`,
      },
      redirect: 'if_required',
    });

    if (error) {
      if (error.type === "card_error" || error.type === "validation_error") {
        onError(error.message || "An error occurred with your payment.");
      } else {
        onError("An unexpected error occurred.");
      }
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      // Payment successful!
      console.log('[StripeCheckout] Payment succeeded:', paymentIntent.id);
      await onSuccess(paymentIntent.id);
      setIsProcessing(false);
    } else {
      // Other statuses (processing, requires_action, etc.)
      console.log('[StripeCheckout] Payment status:', paymentIntent?.status);
      onError(`Payment status: ${paymentIntent?.status}`);
      setIsProcessing(false);
    }
  };

  return (
    <form id="payment-form" onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <PaymentElement id="payment-element" options={{ layout: 'accordion' }} />
      </div>

      <button
        disabled={isProcessing || !stripe || !elements}
        id="submit"
        className="w-full py-4 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]"
      >
        <span id="button-text">
          {isProcessing ? (
            <div className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Procesando Pago...
            </div>
          ) : (
            `Pagar €${amount}`
          )}
        </span>
      </button>
    </form>
  );
}
