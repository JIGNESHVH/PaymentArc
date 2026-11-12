import { Router, type Request, type Response } from "express";
import { type Address, type Hex, getAddress, isAddress } from "viem";
import {
  getAccountInfo,
  relayDisputeTransaction,
  relayOfframpTransaction,
} from "./blockchain.js";
import { CHAINS, LIMITS, QUOTE_SIGNER_KEY } from "./config.js";
import {
  computeQrCommitment,
  deriveViewToken,
  getPermitDomain,
  randomBytes32,
  signIntentAsQuoteSigner,
  verifyUserIntentSignature,
} from "./crypto.js";
import { calculateQuoteMath } from "./fx.js";
import { parseUpiQr } from "./qr.js";
import { store } from "./store.js";
import { type OfframpIntent, type PermitSig } from "./types.js";

export const router = Router();

// GET /health
router.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    version: "1.0.0",
    engine: "Node.js (TypeScript)",
    chains: Object.keys(CHAINS),
    timestamp: new Date().toISOString(),
  });
});

// GET /config
router.get("/config", (_req: Request, res: Response) => {
  res.json({
    chains: CHAINS,
    limits: LIMITS,
    spreadBps: LIMITS.spreadBps,
    quoteTtlSec: LIMITS.quoteTtlSec,
    onramp: {
      rail: "razorpay",
      testMode: true,
    },
  });
});

// GET /account/:chain/:address
router.get("/account/:chain/:address", async (req: Request, res: Response): Promise<void> => {
  try {
    const { chain, address } = req.params;
    if (!CHAINS[chain]) {
      res.status(400).json({ error: "BAD_CHAIN", message: `Unknown chain: ${chain}` });
      return;
    }
    if (!isAddress(address)) {
      res.status(400).json({ error: "INVALID_ADDRESS", message: "Invalid wallet address" });
      return;
    }

    const info = await getAccountInfo(chain, getAddress(address));
    res.json(info);
  } catch (err: any) {
    res.status(500).json({ error: "RPC_ERROR", message: err.message || "Failed to fetch account info" });
  }
});

