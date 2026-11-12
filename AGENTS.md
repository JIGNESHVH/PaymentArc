# ArcPay Development Guidelines

Scan any UPI QR and pay it from a stablecoin wallet with no gas; the merchant receives ordinary INR on Arc Network.

## Commands

| Project | Run | Test |
|---|---|---|
| `services/api-node` | `npm run dev` | `npm test` |
| `apps/web` | `npm run dev` | `npm test` |
| `contracts` | | `forge test` |

## How a payment flows

```
Wallet --quote/offramp--> services/api-node --paymaster tx--> ArcPayVault (locks tokens)
                               | matches lock to private quote
                               | triggers fiat settlement, settler completes payment
```

1. `POST /quote` validates the QR, signs `hashIntent` as quote signer, and stores `qrText` and `salt` privately. On-chain, only `qrCommitment = keccak256(abi.encode(salt, qrText))` appears.
2. The user signs the intent and a permit, and `POST /offramp` relays them, so the user pays no gas.
3. The vault locks tokens, fiat payout moves to the merchant, and funds are held through the dispute window before release.
