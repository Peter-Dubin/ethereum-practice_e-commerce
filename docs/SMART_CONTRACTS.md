# Smart Contracts Documentation

This section explores the underlying EVM structure powering the e-commerce platform. The system operates locally through a deployment on Anvil using Foundry.

## 1. Ecommerce.sol
**Location:** `sc-ecommerce/src/Ecommerce.sol`

This is the main state machine that bridges Customer flows and Merchant workflows.

### Key Roles
- **Owner**: Initially deploys the contract and assigns the `EuroToken` address.
- **Merchant**: Registers a company, manages its active status, and binds new inventory/products to their registered company ID.
- **Customer**: Appends products to an isolated mapping mapping to their wallet (the Cart) and transforms that Cart into a formal, binding Invoice.

### Core Functions
- **Company Management**:
  - `registerCompany(name, description)`: Onboards a new merchant entity.
  - `updateCompany(...)`: Modifies the existing profile details of a merchant.
- **Inventory Control**:
  - `addProduct(companyId, name, desc, price, stock, ipfs)`: Sets a new trackable product and its corresponding unit pricing.
  - `updateProduct(...)`: Changes stock levels or soft-deletes a product if unavailable.
- **Financial Mapping (Cart & Checkout)**:
  - `addToCart(productId, quantity)`: Modifies a user's `carts` mapping, caching price limits. Calculates aggregate totals synchronously.
  - `createInvoice(companyId)`: Destroys the cart, subtracts exact availability from inventory levels recursively, and outputs an open (unpaid) Invoice block.
  - `processPayment(...) / processDirectPayment(...)`: Communicates with `EuroToken`, demanding immediate internal transfer logic. Approves final invoice payout securely ensuring zero double-spends.

---

## 2. EuroToken.sol
**Location:** `stablecoin/sc/src/EuroToken.sol`

A regulated and simplistic wrapper extending OpenZeppelin's `ERC20`.

### Pegging & Decimals Configuration
- **Value**: Softly regulated by external services (fiat to crypto gateways via Stripe). Pegged exactly 1:1 with EUR.
- **Decimals**: O (Zero). Smallest unit represents exactly 1 EUR to simplify off-chain accounting matrices inherently avoiding fractional floats in pricing schemas. *(Example: A token balance of `150` strictly represents 150 Euros).*
- **Initial Supply**: Seeded with 1,000,000 pre-mined tokens directed to the deployer. 

### Core Functions
- `mint(to, amount)`: Only actionable sequentially by the `Owner` account. Represents fiat flowing into the treasury matching minted tokens injected into circulation dynamically.
- `burn(amount)`: Triggers deflationary balancing mechanisms if fiat withdrawals process successfully.

### System Events
The token emits standardized event logs extending raw generic ERC20 notifications:
  - `TokensMinted(account, integerAmount)`
  - `TokensBurned(account, integerAmount)`
