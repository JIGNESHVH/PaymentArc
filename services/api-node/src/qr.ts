export interface ParsedQr {
  ok: boolean;
  upiId?: string;
  payeeName?: string | null;
  amountPaise?: number | null;
  error?: string;
}

const VPA_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z0-9]{2,64}$/;
const AMOUNT_RE = /^(\d+)(?:\.(\d{1,2}))?$/;
const MAX_QR_BYTES = 512;

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

export function parseUpiQr(raw: string, expectedPaise?: number): ParsedQr {
  const text = raw.trim();
  if (!text) return { ok: false, error: "QR code is empty" };

  const byteLength = new TextEncoder().encode(raw).length;
  if (byteLength > MAX_QR_BYTES) {
    return { ok: false, error: `QR length exceeds ${MAX_QR_BYTES} bytes` };
  }

  const match = /^upi:\/\/pay\?(.*)$/is.exec(text);
  if (!match) {
    return { ok: false, error: "Not a valid upi://pay URI" };
  }

  const params = new Map<string, string>();
  for (const part of match[1].split("&")) {
    if (!part) continue;
    const index = part.indexOf("=");
    const key = (index < 0 ? part : part.slice(0, index)).toLowerCase();
    if (!params.has(key)) {
      params.set(key, index < 0 ? "" : decodeParam(part.slice(index + 1)));
    }
  }

  const upiId = params.get("pa");
  if (!upiId || !VPA_RE.test(upiId)) {
    return { ok: false, error: "Invalid UPI VPA address" };
  }

  const currency = params.get("cu");
  if (currency && currency.toUpperCase() !== "INR") {
    return { ok: false, error: "Only INR payments are supported" };
  }

  let amountPaise: number | null = null;
  const am = params.get("am");
  if (am) {
    const amMatch = AMOUNT_RE.exec(am);
    if (!amMatch) {
      return { ok: false, error: "Invalid amount in QR code" };
    }
    const rupees = parseInt(amMatch[1], 10);
    const paisePart = (amMatch[2] ?? "").padEnd(2, "0").slice(0, 2);
    const paise = paisePart ? parseInt(paisePart, 10) : 0;
    amountPaise = rupees * 100 + paise;

    if (expectedPaise !== undefined && amountPaise !== expectedPaise) {
      return { ok: false, error: `QR amount ₹${amountPaise / 100} does not match quoted ₹${expectedPaise / 100}` };
    }
  }

  const payeeName = params.get("pn") || null;

  return {
    ok: true,
    upiId,
    payeeName,
    amountPaise,
  };
}
