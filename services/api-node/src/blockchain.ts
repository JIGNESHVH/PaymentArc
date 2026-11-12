import {
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAINS, PAYMASTER_KEY } from "./config.js";
import { type OfframpIntent, type PermitSig } from "./types.js";

const ERC20_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function nonces(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

const VAULT_ABI = parseAbi([
  "function offramp((bytes32 id, address user, uint256 amount, uint64 inrPaise, uint64 rateE6, bytes32 qrCommitment, uint64 deadline) intent, bytes userSig, bytes quoteSig, (uint256 deadline, uint8 v, bytes32 r, bytes32 s) permitSig) external",
  "function disputeOfframpWithSig(bytes32 id, uint64 deadline, bytes userSig) external",
  "function completeOfframp(bytes32 id, bytes32 payoutRef) external",
  "function refundOfframp(bytes32 id, uint8 reason) external",
  "function releaseOfframp(bytes32 id) external",
]);

export function getPublicClient(chain: string) {
  const cfg = CHAINS[chain];
  if (!cfg) throw new Error(`Chain ${chain} not found`);

  const customChain = defineChain({
    id: cfg.chainId,
    name: cfg.name,
    nativeCurrency: { name: "GAS", symbol: "GAS", decimals: 18 },
    rpcUrls: {
      default: { http: [cfg.rpc] },
    },
  });

  return createPublicClient({
    chain: customChain,
    transport: http(cfg.rpc),
  });
}

export function getWalletClient(chain: string) {
  const cfg = CHAINS[chain];
  if (!cfg) throw new Error(`Chain ${chain} not found`);

  const account = privateKeyToAccount(PAYMASTER_KEY);
  const customChain = defineChain({
    id: cfg.chainId,
    name: cfg.name,
    nativeCurrency: { name: "GAS", symbol: "GAS", decimals: 18 },
    rpcUrls: {
      default: { http: [cfg.rpc] },
    },
  });

  return createWalletClient({
    account,
    chain: customChain,
    transport: http(cfg.rpc),
  });
}

export async function getAccountInfo(chain: string, user: Address) {
  const cfg = CHAINS[chain];
  if (!cfg) throw new Error(`Unknown chain: ${chain}`);

  const client = getPublicClient(chain);
  let balance = 0n;
  let allowance = 0n;
  let nonce = 0n;

  try {
    balance = await client.readContract({
      address: cfg.token.address,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [user],
    });
  } catch {
    // fallback 0
  }

  try {
    allowance = await client.readContract({
      address: cfg.token.address,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [user, cfg.vault],
    });
  } catch {
    // fallback 0
  }

  try {
    nonce = await client.readContract({
      address: cfg.token.address,
      abi: ERC20_ABI,
      functionName: "nonces",
      args: [user],
    });
  } catch {
    // fallback 0
  }

  const formatted = (Number(balance) / 10 ** cfg.token.decimals).toFixed(2);

  return {
    balance: balance.toString(),
    balanceFormatted: formatted,
    symbol: cfg.token.symbol,
    allowance: allowance.toString(),
    nonce: nonce.toString(),
  };
}

export async function relayOfframpTransaction(
  chain: string,
  intent: OfframpIntent,
  userSig: Hex,
  quoteSig: Hex,
  permitSig: PermitSig
): Promise<{ txHash: Hex }> {
  const cfg = CHAINS[chain];
  if (!cfg) throw new Error(`Unknown chain: ${chain}`);

  const wallet = getWalletClient(chain);

  const txHash = await wallet.writeContract({
    address: cfg.vault,
    abi: VAULT_ABI,
    functionName: "offramp",
    args: [
      {
        id: intent.id,
        user: intent.user,
        amount: intent.amount,
        inrPaise: intent.inrPaise,
        rateE6: intent.rateE6,
        qrCommitment: intent.qrCommitment,
        deadline: intent.deadline,
      },
      userSig,
      quoteSig,
      {
        deadline: permitSig.deadline,
        v: permitSig.v,
        r: permitSig.r,
        s: permitSig.s,
      },
    ],
  });

  return { txHash };
}

export async function relayDisputeTransaction(
  chain: string,
  id: Hex,
  deadline: bigint,
  userSig: Hex
): Promise<{ txHash: Hex }> {
  const cfg = CHAINS[chain];
  if (!cfg) throw new Error(`Unknown chain: ${chain}`);

  const wallet = getWalletClient(chain);

  const txHash = await wallet.writeContract({
    address: cfg.vault,
    abi: VAULT_ABI,
    functionName: "disputeOfframpWithSig",
    args: [id, deadline, userSig],
  });

  return { txHash };
}
