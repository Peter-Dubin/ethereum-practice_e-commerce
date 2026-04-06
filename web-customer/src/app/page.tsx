'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const ECOMMERCE_ABI = [
  'function getAllProducts() view returns (tuple(uint256 productId, uint256 companyId, string name, string description, uint256 price, uint256 stock, string ipfsImageHash, bool isActive)[])',
  'function getCompany(uint256 companyId) view returns (tuple(uint256 companyId, string name, address companyAddress, string description, bool isActive, address owner))',
  'function addToCart(uint256 productId, uint256 quantity)',
  'function updateCartQuantity(uint256 productId, uint256 quantity)',
  'function removeFromCart(uint256 productId)',
  'function clearCart()',
  'function getCart() view returns (tuple(uint256 productId, uint256 quantity, uint256 priceAtAdd)[] cartItems, uint256 total)',
  'function createInvoice(uint256 companyId) returns (uint256)',
  'function getCustomerInvoices(address customer) view returns (uint256[])',
  'function getInvoice(uint256 invoiceId) view returns (tuple(uint256 invoiceId, uint256 companyId, address customerAddress, uint256 totalAmount, uint256 timestamp, bool isPaid, bytes32 paymentTxHash, string invoiceNumber))'
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
  const [success, setSuccess] = useState<string | null>(null);
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
        setSuccess('Wallet connected!');
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
      const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8545');
      const contract = new ethers.Contract(ecommerceAddress, ECOMMERCE_ABI, provider);
      
      const allProducts = await contract.getAllProducts();
      setProducts(allProducts.filter((p: Product) => p.isActive));
    } catch (err) {
      console.error('Error loading products:', err);
      setError('Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCart = async () => {
    if (!walletAddress || !ecommerceAddress) return;

    try {
      const provider = new ethers.BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(ecommerceAddress, ECOMMERCE_ABI, signer);
      
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
    setSuccess(null);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(ecommerceAddress, ECOMMERCE_ABI, signer);

      const tx = await contract.addToCart(productId, qty);
      await tx.wait();

      setSuccess('Item added to cart!');
      loadCart();
      setQuantities({ ...quantities, [productId.toString()]: 1 });
    } catch (err) {
      console.error('Error adding to cart:', err);
      setError(err instanceof Error ? err.message : 'Failed to add to cart');
    } finally {
      setIsLoading(false);
    }
  };

  const updateQuantity = async (productId: bigint, newQuantity: number) => {
    if (!walletAddress || !ecommerceAddress || newQuantity <= 0) return;

    setIsLoading(true);
    setError(null);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(ecommerceAddress, ECOMMERCE_ABI, signer);

      const tx = await contract.updateCartQuantity(productId, newQuantity);
      await tx.wait();
      loadCart();
    } catch (err) {
      console.error('Error updating quantity:', err);
      setError(err instanceof Error ? err.message : 'Failed to update quantity');
    } finally {
      setIsLoading(false);
    }
  };

  const removeItem = async (productId: bigint) => {
    if (!walletAddress || !ecommerceAddress) return;

    setIsLoading(true);
    setError(null);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(ecommerceAddress, ECOMMERCE_ABI, signer);

      const tx = await contract.removeFromCart(productId);
      await tx.wait();
      loadCart();
      setSuccess('Item removed from cart');
    } catch (err) {
      console.error('Error removing item:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove item');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCart = async () => {
    if (!walletAddress || !ecommerceAddress) return;

    setIsLoading(true);
    setError(null);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(ecommerceAddress, ECOMMERCE_ABI, signer);

      const tx = await contract.clearCart();
      await tx.wait();
      loadCart();
      setSuccess('Cart cleared');
    } catch (err) {
      console.error('Error clearing cart:', err);
      setError(err instanceof Error ? err.message : 'Failed to clear cart');
    } finally {
      setIsLoading(false);
    }
  };

  const checkout = async () => {
    if (!walletAddress || !ecommerceAddress || cart.length === 0) return;

    // Group items by company - in our simplified store, we checkout one by one
    const cartItem = cart[0];
    const product = products.find(p => p.productId.toString() === cartItem.productId.toString());
    
    if (!product) return;

    setIsLoading(true);
    setError(null);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(ecommerceAddress, ECOMMERCE_ABI, signer);

      const tx = await contract.createInvoice(product.companyId);
      const receipt = await tx.wait();
      
      // Parse invoice ID from log
      const invoiceId = receipt.logs[0]?.topics[1] ? BigInt(receipt.logs[0].topics[1]) : BigInt(0);
      
      // Get the invoice to find out total for this company
      const invoice = await contract.getInvoice(invoiceId);

      // Redirect to payment gateway
      const paymentUrl = new URL(paymentGatewayUrl);
      paymentUrl.searchParams.set('merchant_address', invoice.customerAddress); // Store wallet = customer address
      paymentUrl.searchParams.set('invoice_id', invoiceId.toString());
      paymentUrl.searchParams.set('invoice', invoice.invoiceNumber || `INV-${invoiceId}`);
      paymentUrl.searchParams.set('date', new Date(Number(invoice.timestamp) * 1000).toISOString().split('T')[0]);
      paymentUrl.searchParams.set('amount', (Number(invoice.totalAmount) / 1000000).toFixed(2));
      paymentUrl.searchParams.set('redirect', `${window.location.origin}`);
      
      window.location.href = paymentUrl.toString();
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
    <div className="min-h-screen bg-[#0a0a0a] text-[#ededed] font-sans">
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-10 py-6 flex justify-between items-center bg-black/40 backdrop-blur-xl border-x border-white/5 shadow-2xl">
          <div className="flex items-center gap-12">
            <h1 className="text-xl font-black text-white cursor-pointer tracking-[0.2em] uppercase" onClick={() => setActiveTab('products')}>
              E-COMMERCE STORE
            </h1>
            <nav className="hidden md:flex gap-8 text-[10px] font-black uppercase tracking-[0.1em]">
              {[
                { id: 'products', label: 'Marketplace' },
                { id: 'cart', label: `Cart (${cart.length})` },
                { id: 'orders', label: 'History' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`transition-all hover:text-white relative py-2 ${
                    activeTab === tab.id ? 'text-white' : 'text-gray-500'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <span className="absolute bottom-0 left-0 w-full h-[2px] bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.6)]"></span>
                  )}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-6">
            {walletAddress ? (
              <div className="flex items-center gap-4">
                <div className="wallet-box">
                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] text-gray-500 font-mono tracking-tighter">{formatAddress(walletAddress)}</p>
                    <p className="text-[9px] text-blue-400 uppercase tracking-widest font-black mt-1">SECURED</p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse"></div>
                </div>
                <button
                  onClick={() => setWalletAddress(null)}
                  className="px-4 py-2 border border-red-500/20 bg-red-500/5 hover:bg-red-500 hover:text-white text-red-500 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                className="px-8 py-3 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-full transition-all hover:scale-105"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="centered-layout py-32 min-h-screen">
        {error && (
          <div className="mb-12 p-6 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4 overflow-hidden relative max-w-2xl mx-auto backdrop-blur-xl">
            <div className="absolute left-0 top-0 bottom-0 w-2 bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]"></div>
            <p className="text-red-400 text-base font-bold tracking-tight">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-12 p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4 overflow-hidden relative max-w-2xl mx-auto backdrop-blur-xl">
            <div className="absolute left-0 top-0 bottom-0 w-2 bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]"></div>
            <p className="text-emerald-400 text-base font-bold tracking-tight">{success}</p>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="animate-in fade-in duration-500 w-full">
            <div className="flex-centered text-center mb-32 w-full pt-12">
              <h2 className="text-hero">MARKETPLACE</h2>
              <div className="max-w-4xl px-4">
                <p className="text-gray-400 text-2xl font-medium leading-relaxed tracking-tight max-w-3xl mx-auto">
                  Verified assets from our global merchant network. <br/>
                  <span className="text-white/60 font-light mt-2 block">Authenticity and quality guaranteed on-chain.</span>
                </p>
              </div>
              <div className="mt-16 px-10 py-4 bg-white/[0.03] border border-white/10 rounded-full text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] leading-none shadow-2xl backdrop-blur-md">
                {products.length} Protocol Nodes Active
              </div>
            </div>

            {isLoading && products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-500 font-medium">Loading marketplace...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-12 w-full place-items-center">
                {products.map((product) => (
                  <div 
                    key={product.productId.toString()} 
                    className="group bg-[#111] border border-white/10 rounded-[2.5rem] p-8 hover:bg-[#151515] hover:border-white/20 transition-all duration-500 hover:-translate-y-2 relative overflow-hidden flex flex-col shadow-2xl w-full max-w-[22rem]"
                  >
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-600/10 blur-[80px] group-hover:bg-blue-600/20 transition-all duration-500"></div>
                    <div className="flex justify-between items-start mb-10">
                      <div className="flex flex-col gap-3">
                        <h3 className="font-black text-3xl text-white group-hover:text-blue-400 transition-colors leading-none tracking-tight">
                          {product.name}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-700"></span>
                          <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest leading-none">Protocol Node {product.productId.toString()}</span>
                        </div>
                      </div>
                      <div className="px-3 py-1.5 bg-blue-500/10 rounded-full border border-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest italic">AUTHENTIC</span>
                      </div>
                    </div>
                    
                    <p className="text-gray-500 text-base line-clamp-3 min-h-[5rem] mb-10 leading-relaxed font-medium">
                      {product.description || "A premium protocol asset sourced from our verified merchant network."}
                    </p>
                    
                    <div className="flex items-center justify-between border-t border-white/5 pt-10 mt-auto mb-10">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-gray-600 uppercase font-black tracking-widest leading-none mb-1">Asset Value</span>
                        <span className="text-3xl font-black text-white tracking-tighter">€{formatPrice(product.price)}</span>
                      </div>
                      <div className="text-right flex flex-col gap-1">
                        <span className="text-[10px] text-gray-600 uppercase font-black tracking-widest leading-none mb-1">Stock Level</span>
                        <span className="text-sm text-blue-400 font-black tracking-widest">{product.stock.toString()} UNITS</span>
                      </div>
                    </div>

                    {walletAddress && (
                      <div className="flex gap-4">
                        <button
                          onClick={() => addToCart(product.productId)}
                          disabled={isLoading}
                          className="flex-1 bg-white hover:bg-gray-200 text-black text-[10px] font-black uppercase tracking-[0.2em] py-4 rounded-2xl transition-all shadow-xl active:scale-[0.98] disabled:bg-gray-800 disabled:text-gray-600"
                        >
                          {isLoading ? 'Processing' : 'Add To Cart'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!isLoading && products.length === 0 && (
              <div className="w-full text-center py-48 border border-dashed border-white/10 rounded-[4rem] bg-white/[0.01] shadow-inner">
                <p className="text-gray-700 text-xl italic font-bold tracking-widest">Protocol Inventory Empty</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'cart' && (
          <div className="animate-in fade-in max-w-4xl mx-auto w-full">
            <h2 className="text-4xl font-bold mb-10 tracking-tight">Shopping Cart</h2>
            {cart.length === 0 ? (
              <div className="text-center py-20 bg-white/5 border border-dashed border-white/10 rounded-2xl">
                <p className="text-gray-500 mb-6 font-medium">Your cart is empty.</p>
                <button 
                  onClick={() => setActiveTab('products')}
                  className="text-blue-400 hover:text-blue-300 font-bold text-sm"
                >
                  Return to Marketplace
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.04]">
                        <th className="px-8 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Product</th>
                        <th className="px-8 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-center">Qty</th>
                        <th className="px-8 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-right">Price</th>
                        <th className="px-8 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-right">Total</th>
                        <th className="px-8 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {cart.map((item) => {
                        const product = products.find(p => p.productId.toString() === item.productId.toString());
                        return (
                          <tr key={item.productId.toString()} className="hover:bg-white/[0.01]">
                            <td className="px-8 py-5">
                              <p className="font-bold text-white">{product?.name || 'Protocol Asset'}</p>
                              <p className="text-[10px] text-gray-600 font-mono">#{item.productId.toString()}</p>
                            </td>
                            <td className="px-8 py-5 text-center">
                              <div className="flex items-center justify-center gap-3 bg-black/30 w-fit mx-auto px-2 py-1 rounded-xl border border-white/5">
                                <button
                                  onClick={() => updateQuantity(item.productId, Number(item.quantity) - 1)}
                                  disabled={isLoading || item.quantity <= BigInt(1)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400 transition-colors disabled:opacity-30"
                                >
                                  -
                                </button>
                                <span className="font-mono text-white min-w-[20px]">{item.quantity.toString()}</span>
                                <button
                                  onClick={() => updateQuantity(item.productId, Number(item.quantity) + 1)}
                                  disabled={isLoading || (product && item.quantity >= product.stock)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400 transition-colors disabled:opacity-30"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="px-8 py-5 text-right font-mono text-sm text-gray-400">€{formatPrice(item.priceAtAdd)}</td>
                            <td className="px-8 py-5 text-right font-mono font-bold text-white text-lg">€{formatPrice(item.priceAtAdd * item.quantity)}</td>
                            <td className="px-8 py-5 text-center">
                              <button
                                onClick={() => removeItem(item.productId)}
                                disabled={isLoading}
                                className="p-2 hover:bg-red-500/10 text-gray-500 hover:text-red-500 rounded-lg transition-all active:scale-95"
                                title="Remove item"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-white/[0.05]">
                        <td colSpan={3} className="px-8 py-8 text-right border-t border-white/10">
                          <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Grand Total</span>
                        </td>
                        <td className="px-8 py-8 text-right border-t border-white/10" colSpan={2}>
                          <span className="text-3xl font-bold text-white italic">€{formatPrice(cartTotal)}</span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="flex flex-col gap-4">
                  <button
                    onClick={checkout}
                    disabled={isLoading || !walletAddress}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-xl shadow-blue-600/20 active:scale-[0.98] disabled:bg-gray-800 disabled:text-gray-600"
                  >
                    {isLoading ? 'Processing...' : walletAddress ? 'Proceed to Checkout' : 'Connect Wallet to Checkout'}
                  </button>
                  <button
                    onClick={handleClearCart}
                    disabled={isLoading || !walletAddress}
                    className="w-full py-4 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-bold rounded-xl transition-all border border-white/10 active:scale-[0.98] disabled:opacity-50"
                  >
                    {isLoading ? 'Processing...' : 'Clear Cart'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="animate-in fade-in w-full">
            <h2 className="text-4xl font-bold mb-10 tracking-tight">Order History</h2>
            {invoices.length === 0 ? (
              <div className="text-center py-20 bg-white/5 border border-dashed border-white/10 rounded-2xl">
                <p className="text-gray-500 italic">No orders found.</p>
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.04]">
                      <th className="px-8 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Order #</th>
                      <th className="px-8 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-right">Subtotal</th>
                      <th className="px-8 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-right">Date</th>
                      <th className="px-8 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {invoices.map((invoice) => (
                      <tr key={invoice.invoiceId.toString()} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-8 py-6">
                          <p className="font-bold text-white text-base">{invoice.invoiceNumber || "INV"}</p>
                          <p className="text-[10px] text-gray-500 font-mono mt-1">ID: {invoice.invoiceId.toString()}</p>
                        </td>
                        <td className="px-8 py-6 text-right font-mono text-base text-gray-300">€{formatPrice(invoice.totalAmount)}</td>
                        <td className="px-8 py-6 text-right">
                          <p className="text-sm text-gray-400">
                            {new Date(Number(invoice.timestamp) * 1000).toLocaleDateString()}
                          </p>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <span className={`px-3 py-1 text-[10px] font-black uppercase rounded-full ${
                            invoice.isPaid ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                          }`}>
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
