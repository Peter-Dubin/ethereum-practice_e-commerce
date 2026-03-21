'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const ECOMMERCE_ABI = [
  'function getAllProducts() view returns (tuple(uint256 productId, uint256 companyId, string name, string description, uint256 price, uint256 stock, string ipfsImageHash, bool isActive)[])',
  'function getCompany(uint256 companyId) view returns (tuple(uint256 companyId, string name, address companyAddress, string taxId, bool isActive, address owner))',
  'function addToCart(uint256 productId, uint256 quantity)',
  'function getCart() view returns (tuple(uint256 productId, uint256 quantity, uint256 priceAtAdd)[] cartItems, uint256 total)',
  'function createInvoice(uint256 companyId) returns (uint256)',
  'function getCustomerInvoices(address customer) view returns (uint256[])',
  'function getInvoice(uint256 invoiceId) view returns (tuple(uint256 invoiceId, uint256 companyId, address customerAddress, uint256 totalAmount, uint256 timestamp, bool isPaid, bytes32 paymentTxHash, string invoiceNumber))',
  'function clearCart()'
];

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

interface Product {
  productId: bigint;
  companyId: bigint;
  name: string;
  description: string;
  price: bigint;
  stock: bigint;
  ipfsImageHash: string;
  isActive: boolean;
}

interface CartItem {
  productId: bigint;
  quantity: bigint;
  priceAtAdd: bigint;
}

interface Invoice {
  invoiceId: bigint;
  companyId: bigint;
  customerAddress: string;
  totalAmount: bigint;
  timestamp: bigint;
  isPaid: boolean;
  paymentTxHash: string;
  invoiceNumber: string;
}

