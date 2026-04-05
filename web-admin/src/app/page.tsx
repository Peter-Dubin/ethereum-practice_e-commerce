'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

const ECOMMERCE_ABI = [
  'function registerCompany(string name, string taxId) returns (uint256)',
  'function addProduct(uint256 companyId, string name, string description, uint256 price, uint256 stock, string ipfsImageHash) returns (uint256)',
  'function getCompany(uint256 companyId) view returns (tuple(uint256 companyId, string name, address companyAddress, string taxId, bool isActive, address owner))',
  'function ownerToCompanyId(address owner) view returns (uint256)',
  'function companyCount() view returns (uint256)',
  'function getCompanyProductIds(uint256 companyId) view returns (uint256[])',
  'function getProduct(uint256 productId) view returns (tuple(uint256 productId, uint256 companyId, string name, string description, uint256 price, uint256 stock, string ipfsImageHash, bool isActive))',
  'function getCompanyInvoices(uint256 companyId) view returns (uint256[])',
  'function getInvoice(uint256 invoiceId) view returns (tuple(uint256 invoiceId, uint256 companyId, address customerAddress, uint256 totalAmount, uint256 timestamp, bool isPaid, bytes32 paymentTxHash, string invoiceNumber))',
  'event CompanyRegistered(uint256 indexed companyId, string name, address indexed owner, string taxId)'
];

