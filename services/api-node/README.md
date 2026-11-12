# PaymentArc Node.js API Service

A modern, high-performance **Node.js + TypeScript** backend for **PaymentArc**, enabling gasless stablecoin (USDC/USDT) off-ramping to any UPI QR code in India with onchain escrow and dispute resolution on **Arc Network** and **Whitechain**.

Replaces the legacy Python backend with a native, unified TypeScript architecture.

## Features

- **Gasless Paymaster Relay**: Validates user EIP-712 signatures and relays transactions to `ScanPayVault.sol` without requiring the user to hold native gas tokens.
- **Quote Signing**: Calculates live exchange rates with configurable spreads, cryptographically commits to the UPI QR via salted keccak256 hashes, and co-signs EIP-712 intents.
- **Privacy Preservation**: Salt and raw UPI QR strings remain completely off-chain. View tokens safeguard merchant details.
- **Multi-Chain Support**: Arc Testnet (chain ID `5042002`), Arc Mainnet (chain ID `5042`), and Whitechain Sepolia (chain ID `1874`).
- **Unified TypeScript Stack**: Shares models and typing seamlessly with the frontend.

## Quickstart

```bash
cd services/api-node

# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Build for production
npm run build
npm start
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check & supported chains |
| `GET` | `/config` | Chain configurations, token addresses, limits, and EIP-712 domains |
| `GET` | `/account/:chain/:address` | Real-time token balance, nonces, and vault allowances |
| `POST` | `/quote` | Validates UPI QR, computes pricing, generates salt commitment, and returns EIP-712 payloads |
| `POST` | `/offramp` | Relays user intent, permit, and quote signatures gaslessly to the vault |
| `GET` | `/offramp/:id` | Status of escrow lock, timers, payouts, and merchant info (requires `x-view-token`) |
| `GET` | `/offramps?user=` | Historical offramps for a wallet address |
| `POST` | `/dispute` | Relays user dispute signature to pause vault payout during dispute window |
| `POST` | `/onramp` | Initiates fiat-to-stablecoin purchase |
| `GET` | `/onramp/:orderId` | Checks status of onramp fiat order |
