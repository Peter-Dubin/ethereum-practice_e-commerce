#!/bin/bash

# Blockchain E-Commerce Deployment Script
# This script starts all services for local development

# Don't exit on errors - continue starting apps even if deployment has warnings
# set -e

# Setup Node.js version manager (nvm) if available
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" 2>/dev/null
# Use Node.js 20 if nvm is available
[ -s "$NVM_DIR/nvm.sh" ] && nvm use 20 >/dev/null 2>&1

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================="
echo "Starting Blockchain E-Commerce System"
echo "========================================="
echo "Working directory: $SCRIPT_DIR"

# Stop existing processes
echo "Stopping existing processes..."
pkill -f "anvil" 2>/dev/null || true
pkill -f "next" 2>/dev/null || true

# Wait for processes to stop
sleep 2

# Start Anvil (local blockchain)
echo "Starting Anvil blockchain..."
cd stablecoin/sc
anvil --accounts 10 --chain-id 31337 --host 0.0.0.0 &
ANVIL_PID=$!
sleep 3

# Get Anvil account private key (first account) - use default anvil key
export PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

echo "Deploying EuroToken..."
echo "Current directory: $(pwd)"
# Already in stablecoin/sc from line 27, no need to cd again
ls -la
forge script script/DeployEuroToken.s.sol --rpc-url http://localhost:8545 --broadcast --private-key $PRIVATE_KEY --skip-size-check

# Get EuroToken address from broadcast output
EURO_TOKEN_ADDRESS=$(cat broadcast/DeployEuroToken.s.sol/*/run-latest.json 2>/dev/null | grep -i '"contractAddress"' | head -1 | grep -o '0x[0-9a-fA-F]*' | head -1)

if [ -z "$EURO_TOKEN_ADDRESS" ]; then
    EURO_TOKEN_ADDRESS="0x0000000000000000000000000000000000000000"
fi

echo "EuroToken deployed at: $EURO_TOKEN_ADDRESS"

# Deploy E-commerce contract
echo "Deploying E-commerce contract..."
cd ../../sc-ecommerce
# Export the EuroToken address as an environment variable for the script
export EUROTOKEN_ADDRESS=$EURO_TOKEN_ADDRESS
forge script script/DeployEcommerce.s.sol --rpc-url http://localhost:8545 --broadcast --private-key $PRIVATE_KEY --skip-size-check

# Get E-commerce address
ECOMMERCE_ADDRESS=$(cat broadcast/DeployEcommerce.s.sol/*/run-latest.json 2>/dev/null | grep -i '"contractAddress"' | head -1 | grep -o '0x[0-9a-fA-F]*' | head -1)
echo "E-commerce deployed at: $ECOMMERCE_ADDRESS"

# Update environment files
echo "Updating environment files..."

# Update web-admin
echo "NEXT_PUBLIC_ECOMMERCE_CONTRACT_ADDRESS=$ECOMMERCE_ADDRESS" > ../web-admin/.env.local
echo "NEXT_PUBLIC_EUROTOKEN_CONTRACT_ADDRESS=$EURO_TOKEN_ADDRESS" >> ../web-admin/.env.local

# Update web-customer
echo "NEXT_PUBLIC_ECOMMERCE_CONTRACT_ADDRESS=$ECOMMERCE_ADDRESS" > ../web-customer/.env.local
echo "NEXT_PUBLIC_EUROTOKEN_CONTRACT_ADDRESS=$EURO_TOKEN_ADDRESS" >> ../web-customer/.env.local
echo "NEXT_PUBLIC_PAYMENT_GATEWAY_URL=http://localhost:6002" >> ../web-customer/.env.local

# Update payment gateway
echo "NEXT_PUBLIC_ECOMMERCE_CONTRACT_ADDRESS=$ECOMMERCE_ADDRESS" > ../stablecoin/pasarela-de-pago/.env.local
echo "NEXT_PUBLIC_EUROTOKEN_CONTRACT_ADDRESS=$EURO_TOKEN_ADDRESS" >> ../stablecoin/pasarela-de-pago/.env.local

# Update purchase app (preserve existing Stripe keys)
# Only update contract addresses, don't overwrite Stripe keys
if [ -f ../stablecoin/compra-stablecoin/.env.local ]; then
    # Update only the contract address and wallet private key, keep Stripe keys
    sed -i 's/^NEXT_PUBLIC_EUROTOKEN_CONTRACT_ADDRESS=.*/NEXT_PUBLIC_EUROTOKEN_CONTRACT_ADDRESS=$EURO_TOKEN_ADDRESS/' ../stablecoin/compra-stablecoin/.env.local 2>/dev/null || echo "NEXT_PUBLIC_EUROTOKEN_CONTRACT_ADDRESS=$EURO_TOKEN_ADDRESS" >> ../stablecoin/compra-stablecoin/.env.local
    sed -i 's/^WALLET_PRIVATE_KEY=.*/WALLET_PRIVATE_KEY=$PRIVATE_KEY/' ../stablecoin/compra-stablecoin/.env.local 2>/dev/null || echo "WALLET_PRIVATE_KEY=$PRIVATE_KEY" >> ../stablecoin/compra-stablecoin/.env.local
else
    # File doesn't exist, create it with all keys (first time setup)
    echo "NEXT_PUBLIC_EUROTOKEN_CONTRACT_ADDRESS=$EURO_TOKEN_ADDRESS" > ../stablecoin/compra-stablecoin/.env.local
    echo "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here" >> ../stablecoin/compra-stablecoin/.env.local
    echo "STRIPE_SECRET_KEY=sk_test_your_key_here" >> ../stablecoin/compra-stablecoin/.env.local
    echo "STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here" >> ../stablecoin/compra-stablecoin/.env.local
    echo "WALLET_PRIVATE_KEY=$PRIVATE_KEY" >> ../stablecoin/compra-stablecoin/.env.local
fi

# Start Next.js applications
echo "Starting Next.js applications..."

# Start Web Customer (port 6004)
cd ../web-customer
npm run dev -- -p 6004 &
CUSTOMER_PID=$!

# Start Web Admin (port 6003)
cd ../web-admin
npm run dev -- -p 6003 &
ADMIN_PID=$!

# Start Payment Gateway (port 6002)
cd ../stablecoin/pasarela-de-pago
npm run dev -- -p 6002 &
GATEWAY_PID=$!

# Start Purchase App (port 6001)
cd ../compra-stablecoin
npm run dev -- -p 6001 &
PURCHASE_PID=$!

echo ""
echo "========================================="
echo "All services started!"
echo "========================================="
echo ""
echo "Services:"
echo "  - Anvil:      http://localhost:8545"
echo "  - Purchase:   http://localhost:6001"
echo "  - Gateway:    http://localhost:6002"
echo "  - Admin:      http://localhost:6003"
echo "  - Customer:   http://localhost:6004"
echo ""
echo "Contract Addresses:"
echo "  - EuroToken:  $EURO_TOKEN_ADDRESS"
echo "  - Ecommerce:  $ECOMMERCE_ADDRESS"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for interrupt
trap "echo 'Stopping services...'; kill $ANVIL_PID $CUSTOMER_PID $ADMIN_PID $GATEWAY_PID $PURCHASE_PID 2>/dev/null; exit 0" INT TERM

wait