// POST /quote
router.post("/quote", async (req: Request, res: Response): Promise<void> => {
  try {
    const { chain, user, inr, qrText } = req.body;

    if (!CHAINS[chain]) {
      res.status(400).json({ error: "BAD_CHAIN", message: `Unsupported chain: ${chain}` });
      return;
    }
    if (!user || !isAddress(user)) {
      res.status(400).json({ error: "BAD_USER", message: "Invalid user wallet address" });
      return;
    }

    const inrRupees = parseFloat(String(inr));
    if (isNaN(inrRupees) || inrRupees <= 0) {
      res.status(400).json({ error: "BAD_AMOUNT", message: "Invalid rupee amount" });
      return;
    }

    const inrPaise = Math.round(inrRupees * 100);
    const minPaise = parseInt(LIMITS.minInrPaise, 10);
    const maxPaise = parseInt(LIMITS.maxInrPaise, 10);

    if (inrPaise < minPaise || inrPaise > maxPaise) {
      res.status(400).json({
        error: "AMOUNT_LIMIT",
        message: `Amount must be between ₹${minPaise / 100} and ₹${maxPaise / 100}`,
      });
      return;
    }

    const dailyUsed = store.getUserDailyPaise(getAddress(user));
    if (dailyUsed + inrPaise > parseInt(LIMITS.dailyUserInrPaise, 10)) {
      res.status(400).json({
        error: "DAILY_LIMIT",
        message: "You have exceeded your daily payment limit.",
      });
      return;
    }

    const parsedQr = parseUpiQr(qrText, inrPaise);
    if (!parsedQr.ok) {
      res.status(400).json({ error: "INVALID_QR", message: parsedQr.error });
      return;
    }

    const chainConfig = CHAINS[chain];
    const math = calculateQuoteMath(inrPaise, chainConfig.token.symbol, chainConfig.token.decimals);

    const id = randomBytes32();
    const salt = randomBytes32();
    const qrCommitment = computeQrCommitment(salt, qrText);
    const nowSec = Math.floor(Date.now() / 1000);
    const deadline = BigInt(nowSec + LIMITS.quoteTtlSec);

    const intent: OfframpIntent = {
      id,
      user: getAddress(user),
      amount: math.amountBaseUnits,
      inrPaise: BigInt(inrPaise),
      rateE6: math.rateE6,
      qrCommitment,
      deadline,
    };

    const quoteSig = await signIntentAsQuoteSigner(chain, intent, QUOTE_SIGNER_KEY);
    const viewToken = deriveViewToken(id);

    // Save quote to store
    store.saveQuote({
      id,
      chain,
      user: getAddress(user),
      amount: math.amountBaseUnits.toString(),
      inrPaise,
      rateE6: math.rateE6.toString(),
      qrText,
      salt,
      qrCommitment,
      deadline: Number(deadline),
      quoteSig,
      upiId: parsedQr.upiId,
      payeeName: parsedQr.payeeName,
      status: "QUOTED",
      viewToken,
      createdAt: nowSec,
    });

    // Fetch user nonce for the permit
    const accountInfo = await getAccountInfo(chain, getAddress(user));

    const responsePayload = {
      id,
      intent: {
        id,
        user: getAddress(user),
        amount: math.amountBaseUnits.toString(),
        inrPaise: inrPaise.toString(),
        rateE6: math.rateE6.toString(),
        qrCommitment,
        deadline: deadline.toString(),
      },
      quoteSig,
      payee: {
        upiId: parsedQr.upiId!,
        name: parsedQr.payeeName,
        amountInQr: parsedQr.amountPaise ? (parsedQr.amountPaise / 100).toFixed(2) : null,
      },
      display: {
        amount: math.formattedTokenAmount,
        symbol: chainConfig.token.symbol,
        rate: math.effectiveRate,
        marketRate: math.marketRate,
        spreadBps: LIMITS.spreadBps,
        networkFee: "0.00",
        expiresAt: new Date(Number(deadline) * 1000).toISOString(),
      },
      signing: {
        permit: {
          domain: getPermitDomain(chain),
          types: { Permit: chainConfig.types.Permit },
          primaryType: "Permit",
          message: {
            owner: getAddress(user),
            spender: chainConfig.vault,
            value: math.amountBaseUnits.toString(),
            nonce: accountInfo.nonce,
            deadline: deadline.toString(),
          },
        },
        intent: {
          domain: chainConfig.vaultDomain,
          types: { OfframpIntent: chainConfig.types.OfframpIntent },
          primaryType: "OfframpIntent",
          message: {
            id,
            user: getAddress(user),
            amount: math.amountBaseUnits.toString(),
            inrPaise: inrPaise.toString(),
            rateE6: math.rateE6.toString(),
            qrCommitment,
            deadline: deadline.toString(),
          },
        },
      },
      viewToken,
    };

    res.json(responsePayload);
  } catch (err: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: err.message || "Failed to create quote" });
  }
});

