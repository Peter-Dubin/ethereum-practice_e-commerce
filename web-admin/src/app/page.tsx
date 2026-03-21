'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const ECOMMERCE_ABI = [
  'function registerCompany(string name, string taxId) returns (uint256)',
  'function addProduct(uint256 companyId, string name, string description, uint256 price, uint256 stock, string ipfsImageHash) returns (uint256)',
  'function getCompany(uint256 companyId) view returns (tuple(uint256 companyId, string name, address companyAddress, string taxId, bool isActive, address owner))',
  'function getCompanyIdByOwner(address owner) view returns (uint256)',
  'function getCompanyProductIds(uint256 companyId) view returns (uint256[])',
  'function getProduct(uint256 productId) view returns (tuple(uint256 productId, uint256 companyId, string name, string description, uint256 price, uint256 stock, string ipfsImageHash, bool isActive))',
  'function getCompanyInvoices(uint256 companyId) view returns (uint256[])',
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

export default function AdminPage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<bigint | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activeTab, setActiveTab] = useState<'products' | 'invoices'>('products');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Product form
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productStock, setProductStock] = useState('');

  const ecommerceAddress = process.env.NEXT_PUBLIC_ECOMMERCE_CONTRACT_ADDRESS;

  useEffect(() => {
    if (walletAddress && ecommerceAddress) {
      loadCompanyData();
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

  const loadCompanyData = async () => {
    if (!walletAddress || !ecommerceAddress) return;

    setIsLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum!);
      const contract = new ethers.Contract(ecommerceAddress, ECOMMERCE_ABI, provider);

      // Get company ID for this owner
      const cid = await contract.getCompanyIdByOwner(walletAddress);
      
      if (cid && cid > 0n) {
        setCompanyId(cid);
        
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
      }
    } catch (err) {
      console.error('Error loading company data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const registerCompany = async () => {
    if (!companyName || !taxId || !ecommerceAddress) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(ecommerceAddress, ECOMMERCE_ABI, signer);

      const tx = await contract.registerCompany(companyName, taxId);
      await tx.wait();

      setSuccess('Company registered successfully!');
      loadCompanyData();
    } catch (err) {
      console.error('Error registering company:', err);
      setError(err instanceof Error ? err.message : 'Failed to register company');
    } finally {
      setIsLoading(false);
    }
  };

  const addProduct = async () => {
    if (!productName || !productPrice || !productStock || !companyId || !ecommerceAddress) {
      setError('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(ecommerceAddress, ECOMMERCE_ABI, signer);

      // Price in cents (6 decimals)
      const priceInCents = Math.floor(parseFloat(productPrice) * 1000000);
      
      const tx = await contract.addProduct(
        companyId,
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
      loadCompanyData();
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

  if (!walletAddress) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Web Admin - Company Management</h1>
          <p className="text-gray-600 mb-6">Connect your wallet to manage your company</p>
          <button
            onClick={connectWallet}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
          >
            Connect MetaMask
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Web Admin - Company Management</h1>
          <div className="flex items-center gap-4">
            <span className="font-mono text-sm">{formatAddress(walletAddress)}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-600">{success}</p>
          </div>
        )}

        {!companyId ? (
          <div className="bg-white rounded-lg shadow p-6 max-w-md mx-auto">
            <h2 className="text-xl font-semibold mb-4">Register Your Company</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="My Store"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID</label>
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="A12345678"
                />
              </div>
              <button
                onClick={registerCompany}
                disabled={isLoading}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg"
              >
                {isLoading ? 'Registering...' : 'Register Company'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setActiveTab('products')}
                className={`px-4 py-2 rounded-lg ${activeTab === 'products' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
              >
                Products ({products.length})
              </button>
              <button
                onClick={() => setActiveTab('invoices')}
                className={`px-4 py-2 rounded-lg ${activeTab === 'invoices' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
              >
                Invoices ({invoices.length})
              </button>
            </div>

            {activeTab === 'products' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Add New Product</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                      <input
                        type="text"
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Price (EUR) *</label>
                      <input
                        type="text"
                        value={productPrice}
                        onChange={(e) => setProductPrice(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="9.99"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Stock *</label>
                      <input
                        type="number"
                        value={productStock}
                        onChange={(e) => setProductStock(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <input
                        type="text"
                        value={productDescription}
                        onChange={(e) => setProductDescription(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>
                  <button
                    onClick={addProduct}
                    disabled={isLoading}
                    className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-lg"
                  >
                    {isLoading ? 'Adding...' : 'Add Product'}
                  </button>
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {products.map((product) => (
                        <tr key={product.productId.toString()}>
                          <td className="px-6 py-4 whitespace-nowrap">{product.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap">€{formatPrice(product.price)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{product.stock.toString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${product.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {product.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'invoices' && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {invoices.map((invoice) => (
                      <tr key={invoice.invoiceId.toString()}>
                        <td className="px-6 py-4 whitespace-nowrap">{invoice.invoiceNumber}</td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">{formatAddress(invoice.customerAddress)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">€{formatPrice(invoice.totalAmount)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
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
