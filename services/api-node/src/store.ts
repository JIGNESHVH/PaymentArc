import fs from "fs";
import path from "path";
import { type Address, type Hex } from "viem";
import { type OfframpRecord, type OnrampRecord, type StoredQuote } from "./types.js";

const DATA_DIR = path.resolve("./data");
const STORE_FILE = path.join(DATA_DIR, "store.json");

interface DatabaseSchema {
  quotes: Record<string, StoredQuote>;
  offramps: Record<string, OfframpRecord>;
  events: Array<any>;
  onrampOrders: Record<string, OnrampRecord>;
}

class Store {
  private data: DatabaseSchema = {
    quotes: {},
    offramps: {},
    events: [],
    onrampOrders: {},
  };

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(STORE_FILE)) {
        const raw = fs.readFileSync(STORE_FILE, "utf-8");
        this.data = JSON.parse(raw);
      }
    } catch {
      // fallback to empty
    }
  }

  private persist(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(STORE_FILE, JSON.stringify(this.data, null, 2), "utf-8");
    } catch {
      // non-blocking
    }
  }

  public saveQuote(quote: StoredQuote): void {
    this.data.quotes[quote.id.toLowerCase()] = quote;
    this.persist();
  }

  public getQuote(id: Hex): StoredQuote | undefined {
    return this.data.quotes[id.toLowerCase()];
  }

  public updateQuoteStatus(id: Hex, status: StoredQuote["status"], txHash?: Hex): void {
    const q = this.getQuote(id);
    if (q) {
      q.status = status;
      if (status === "USED" || status === "SUBMITTED") {
        q.usedAt = Math.floor(Date.now() / 1000);
      }
      if (txHash) {
        q.offrampTx = txHash;
      }
      this.persist();
    }
  }

  public getUserQuotes(user: Address): StoredQuote[] {
    const u = user.toLowerCase();
    return Object.values(this.data.quotes).filter(
      (q) => q.user.toLowerCase() === u
    );
  }

  public getUserDailyPaise(user: Address): number {
    const u = user.toLowerCase();
    const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;
    return Object.values(this.data.quotes)
      .filter((q) => q.user.toLowerCase() === u && q.createdAt > oneDayAgo && q.status !== "QUOTED")
      .reduce((sum, q) => sum + q.inrPaise, 0);
  }

  public saveOfframp(record: OfframpRecord): void {
    this.data.offramps[record.id.toLowerCase()] = record;
    this.persist();
  }

  public getOfframp(id: Hex): OfframpRecord | undefined {
    return this.data.offramps[id.toLowerCase()];
  }

  public getUserOfframps(user: Address): OfframpRecord[] {
    const u = user.toLowerCase();
    return Object.values(this.data.offramps)
      .filter((o) => o.user.toLowerCase() === u)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  public saveOnramp(order: OnrampRecord): void {
    this.data.onrampOrders[order.orderId] = order;
    this.persist();
  }

  public getOnramp(orderId: string): OnrampRecord | undefined {
    return this.data.onrampOrders[orderId];
  }

  public addEvent(event: any): void {
    this.data.events.unshift(event);
    if (this.data.events.length > 500) {
      this.data.events.pop();
    }
    this.persist();
  }

  public getEvents(chain?: string, id?: Hex): any[] {
    return this.data.events.filter((e) => {
      if (chain && e.chain !== chain) return false;
      if (id && e.id?.toLowerCase() !== id.toLowerCase()) return false;
      return true;
    });
  }
}

export const store = new Store();
