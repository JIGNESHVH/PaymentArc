import { type Address, type Hex } from "viem";

export type ChainKey = "arc-testnet" | "arc-mainnet" | "whitechain-sepolia" | string;

export interface TokenConfig {
  symbol: string;
  address: Address;
  decimals: number;
  permitName?: string;
  permitVersion?: string;
}

export interface ChainConfig {
  chainId: number;
  name: string;
  rpc: string;
  explorer: string;
  vault: Address;
  token: TokenConfig;
  vaultDomain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: Address;
  };
  types: Record<string, { name: string; type: string }[]>;
}

export interface OfframpIntent {
  id: Hex;
  user: Address;
  amount: bigint;
  inrPaise: bigint;
  rateE6: bigint;
  qrCommitment: Hex;
  deadline: bigint;
}

export interface PermitSig {
  deadline: bigint;
  v: number;
  r: Hex;
  s: Hex;
}

export interface StoredQuote {
  id: Hex;
  chain: string;
  user: Address;
  amount: string; // decimal string
  inrPaise: number;
  rateE6: string;
  qrText: string;
  salt: Hex;
  qrCommitment: Hex;
  deadline: number;
  quoteSig: Hex;
  upiId?: string;
  payeeName?: string | null;
  status: "QUOTED" | "SUBMITTED" | "USED";
  viewToken: string;
  createdAt: number;
  usedAt?: number;
  offrampTx?: Hex;
}

export interface OfframpRecord {
  id: Hex;
  chain: string;
  user: Address;
  amount: string;
  inrPaise: number;
  status: "LOCKED" | "COMPLETED" | "DISPUTED" | "RELEASED" | "REFUNDED" | "REVERSED";
  payout: "NONE" | "DISPATCHING" | "DISPATCHED" | "FAILED" | "SKIPPED";
  payeeUpiId?: string;
  payeeName?: string | null;
  lockTx?: Hex;
  completeTx?: Hex;
  disputeTx?: Hex;
  finalTx?: Hex;
  createdAt: number;
  completedAt?: number;
  disputedAt?: number;
  disputeDeadline?: number;
  releasableAt?: number;
  reclaimableAt?: number;
  refundReason?: number;
}

export interface OnrampRecord {
  orderId: string;
  chain: string;
  wallet: Address;
  inrPaise: string;
  amount: string;
  amountBaseUnits: string;
  symbol: string;
  rate: string;
  payTo: { upiId: string; note: string } | null;
  checkout: { provider: "razorpay"; url: string; linkId: string; expiresAt: string; paymentId: string | null } | null;
  status: "AWAITING_FIAT" | "PAYING" | "PAID" | "FAILED";
  paidTx: string | null;
  explorer: string | null;
  lastError: string | null;
  createdAt: number;
}
