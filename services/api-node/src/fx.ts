import { LIMITS } from "./config.js";

export interface FxRate {
  pair: string;
  bid: number; // INR per stablecoin
  ask: number;
  timestamp: number;
}

// In-memory cache for FX rates
const rateCache: Record<string, FxRate> = {
  USDCINR: { pair: "USDCINR", bid: 87.5, ask: 87.8, timestamp: Date.now() },
  USDTINR: { pair: "USDTINR", bid: 87.4, ask: 87.7, timestamp: Date.now() },
};

/**
 * Periodically update FX rates from public exchanges (CoinDCX / CoinGecko)
 */
export async function pollFxRates(): Promise<void> {
  try {
    const res = await fetch("https://api.coindcx.com/exchange/ticker");
    if (!res.ok) return;
    const tickers = (await res.json()) as Array<{ market: string; bid: string; ask: string }>;

    for (const t of tickers) {
      if (t.market === "USDCINR" || t.market === "USDTINR") {
        const bid = parseFloat(t.bid);
        const ask = parseFloat(t.ask);
        if (!isNaN(bid) && bid > 0) {
          rateCache[t.market] = {
            pair: t.market,
            bid,
            ask: isNaN(ask) ? bid : ask,
            timestamp: Date.now(),
          };
        }
      }
    }
  } catch {
    // Keep cached rates if offline or API error
  }
}

// Start poller every 30 seconds
setInterval(pollFxRates, 30_000);

export function getFxRate(symbol: string): FxRate {
  const pair = `${symbol.toUpperCase()}INR`;
  return rateCache[pair] || rateCache["USDCINR"];
}

export function calculateQuoteMath(inrPaise: number, symbol: string, decimals = 6) {
  const fx = getFxRate(symbol);
  const marketRate = fx.bid; // e.g. 87.50 INR per token
  const spreadBps = LIMITS.spreadBps; // 100 bps = 1%
  const effectiveRate = marketRate * (1 - spreadBps / 10000); // 86.625

  // rateE6 = rate * 1e6
  const rateE6 = BigInt(Math.round(effectiveRate * 1_000_000));

  // inrRupees = inrPaise / 100
  // tokenAmount = (inrRupees / effectiveRate) * 10^decimals
  const inrRupees = inrPaise / 100;
  const tokenFloat = inrRupees / effectiveRate;
  const amountBaseUnits = BigInt(Math.round(tokenFloat * 10 ** decimals));

  return {
    marketRate: marketRate.toFixed(2),
    effectiveRate: effectiveRate.toFixed(2),
    rateE6,
    amountBaseUnits,
    formattedTokenAmount: tokenFloat.toFixed(decimals > 2 ? 4 : 2),
    formattedInr: inrRupees.toFixed(2),
  };
}
