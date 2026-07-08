import crypto from "crypto";

/**
 * Minimal Billplz API v3 client.
 * Docs: https://www.billplz.com/api
 *
 * Authentication uses HTTP Basic auth with the secret API key as the username
 * and an empty password. Webhook/redirect payloads are verified with the
 * X-Signature key using HMAC-SHA256.
 */

const BILLPLZ_BASE_URL =
  process.env.BILLPLZ_SANDBOX === "true"
    ? "https://www.billplz-sandbox.com/api/v3"
    : "https://www.billplz.com/api/v3";

interface CreateBillParams {
  email: string;
  name: string;
  amountSen: number;
  description: string;
  callbackUrl: string;
  redirectUrl: string;
  reference?: string;
}

export interface BillplzBill {
  id: string;
  collection_id: string;
  paid: boolean;
  state: string;
  amount: number;
  email: string;
  name: string;
  url: string;
  reference_1?: string | null;
  paid_at?: string | null;
}

function authHeader(): string {
  const key = process.env.BILLPLZ_API_KEY;
  if (!key) throw new Error("Missing BILLPLZ_API_KEY environment variable.");
  return "Basic " + Buffer.from(`${key}:`).toString("base64");
}

export async function createBill(
  params: CreateBillParams
): Promise<BillplzBill> {
  const collectionId = process.env.BILLPLZ_COLLECTION_ID;
  if (!collectionId) {
    throw new Error("Missing BILLPLZ_COLLECTION_ID environment variable.");
  }

  const body = new URLSearchParams({
    collection_id: collectionId,
    email: params.email,
    name: params.name,
    amount: String(params.amountSen),
    description: params.description,
    callback_url: params.callbackUrl,
    redirect_url: params.redirectUrl,
    reference_1_label: "Rujukan",
    reference_1: params.reference ?? "",
  });

  const res = await fetch(`${BILLPLZ_BASE_URL}/bills`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Billplz create bill failed (${res.status}): ${text}`);
  }

  return (await res.json()) as BillplzBill;
}

export async function getBill(id: string): Promise<BillplzBill> {
  const res = await fetch(`${BILLPLZ_BASE_URL}/bills/${id}`, {
    headers: { Authorization: authHeader() },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Billplz get bill failed (${res.status}): ${text}`);
  }
  return (await res.json()) as BillplzBill;
}

/**
 * Verify a Billplz X-Signature.
 *
 * Billplz builds the source string by concatenating each `key + value` pair,
 * sorting alphabetically and joining with `|`, then HMAC-SHA256 with the
 * X-Signature key.
 *
 * - Redirect (GET): params arrive as `billplz[id]`, `billplz[paid]`,
 *   `billplz[paid_at]`. Pass keys { id, paid, paid_at } with prefix `"billplz"`.
 * - Callback (POST webhook): params are flat top-level fields. Pass them all
 *   (except `x_signature`) with an empty prefix.
 *
 * @param params     Key/value params (without `x_signature`).
 * @param signature  The received x_signature value.
 * @param prefix     Key prefix — `"billplz"` for redirect, `""` for callback.
 */
export function verifySignature(
  params: Record<string, string>,
  signature: string | null | undefined,
  prefix = ""
): boolean {
  const signatureKey = process.env.BILLPLZ_X_SIGNATURE_KEY;
  if (!signatureKey || !signature) return false;

  const source = Object.keys(params)
    .sort()
    .map((key) => `${prefix}${key}${params[key]}`)
    .join("|");

  const computed = crypto
    .createHmac("sha256", signatureKey)
    .update(source)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}