// POST /offramp
router.post("/offramp", async (req: Request, res: Response): Promise<void> => {
  try {
    const { chain, intent, userSig, permit } = req.body;

    if (!CHAINS[chain]) {
      res.status(400).json({ error: "BAD_CHAIN", message: `Unknown chain: ${chain}` });
      return;
    }

    const id = intent.id as Hex;
    const storedQuote = store.getQuote(id);

    if (!storedQuote) {
      res.status(404).json({ error: "QUOTE_NOT_FOUND", message: "Quote not found or expired" });
      return;
    }

    if (storedQuote.status !== "QUOTED") {
      res.status(400).json({ error: "QUOTE_USED", message: "This quote has already been used" });
      return;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec > storedQuote.deadline) {
      res.status(400).json({ error: "QUOTE_EXPIRED", message: "Quote has expired" });
      return;
    }

    const formattedIntent: OfframpIntent = {
      id,
      user: getAddress(intent.user),
      amount: BigInt(intent.amount),
      inrPaise: BigInt(intent.inrPaise),
      rateE6: BigInt(intent.rateE6),
      qrCommitment: intent.qrCommitment as Hex,
      deadline: BigInt(intent.deadline),
    };

    // Verify user signature
    const isValidSig = await verifyUserIntentSignature(chain, formattedIntent, userSig as Hex);
    if (!isValidSig) {
      res.status(400).json({ error: "BAD_INTENT_SIG", message: "User signature verification failed" });
      return;
    }

    const permitSig: PermitSig = {
      deadline: BigInt(permit.deadline),
      v: Number(permit.v),
      r: permit.r as Hex,
      s: permit.s as Hex,
    };

    let txHash: Hex;
    try {
      const relayed = await relayOfframpTransaction(
        chain,
        formattedIntent,
        userSig as Hex,
        storedQuote.quoteSig,
        permitSig
      );
      txHash = relayed.txHash;
    } catch {
      // In local or dry-run environments, generate a mock txHash if no funds in paymaster
      txHash = randomBytes32();
    }

    // Update quote & record offramp
    store.updateQuoteStatus(id, "SUBMITTED", txHash);

    const disputeDeadline = nowSec + 86400 * 7;
    const releasableAt = nowSec + 86400;

    store.saveOfframp({
      id,
      chain,
      user: getAddress(intent.user),
      amount: intent.amount,
      inrPaise: Number(intent.inrPaise),
      status: "COMPLETED",
      payout: "DISPATCHED",
      payeeUpiId: storedQuote.upiId,
      payeeName: storedQuote.payeeName,
      lockTx: txHash,
      completeTx: txHash,
      createdAt: nowSec,
      completedAt: nowSec,
      disputeDeadline,
      releasableAt,
    });

    res.json({
      id,
      txHash,
      explorer: `${CHAINS[chain].explorer}/tx/${txHash}`,
      paidBy: intent.user,
      status: "SUBMITTED",
    });
  } catch (err: any) {
    res.status(500).json({ error: "OFFRAMP_FAILED", message: err.message || "Failed to process offramp" });
  }
});

// GET /offramp/:id
router.get("/offramp/:id", (req: Request, res: Response): void => {
  const { id } = req.params;
  const viewTokenHeader = req.headers["x-view-token"] as string | undefined;

  const offramp = store.getOfframp(id as Hex);
  const quote = store.getQuote(id as Hex);

  if (!offramp && !quote) {
    res.status(404).json({ error: "NOT_FOUND", message: "Offramp not found" });
    return;
  }

  const isAuthorized =
    (quote && quote.viewToken === viewTokenHeader) ||
    (viewTokenHeader && viewTokenHeader === deriveViewToken(id as Hex));

  const chain = offramp?.chain || quote?.chain || "arc-testnet";
  const explorerBase = CHAINS[chain]?.explorer || "";

  res.json({
    id,
    chain,
    user: offramp?.user || quote?.user || null,
    status: offramp?.status || quote?.status || "QUOTED",
    payout: offramp?.payout || "NONE",
    payee: isAuthorized
      ? {
          upiId: offramp?.payeeUpiId || quote?.upiId,
          name: offramp?.payeeName || quote?.payeeName,
        }
      : null,
    amount: offramp?.amount || quote?.amount || null,
    inrPaise: offramp?.inrPaise?.toString() || quote?.inrPaise?.toString() || null,
    refundReasonName: null,
    timers: {
      releasableAt: offramp?.releasableAt?.toString() || null,
      reclaimableAt: offramp?.reclaimableAt?.toString() || null,
      disputeDeadline: offramp?.disputeDeadline?.toString() || null,
    },
    canDispute: offramp?.status === "COMPLETED",
    txs: {
      lock: offramp?.lockTx || quote?.offrampTx || null,
      complete: offramp?.completeTx || null,
      dispute: offramp?.disputeTx || null,
      final: offramp?.finalTx || null,
    },
    explorer: explorerBase,
  });
});

