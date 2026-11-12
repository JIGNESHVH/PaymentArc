import dotenv from "dotenv";
import { type Address, getAddress } from "viem";
import { type ChainConfig } from "./types.js";

dotenv.config();

export const PORT = Number(process.env.PORT || 8788);
export const HOST = process.env.HOST || "0.0.0.0";
export const VIEW_TOKEN_SECRET = process.env.VIEW_TOKEN_SECRET || "default-secret-paymentarc-change-me";

// Private keys for the roles (default to demo/test key if not provided in env)
export const QUOTE_SIGNER_KEY = (process.env.QUOTE_SIGNER_PRIVATE_KEY ||
  process.env.PRIVATE_KEY ||
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80") as `0x${string}`;

export const PAYMASTER_KEY = (process.env.PAYMASTER_PRIVATE_KEY ||
  QUOTE_SIGNER_KEY) as `0x${string}`;

export const SETTLER_KEY = (process.env.SETTLER_PRIVATE_KEY ||
  QUOTE_SIGNER_KEY) as `0x${string}`;

export const LIMITS = {
  minInrPaise: "10000",        // ₹100
  maxInrPaise: "10000000",     // ₹100,000
  dailyUserInrPaise: "20000000", // ₹200,000
  spreadBps: 100,              // 1%
  quoteTtlSec: 90,             // 90 seconds
};

export const CHAINS: Record<string, ChainConfig> = {
  "arc-testnet": {
    chainId: 5042002,
    name: "Arc Testnet",
    rpc: process.env.ARC_TESTNET_RPC || "https://rpc.testnet.arc.io",
    explorer: "https://explorer.testnet.arc.io",
    vault: getAddress("0x878734374e6131fceeeb83fa8605ab49f4d21836"),
    token: {
      symbol: "USDC",
      address: getAddress("0x3600000000000000000000000000000000000000"),
      decimals: 6,
      permitName: "USDC",
      permitVersion: "2",
    },
    vaultDomain: {
      name: "ArcPayVault",
      version: "1",
      chainId: 5042002,
      verifyingContract: getAddress("0x878734374e6131fceeeb83fa8605ab49f4d21836"),
    },
    types: {
      OfframpIntent: [
        { name: "id", type: "bytes32" },
        { name: "user", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "inrPaise", type: "uint64" },
        { name: "rateE6", type: "uint64" },
        { name: "qrCommitment", type: "bytes32" },
        { name: "deadline", type: "uint64" },
      ],
      DisputeIntent: [
        { name: "id", type: "bytes32" },
        { name: "user", type: "address" },
        { name: "deadline", type: "uint64" },
      ],
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
  },
  "arc-mainnet": {
    chainId: 5042,
    name: "Arc Mainnet",
    rpc: process.env.ARC_MAINNET_RPC || "https://rpc.arc.io",
    explorer: "https://explorer.arc.io",
    vault: getAddress("0xa140978374AAE1637b927C568E584e8fBB9a7cb0"),
    token: {
      symbol: "USDC",
      address: getAddress("0x3600000000000000000000000000000000000000"),
      decimals: 6,
      permitName: "USDC",
      permitVersion: "2",
    },
    vaultDomain: {
      name: "ArcPayVault",
      version: "1",
      chainId: 5042,
      verifyingContract: getAddress("0xa140978374AAE1637b927C568E584e8fBB9a7cb0"),
    },
    types: {
      OfframpIntent: [
        { name: "id", type: "bytes32" },
        { name: "user", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "inrPaise", type: "uint64" },
        { name: "rateE6", type: "uint64" },
        { name: "qrCommitment", type: "bytes32" },
        { name: "deadline", type: "uint64" },
      ],
      DisputeIntent: [
        { name: "id", type: "bytes32" },
        { name: "user", type: "address" },
        { name: "deadline", type: "uint64" },
      ],
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
  },
  "whitechain-sepolia": {
    chainId: 1874,
    name: "Whitechain Sepolia",
    rpc: process.env.WHITECHAIN_RPC || "https://rpc.testnet.whitechain.io",
    explorer: "https://explorer.testnet.whitechain.io",
    vault: getAddress("0x326fa638bc40ebb605bedb86b990e8d3da4765c1"),
    token: {
      symbol: "USDT",
      address: getAddress("0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7"),
      decimals: 6,
      permitName: "Tether USD",
      permitVersion: "1",
    },
    vaultDomain: {
      name: "ArcPayVault",
      version: "1",
      chainId: 1874,
      verifyingContract: getAddress("0x326fa638bc40ebb605bedb86b990e8d3da4765c1"),
    },
    types: {
      OfframpIntent: [
        { name: "id", type: "bytes32" },
        { name: "user", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "inrPaise", type: "uint64" },
        { name: "rateE6", type: "uint64" },
        { name: "qrCommitment", type: "bytes32" },
        { name: "deadline", type: "uint64" },
      ],
      DisputeIntent: [
        { name: "id", type: "bytes32" },
        { name: "user", type: "address" },
        { name: "deadline", type: "uint64" },
      ],
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
  },
};
