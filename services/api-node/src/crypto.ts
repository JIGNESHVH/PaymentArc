import crypto from "crypto";
import {
  type Address,
  type Hex,
  encodeAbiParameters,
  keccak256,
  recoverTypedDataAddress,
  toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAINS, VIEW_TOKEN_SECRET } from "./config.js";
import { type OfframpIntent, type PermitSig } from "./types.js";

export function randomBytes32(): Hex {
  return toHex(crypto.randomBytes(32));
}

/**
 * Commitment to the private salt & raw QR string:
 * qrCommitment = keccak256(abi.encode(bytes32 salt, string qrText))
 */
export function computeQrCommitment(salt: Hex, qrText: string): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "string" }],
      [salt, qrText]
    )
  );
}

/**
 * Generates an HMAC SHA-256 view token so that only the quote creator or payer can read the payee details
 */
export function deriveViewToken(id: Hex, secret = VIEW_TOKEN_SECRET): string {
  return crypto.createHmac("sha256", secret).update(id).digest("hex");
}

/**
 * Returns the EIP-712 domain for ScanPayVault on a chain
 */
export function getVaultDomain(chain: string) {
  const cfg = CHAINS[chain];
  if (!cfg) throw new Error(`Unknown chain: ${chain}`);
  return cfg.vaultDomain;
}

/**
 * Returns the EIP-712 permit domain for the ERC20 token on a chain
 */
export function getPermitDomain(chain: string) {
  const cfg = CHAINS[chain];
  if (!cfg) throw new Error(`Unknown chain: ${chain}`);
  return {
    name: cfg.token.permitName || cfg.token.symbol,
    version: cfg.token.permitVersion || "1",
    chainId: cfg.chainId,
    verifyingContract: cfg.token.address,
  };
}

/**
 * Sign OfframpIntent as the backend quoteSigner
 */
export async function signIntentAsQuoteSigner(
  chain: string,
  intent: OfframpIntent,
  privateKey: Hex
): Promise<Hex> {
  const account = privateKeyToAccount(privateKey);
  const domain = getVaultDomain(chain);

  return account.signTypedData({
    domain,
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
    },
    primaryType: "OfframpIntent",
    message: {
      id: intent.id,
      user: intent.user,
      amount: intent.amount,
      inrPaise: intent.inrPaise,
      rateE6: intent.rateE6,
      qrCommitment: intent.qrCommitment,
      deadline: intent.deadline,
    },
  });
}

/**
 * Verifies that the user signature matches the user's address for the OfframpIntent
 */
export async function verifyUserIntentSignature(
  chain: string,
  intent: OfframpIntent,
  signature: Hex
): Promise<boolean> {
  const domain = getVaultDomain(chain);
  try {
    const recovered = await recoverTypedDataAddress({
      domain,
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
      },
      primaryType: "OfframpIntent",
      message: {
        id: intent.id,
        user: intent.user,
        amount: intent.amount,
        inrPaise: intent.inrPaise,
        rateE6: intent.rateE6,
        qrCommitment: intent.qrCommitment,
        deadline: intent.deadline,
      },
      signature,
    });

    return recovered.toLowerCase() === intent.user.toLowerCase();
  } catch {
    return false;
  }
}