export default function CustomerPage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartTotal, setCartTotal] = useState<bigint>(BigInt(0));
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activeTab, setActiveTab] = useState<'products' | 'cart' | 'orders'>('products');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const ecommerceAddress = process.env.NEXT_PUBLIC_ECOMMERCE_CONTRACT_ADDRESS;
  const paymentGatewayUrl = process.env.NEXT_PUBLIC_PAYMENT_GATEWAY_URL || 'http://localhost:6002';

  useEffect(() => {
    if (ecommerceAddress) {
      loadProducts();
    }
  }, [ecommerceAddress]);

  useEffect(() => {
    if (walletAddress && ecommerceAddress) {
      loadCart();
      loadInvoices();
    }
  }, [walletAddress, ecommerceAddress]);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setError('MetaMask not installed');
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      
      if (accounts.length > 0) {
        setWalletAddress(accounts[0]);
      }
    } catch (err) {
      console.error('Error connecting wallet:', err);
      setError('Failed to connect wallet');
    }
  };

  const loadProducts = async () => {
    if (!ecommerceAddress) return;

    setIsLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum || (await import('ethers').then(m => m.BrowserProvider.prototype)));
      const contract = new ethers.Contract(ecommerceAddress, ECOMMERCE_ABI, provider);
      
      const allProducts = await contract.getAllProducts();
      setProducts(allProducts.filter((p: Product) => p.isActive));
    } catch (err) {
      console.error('Error loading products:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCart = async () => {
    if (!walletAddress || !ecommerceAddress) return;

    try {
      const provider = new ethers.BrowserProvider(window.ethereum!);
      const contract = new ethers.Contract(ecommerceAddress, ECOMMERCE_ABI, provider);
      
      const [cartItems, total] = await contract.getCart();
      setCart(cartItems);
      setCartTotal(total);
    } catch (err) {
      console.error('Error loading cart:', err);
    }
  };

  const loadInvoices = async () => {
    if (!walletAddress || !ecommerceAddress) return;

    try {
      const provider = new ethers.BrowserProvider(window.ethereum!);
      const contract = new ethers.Contract(ecommerceAddress, ECOMMERCE_ABI, provider);
      
      const invoiceIds = await contract.getCustomerInvoices(walletAddress);
      const loadedInvoices: Invoice[] = [];
      for (const iid of invoiceIds) {
        const invoice = await contract.getInvoice(iid);
        loadedInvoices.push(invoice);
      }
      setInvoices(loadedInvoices);
    } catch (err) {
      console.error('Error loading invoices:', err);
    }
  };

  const addToCart = async (productId: bigint) => {
    if (!walletAddress || !ecommerceAddress) {
      setError('Please connect your wallet first');
      return;
    }

    const qty = quantities[productId.toString()] || 1;
    if (qty <= 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(ecommerceAddress, ECOMMERCE_ABI, signer);

      const tx = await contract.addToCart(productId, qty);
      await tx.wait();

      loadCart();
      setQuantities({ ...quantities, [productId.toString()]: 1 });
    } catch (err) {
      console.error('Error adding to cart:', err);
      setError(err instanceof Error ? err.message : 'Failed to add to cart');
    } finally {
      setIsLoading(false);
    }
  };

  const checkout = async () => {
    if (!walletAddress || !ecommerceAddress || cart.length === 0) return;

    // Group items by company
    const itemsByCompany: Record<string, CartItem[]> = {};
    for (const item of cart) {
      const product = products.find(p => p.productId.toString() === item.productId.toString());
      if (product) {
        const companyId = product.companyId.toString();
        if (!itemsByCompany[companyId]) {
          itemsByCompany[companyId] = [];
        }
        itemsByCompany[companyId].push(item);
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(ecommerceAddress, ECOMMERCE_ABI, signer);

      // Create invoice for each company
      for (const companyId of Object.keys(itemsByCompany)) {
        const tx = await contract.createInvoice(companyId);
        const receipt = await tx.wait();
        
        // Parse invoice ID from events (simplified)
        const invoiceId = receipt.logs[0]?.topics[1] ? BigInt(receipt.logs[0].topics[1]) : BigInt(0);
        
        // Redirect to payment gateway
        const paymentUrl = new URL(paymentGatewayUrl);
        paymentUrl.searchParams.set('merchant_address', walletAddress);
        paymentUrl.searchParams.set('invoice_id', invoiceId.toString());
        paymentUrl.searchParams.set('amount', cartTotal.toString());
        paymentUrl.searchParams.set('redirect', `${window.location.origin}/orders`);
        
        window.location.href = paymentUrl.toString();
        return;
      }
    } catch (err) {
      console.error('Error during checkout:', err);
      setError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: bigint) => {
    return (Number(price) / 1000000).toFixed(2);
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">E-Commerce Store</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 py-2 rounded-lg ${activeTab === 'products' ? 'bg-blue-600 text-white' : 'text-gray-700'}`}
            >
              Products
            </button>
            <button
              onClick={() => setActiveTab('cart')}
              className={`px-4 py-2 rounded-lg ${activeTab === 'cart' ? 'bg-blue-600 text-white' : 'text-gray-700'}`}
            >
              Cart ({cart.length})
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-2 rounded-lg ${activeTab === 'orders' ? 'bg-blue-600 text-white' : 'text-gray-700'}`}
            >
              Orders
            </button>
            {walletAddress ? (
              <span className="font-mono text-sm bg-gray-100 px-3 py-2 rounded-lg">
                {formatAddress(walletAddress)}
              </span>
            ) : (
              <button
                onClick={connectWallet}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {activeTab === 'products' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Products</h2>
            {isLoading ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {products.map((product) => (
                  <div key={product.productId.toString()} className="bg-white rounded-lg shadow p-4">
                    <h3 className="font-semibold text-lg">{product.name}</h3>
                    <p className="text-gray-600 text-sm mt-1">{product.description}</p>
                    <div className="mt-4 flex justify-between items-center">
                      <span className="text-xl font-bold text-blue-600">€{formatPrice(product.price)}</span>
                      <span className="text-sm text-gray-500">Stock: {product.stock.toString()}</span>
                    </div>
                    {walletAddress && (
                      <div className="mt-4 flex gap-2">
                        <input
                          type="number"
                          min="1"
                          max={product.stock.toString()}
                          value={quantities[product.productId.toString()] || 1}
                          onChange={(e) => setQuantities({ ...quantities, [product.productId.toString()]: parseInt(e.target.value) || 1 })}
                          className="w-20 px-2 py-1 border rounded"
                        />
                        <button
                          onClick={() => addToCart(product.productId)}
                          disabled={isLoading}
                          className="flex-1 bg-blue-600 text-white py-1 px-3 rounded hover:bg-blue-700 disabled:bg-gray-400"
                        >
                          Add to Cart
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'cart' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Shopping Cart</h2>
            {cart.length === 0 ? (
              <p className="text-gray-600">Your cart is empty</p>
            ) : (
              <div className="bg-white rounded-lg shadow p-6">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Product</th>
                      <th className="text-right py-2">Quantity</th>
                      <th className="text-right py-2">Price</th>
                      <th className="text-right py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item) => {
                      const product = products.find(p => p.productId.toString() === item.productId.toString());
                      return (
                        <tr key={item.productId.toString()} className="border-b">
                          <td className="py-3">{product?.name || 'Unknown'}</td>
                          <td className="text-right py-3">{item.quantity.toString()}</td>
                          <td className="text-right py-3">€{formatPrice(item.priceAtAdd)}</td>
                          <td className="text-right py-3">€{formatPrice(item.priceAtAdd * item.quantity)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="text-right py-4 font-semibold">Total:</td>
                      <td className="text-right py-4 font-bold text-xl">€{formatPrice(cartTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
                <button
                  onClick={checkout}
                  disabled={isLoading || !walletAddress}
                  className="w-full mt-4 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                >
                  {isLoading ? 'Processing...' : walletAddress ? 'Checkout' : 'Connect Wallet to Checkout'}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'orders' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">My Orders</h2>
            {invoices.length === 0 ? (
              <p className="text-gray-600">No orders yet</p>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-6 py-3">Order #</th>
                      <th className="text-right px-6 py-3">Amount</th>
                      <th className="text-right px-6 py-3">Date</th>
                      <th className="text-right px-6 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.invoiceId.toString()} className="border-t">
                        <td className="px-6 py-4">{invoice.invoiceNumber}</td>
                        <td className="text-right px-6 py-4">€{formatPrice(invoice.totalAmount)}</td>
                        <td className="text-right px-6 py-4">{new Date(Number(invoice.timestamp) * 1000).toLocaleDateString()}</td>
                        <td className="text-right px-6 py-4">
                          <span className={`px-2 py-1 text-xs rounded-full ${invoice.isPaid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {invoice.isPaid ? 'Paid' : 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
