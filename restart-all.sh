#!/bin/bash

# Blockchain E-Commerce Deployment Script
# This script starts all services for local development

set -e

echo "========================================="
echo "Starting Blockchain E-Commerce System"
echo "========================================="

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

# Get Anvil account private key (first account)
export PRIVATE_KEY=$(anvil --accounts 10 --chain-id 31337 2>/dev/null | grep "Private Key" | head -1 | awk '{print $3}')

echo "Deploying EuroToken..."
cd stablecoin/sc
forge script script/DeployEuroToken.s.sol --rpc-url http://localhost:8545 --broadcast --private-key $PRIVATE_KEY

# Get EuroToken address
EURO_TOKEN_ADDRESS=$(grep -A5 "EuroToken deployed to:" ~/.foundry/cache/latest/solc-images/*.json 2>/dev/null | grep "0x" | head -1 || echo "0x0000000000000000000000000000000000000000")

if [ -z "$EURO_TOKEN_ADDRESS" ]; then
    # Fallback: read from last broadcast output
    EURO_TOKEN_ADDRESS=$(cat broadcast/DeployEuroToken.s.sol/*/run-latest.json 2>/dev/null | grep -o '"address":"0x[^"]*"' | head -1 | cut -d'"' -f4)
fi

echo "EuroToken deployed at: $EURO_TOKEN_ADDRESS"

# Deploy E-commerce contract
echo "Deploying E-commerce contract..."
cd ../../sc-ecommerce
forge script script/DeployEcommerce.s.sol --rpc-url http://localhost:8545 --broadcast --private-key $PRIVATE_KEY --env EUROTOKEN_ADDRESS=$EURO_TOKEN_ADDRESS

# Get E-commerce address
ECOMMERCE_ADDRESS=$(cat broadcast/DeployEcommerce.s.sol/*/run-latest.json 2>/dev/null | grep -o '"address":"0x[^"]*"' | head -1 | cut -d'"' -f4)
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

# Update purchase app
echo "NEXT_PUBLIC_EUROTOKEN_CONTRACT_ADDRESS=$EURO_TOKEN_ADDRESS" > ../stablecoin/compra-stablecoin/.env.local
echo "STRIPE_SECRET_KEY=sk_test_placeholder" >> ../stablecoin/compra-stablecoin/.env.local
echo "STRIPE_WEBHOOK_SECRET=whsec_placeholder" >> ../stablecoin/compra-stablecoin/.env.local
echo "WALLET_PRIVATE_KEY=$PRIVATE_KEY" >> ../stablecoin/compra-stablecoin/.env.local

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
