# E-Commerce Web3 User Guide

This guide describes how to navigate the 4 primary Web interfaces of the Decentralized E-Commerce ecosystem.

## 1. Fiat to Crypto On-Ramp (Port `6001`)
**URL**: [http://localhost:6001](http://localhost:6001)

Before interacting with the marketplace, users must hold `EURT`, the recognized stablecoin of the blockchain.
1. Connect your MetaMask wallet.
2. Enter the amount of Euro you wish to convert into `EURT`. Since the peg is strictly 1:1, specifying "500" outputs exactly "500 EURT" to your corresponding active wallet.
3. Stripe handles the real-world fiat confirmation securely. Upon webhook verification, the Smart Contract dynamically mints the required volume into your custody immediately.

## 2. Customer Marketplace (Port `6004`)
**URL**: [http://localhost:6004](http://localhost:6004)

This portal constitutes the user-facing catalog mapping exactly to standard e-commerce implementations with a glass-morphic premium UI.
1. Connect via Web3 modal authentication.
2. **Browse:** Real-time synced inventory directly mirrors the `getProduct()` functions available via the master `Ecommerce` contract.
3. **Cart Assembly:** Add multi-store items into your cart. Validations secure correct inventory count matching to prevent stock failures.
4. **Checkout Processing:** Initiating checkout bundles cart contents. The underlying `createInvoice()` generates a signed invoice block that is locked until payment is verified.
5. The checkout completion securely redirects the customer directly to the strict Payment Gateway (`:6002`).

## 3. Web3 Payment Gateway (Port `6002`)
**URL**: [http://localhost:6002](http://localhost:6002)

This headless-oriented application bridges specific checkout actions seamlessly ensuring accurate token flows without exposing the entire storefront mechanism.
1. Upon redirection, this gateway analyzes the URL parameters representing `invoiceId`.
2. Reviews the final breakdown requirement against your current local `EURT` balance utilizing the internal `canAfford` contract checks.
3. Connect Wallet: Required uniquely if disconnected previously or traversing distinct environments.
4. "Pay with Crypto": Prompts MetaMask to request a specific token spending allowance matching the transaction precisely followed organically by the transaction execution command triggering `processDirectPayment()`.

## 4. Merchant Dashboard (Port `6003`)
**URL**: [http://localhost:6003](http://localhost:6003)

Protected administrator-style control interface enabling store ownership protocols efficiently.
1. **Wallet Login**: Sign in establishing owner tracking contexts. 
2. **Company Settings**: Use the portal to trigger `registerCompany()`. Define a name and description securely cementing wallet ownership locally.
3. **Product Inventory**: Upload IPFS pointers referencing images seamlessly and define standard fields (Name, Price in EURT, Total Stock available).
4. **Sales Tracking**: Summarizes paid and open invoices dynamically populated instantly as incoming customers interact with Port `6004`.