declare global {
  interface Window {
    ethereum?: any;
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

interface Company {
  companyId: bigint;
  name: string;
  companyAddress: string;
  taxId: string;
  isActive: boolean;
}

type View = 'companies_list' | 'register_company' | 'merchant_dashboard';

export default function AdminPage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [view, setView] = useState<View>('companies_list');
  const [selectedCompanyId, setSelectedCompanyId] = useState<bigint | null>(null);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activeDashboardTab, setActiveDashboardTab] = useState<'products' | 'invoices'>('products');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Forms
  const [companyName, setCompanyName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productStock, setProductStock] = useState('');

  const ecommerceAddress = process.env.NEXT_PUBLIC_ECOMMERCE_CONTRACT_ADDRESS;
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8545';

  const loadAllCompanies = async (contract: ethers.Contract) => {
    try {
      const count = await contract.companyCount();
      const companies: Company[] = [];
      for (let i = 1n; i <= count; i++) {
        const company = await contract.getCompany(i);
        companies.push({
          companyId: company.companyId,
          name: company.name,
          companyAddress: company.companyAddress,
          taxId: company.taxId,
          isActive: company.isActive,
          owner: company.owner // Assuming Ecommerce.sol Company struct has owner or getCompany returns it
        } as any);
      }
      setAllCompanies(companies);
    } catch (err) {
      console.error('[Admin] Error loading all companies:', err);
    }
  };

  const loadMerchantData = async (contract: ethers.Contract, cid: bigint) => {
    try {
      // Load products
      const productIds = await contract.getCompanyProductIds(cid);
      const loadedProducts: Product[] = [];
      for (const pid of productIds) {
        const product = await contract.getProduct(pid);
        loadedProducts.push(product);
      }
      setProducts(loadedProducts);

      // Load invoices
      const invoiceIds = await contract.getCompanyInvoices(cid);
      const loadedInvoices: Invoice[] = [];
      for (const iid of invoiceIds) {
        const invoice = await contract.getInvoice(iid);
        loadedInvoices.push(invoice);
      }
      setInvoices(loadedInvoices);
    } catch (err) {
      console.error('[Admin] Error loading merchant data:', err);
      setProducts([]);
      setInvoices([]);
    }
  };

  const init = useCallback(async () => {
    if (!ecommerceAddress) {
      setError('Contract address not found in environment');
      setIsLoading(false);
      return;
    }

    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const contract = new ethers.Contract(ecommerceAddress, ECOMMERCE_ABI, provider);

      // 1. Load All Companies for the list view
      await loadAllCompanies(contract);

      // 2. Check if user is connected
      if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          const address = accounts[0];
          setWalletAddress(address);
        }
      }
    } catch (err) {
      console.error('[Admin] Initialization error:', err);
      setError('Failed to initialize app. Make sure your local node is running.');
    } finally {
      setIsLoading(false);
    }
  }, [ecommerceAddress, rpcUrl]);

  useEffect(() => {
    init();
  }, [init]);

  // When selected company changes, reload dashboard data
  useEffect(() => {
    if (selectedCompanyId && ecommerceAddress) {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const contract = new ethers.Contract(ecommerceAddress, ECOMMERCE_ABI, provider);
      loadMerchantData(contract, selectedCompanyId);
    }
  }, [selectedCompanyId, ecommerceAddress, rpcUrl]);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setError('MetaMask not installed');
      return;
    }

    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts.length > 0) {
        setWalletAddress(accounts[0]);
        // Refresh data
        init();
      }
    } catch (err) {
      console.error('Error connecting wallet:', err);
      setError('Failed to connect wallet');
    }
  };

  const handleDisconnect = () => {
    setWalletAddress(null);
    setSelectedCompanyId(null);
    setView('companies_list');
    setSuccess('Disconnected from wallet');
  };

  const selectCompany = (cid: bigint) => {
    setSelectedCompanyId(cid);
    setView('merchant_dashboard');
  };

  const handleRegisterCompany = async () => {
    if (!companyName || !taxId || !ecommerceAddress || !window.ethereum) {
      setError('Please fill in all fields and ensure MetaMask is connected');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(ecommerceAddress, ECOMMERCE_ABI, signer);

      console.log('[Admin] Registering company:', companyName, 'with taxId:', taxId);
      const tx = await contract.registerCompany(companyName, taxId);
      console.log('[Admin] Transaction sent:', tx.hash);
      
      const receipt = await tx.wait();
      console.log('[Admin] Transaction confirmed in block:', receipt.blockNumber);

      setSuccess('Company registered successfully!');
      setCompanyName('');
      setTaxId('');
      
      // Refresh state
      await init();
      // Stay on list view as requested
      setView('companies_list');
    } catch (err: any) {
      console.error('[Admin] Error registering company:', err);
      setError(err instanceof Error ? err.message : 'Failed to register company');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddProduct = async () => {
    if (!productName || !productPrice || !productStock || !selectedCompanyId || !ecommerceAddress || !window.ethereum) {
      setError('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(ecommerceAddress, ECOMMERCE_ABI, signer);

      const priceInCents = Math.floor(parseFloat(productPrice) * 1000000);
      
      const tx = await contract.addProduct(
        selectedCompanyId,
        productName,
        productDescription,
        priceInCents,
        parseInt(productStock),
        ''
      );
      await tx.wait();

      setSuccess('Product added successfully!');
      setProductName('');
      setProductDescription('');
      setProductPrice('');
      setProductStock('');
      
      // Refresh data
      loadMerchantData(contract, selectedCompanyId);
    } catch (err) {
      console.error('Error adding product:', err);
      setError(err instanceof Error ? err.message : 'Failed to add product');
    } finally {
      setIsLoading(false);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatPrice = (price: bigint) => {
    return (Number(price) / 1000000).toFixed(2);
  };

  const selectedCompany = allCompanies.find(c => c.companyId === selectedCompanyId);
  const isOwner = selectedCompany?.companyAddress.toLowerCase() === walletAddress?.toLowerCase();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400 font-medium">Loading E-Commerce Admin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#ededed] font-sans">
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent cursor-pointer" onClick={() => setView('companies_list')}>
              E-Commerce Admin
            </h1>
            <nav className="hidden md:flex gap-6 text-sm font-medium">
              <button 
                onClick={() => setView('companies_list')}
                className={`hover:text-blue-400 transition-colors ${view === 'companies_list' ? 'text-blue-400' : 'text-gray-400'}`}
              >
                All Companies
              </button>
              {selectedCompanyId && (
                <button 
                  onClick={() => setView('merchant_dashboard')}
                  className={`hover:text-blue-400 transition-colors ${view === 'merchant_dashboard' ? 'text-blue-400' : 'text-gray-400'}`}
                >
                  Current Shop Dashboard
                </button>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {walletAddress ? (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-gray-500 font-mono">{formatAddress(walletAddress)}</p>
                  <p className="text-[10px] text-blue-400 uppercase tracking-widest font-bold">CONNECTED</p>
                </div>
                <button 
                  onClick={handleDisconnect}
                  className="px-4 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-bold rounded-full transition-all border border-red-500/20"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition-all shadow-lg shadow-blue-600/20"
              >
                Connect MetaMask
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 overflow-hidden relative">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
            <p className="text-red-400 text-sm font-medium">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-8 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 overflow-hidden relative">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
            <p className="text-emerald-400 text-sm font-medium">{success}</p>
          </div>
        )}

        {/* View: Companies List */}
        {view === 'companies_list' && (
          <div className="animate-in fade-in transition-all duration-500">
            <div className="flex justify-between items-end mb-8">
              <div>
                <h2 className="text-3xl font-bold mb-2">Companies</h2>
                <p className="text-gray-500">Overview of all registered companies on the platform</p>
              </div>
              <button
                onClick={() => setView('register_company')}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20"
              >
                Register Company
              </button>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02]">
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">ID</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Company Name</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Owner Address</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {allCompanies.length > 0 ? (
                    allCompanies.map((c) => (
                      <tr key={c.companyId.toString()} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-6 py-5 text-sm font-mono text-gray-500">{c.companyId.toString()}</td>
                        <td className="px-6 py-5">
                          <span className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                            {c.name}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-sm font-mono text-gray-500">{formatAddress(c.companyAddress)}</td>
                        <td className="px-6 py-5 text-right">
                          <button 
                            onClick={() => selectCompany(c.companyId)}
                            className="px-4 py-1.5 bg-white/5 hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition-all border border-white/5 hover:border-blue-500"
                          >
                            View Dashboard
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-20 text-center text-gray-600 italic">
                        No companies registered yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* View: Register Company */}
        {view === 'register_company' && (
          <div className="max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4">
            <button 
              onClick={() => setView('companies_list')}
              className="mb-8 text-sm text-gray-500 hover:text-white flex items-center gap-2 transition-colors"
            >
              ← Back to list
            </button>
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-3xl"></div>
              <h2 className="text-2xl font-bold mb-2">Register Company</h2>
              <p className="text-gray-500 mb-8">Start your journey as a merchant on our platform</p>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Company Name</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-all"
                    placeholder="e.g. Acme Corporation"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Tax ID</label>
                  <input
                    type="text"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-all"
                    placeholder="e.g. US-12345678"
                  />
                </div>
                <button
                  onClick={handleRegisterCompany}
                  disabled={isLoading}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white font-bold rounded-xl transition-all shadow-xl shadow-blue-600/20"
                >
                  {isLoading ? 'Processing...' : 'Register Company'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View: Merchant Dashboard */}
        {view === 'merchant_dashboard' && (
          <div className="animate-in fade-in transition-all">
            <div className="flex items-center gap-4 mb-8">
              <button 
                onClick={() => setView('companies_list')}
                className="text-sm text-gray-500 hover:text-white transition-colors"
              >
                ← Back
              </button>
              <h2 className="text-3xl font-bold">Dashboard: {selectedCompany?.name || 'Shop'}</h2>
              {isOwner && (
                <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase rounded-md border border-blue-500/20 tracking-tighter">My Store</span>
              )}
            </div>
            
            <div className="flex gap-2 p-1 bg-white/5 border border-white/10 rounded-xl w-fit mb-8">
              <button
                onClick={() => setActiveDashboardTab('products')}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeDashboardTab === 'products' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
              >
                Products ({products.length})
              </button>
              <button
                onClick={() => setActiveDashboardTab('invoices')}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeDashboardTab === 'invoices' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
              >
                Invoices ({invoices.length})
              </button>
            </div>

            {activeDashboardTab === 'products' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-1">
                  {isOwner ? (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sticky top-24 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 blur-3xl"></div>
                      <h3 className="text-lg font-bold mb-6">Add New Product</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Product Name</label>
                          <input
                            type="text"
                            value={productName}
                            onChange={(e) => setProductName(e.target.value)}
                            className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Price (EUR)</label>
                          <input
                            type="text"
                            value={productPrice}
                            onChange={(e) => setProductPrice(e.target.value)}
                            className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Initial Stock</label>
                          <input
                            type="number"
                            value={productStock}
                            onChange={(e) => setProductStock(e.target.value)}
                            className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Description</label>
                          <textarea
                            value={productDescription}
                            onChange={(e) => setProductDescription(e.target.value)}
                            className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50 h-24"
                          />
                        </div>
                        <button
                          onClick={handleAddProduct}
                          disabled={isLoading}
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20"
                        >
                          {isLoading ? 'Adding...' : 'Create Product'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                      <p className="text-gray-500 text-sm italic">You can only add products to your own companies.</p>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-2">
                  <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                          <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Product</th>
                          <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Price</th>
                          <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Stock</th>
                          <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {products.map((p) => (
                          <tr key={p.productId.toString()} className="hover:bg-white/[0.01]">
                            <td className="px-6 py-4">
                              <div>
                                <p className="text-sm font-bold text-white">{p.name}</p>
                                <p className="text-xs text-gray-500 truncate max-w-[200px]">{p.description}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm font-mono text-gray-300">€{formatPrice(p.price)}</td>
                            <td className="px-6 py-4 text-sm text-gray-400">{p.stock.toString()}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-full ${
                                p.isActive ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/10' : 'bg-red-500/10 text-red-500 border border-red-500/10'
                              }`}>
                                {p.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {products.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-6 py-20 text-center text-gray-600">No products added yet</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeDashboardTab === 'invoices' && (
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden animate-in fade-in">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Invoice ID</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Customer</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Amount</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {invoices.map((i) => (
                      <tr key={i.invoiceId.toString()} className="hover:bg-white/[0.01]">
                        <td className="px-6 py-4 text-sm font-bold text-white">{i.invoiceNumber}</td>
                        <td className="px-6 py-4 text-sm font-mono text-gray-500">{formatAddress(i.customerAddress)}</td>
                        <td className="px-6 py-4 text-sm font-mono text-gray-300">€{formatPrice(i.totalAmount)}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 text-[10px] font-black uppercase rounded-full ${
                            i.isPaid ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/10' : 'bg-amber-500/10 text-amber-500 border border-amber-500/10'
                          }`}>
                            {i.isPaid ? 'Paid' : 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {invoices.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-20 text-center text-gray-600">No invoices generated yet</td>
                      </tr>
                    )}
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