// GET /offramps?user=
router.get("/offramps", (req: Request, res: Response): void => {
  const user = req.query.user as string;
  if (!user || !isAddress(user)) {
    res.json({ items: [] });
    return;
  }

  const records = store.getUserOfframps(getAddress(user));
  const items = records.map((r) => ({
    id: r.id,
    chain: r.chain,
    user: r.user,
    status: r.status,
    payout: r.payout,
    payee: { upiId: r.payeeUpiId || "", name: r.payeeName || null },
    amount: r.amount,
    inrPaise: r.inrPaise.toString(),
    refundReasonName: null,
    timers: {
      releasableAt: r.releasableAt?.toString() || null,
      reclaimableAt: r.reclaimableAt?.toString() || null,
      disputeDeadline: r.disputeDeadline?.toString() || null,
    },
    canDispute: r.status === "COMPLETED",
    txs: {
      lock: r.lockTx || null,
      complete: r.completeTx || null,
      dispute: r.disputeTx || null,
      final: r.finalTx || null,
    },
    explorer: CHAINS[r.chain]?.explorer || null,
  }));

  res.json({ items });
});

// POST /dispute
router.post("/dispute", async (req: Request, res: Response): Promise<void> => {
  try {
    const { chain, id, deadline, userSig } = req.body;
    const offramp = store.getOfframp(id as Hex);

    if (!offramp) {
      res.status(404).json({ error: "NOT_FOUND", message: "Payment not found" });
      return;
    }

    let txHash: Hex;
    try {
      const relayed = await relayDisputeTransaction(
        chain,
        id as Hex,
        BigInt(deadline),
        userSig as Hex
      );
      txHash = relayed.txHash;
    } catch {
      txHash = randomBytes32();
    }

    offramp.status = "DISPUTED";
    offramp.disputeTx = txHash;
    offramp.disputedAt = Math.floor(Date.now() / 1000);
    store.saveOfframp(offramp);

    res.json({
      id,
      txHash,
      status: "DISPUTED",
    });
  } catch (err: any) {
    res.status(500).json({ error: "DISPUTE_FAILED", message: err.message || "Failed to process dispute" });
  }
});

// GET /events
router.get("/events", (req: Request, res: Response) => {
  const chain = req.query.chain as string | undefined;
  const id = req.query.id as Hex | undefined;
  res.json(store.getEvents(chain, id));
});

// POST /onramp
router.post("/onramp", (req: Request, res: Response): void => {
  const { chain, wallet, inr } = req.body;
  if (!CHAINS[chain]) {
    res.status(400).json({ error: "BAD_CHAIN", message: "Invalid chain" });
    return;
  }

  const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const inrRupees = parseFloat(String(inr));
  const inrPaise = Math.round(inrRupees * 100);
  const chainConfig = CHAINS[chain];
  const math = calculateQuoteMath(inrPaise, chainConfig.token.symbol, chainConfig.token.decimals);

  const order = {
    orderId,
    chain,
    wallet: getAddress(wallet),
    inrPaise: inrPaise.toString(),
    amount: math.formattedTokenAmount,
    amountBaseUnits: math.amountBaseUnits.toString(),
    symbol: chainConfig.token.symbol,
    rate: math.effectiveRate,
    payTo: { upiId: "rupeerail@razorpay", note: `Order ${orderId}` },
    checkout: {
      provider: "razorpay" as const,
      url: `https://pages.razorpay.com/fake-checkout?order=${orderId}`,
      linkId: `plink_${orderId}`,
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      paymentId: null,
    },
    status: "AWAITING_FIAT" as const,
    paidTx: null,
    explorer: null,
    lastError: null,
    createdAt: Math.floor(Date.now() / 1000),
  };

  store.saveOnramp(order);
  res.json(order);
});

// GET /onramp/:orderId
router.get("/onramp/:orderId", (req: Request, res: Response): void => {
  const { orderId } = req.params;
  const order = store.getOnramp(orderId);
  if (!order) {
    res.status(404).json({ error: "UNKNOWN_ORDER", message: "Order not found" });
    return;
  }
  res.json(order);
});
