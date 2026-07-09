import crypto from "crypto";

/**
 * Minimal CHIP Collect API client.
 * Docs: https://docs.chip-in.asia/chip-collect/overview/introduction
 *
 * Authentication uses a Bearer token (the secret API key). Purchase callbacks
 * are verified with an RSA-SHA256 signature in the `X-Signature` header,
 * checked against the company public key from `GET /public_key/`.
 */

const CHIP_BASE_URL = (
  process.env.CHIP_BASE_URL ?? "https://gate.chip-in.asia/api/v1"
).replace(/\/+$/, "");

interface CreatePurchaseParams {
  email: string;
  name: string;
  phone?: string;
  amountSen: number;
  description: string;
  successCallbackUrl: string;
  successRedirectUrl: string;
  failureRedirectUrl: string;
  reference: string;
}

export interface ChipPurchase {
  id: string;
  status: string;
  reference: string;
  checkout_url: string;
}

function authHeader(): string {
  const key = process.env.CHIP_API_KEY;
  if (!key) throw new Error("Missing CHIP_API_KEY environment variable.");
  return `Bearer ${key}`;
}

function brandId(): string {
  const id = process.env.CHIP_BRAND_ID;
  if (!id) throw new Error("Missing CHIP_BRAND_ID environment variable.");
  return id;
}

export async function createPurchase(
  params: CreatePurchaseParams
): Promise<ChipPurchase> {
  const body = {
    brand_id: brandId(),
    client: {
      email: params.email,
      full_name: params.name,
      phone: params.phone || undefined,
    },
    purchase: {
      currency: "MYR",
      products: [
        {
          name: params.description,
          price: params.amountSen,
          quantity: 1,
        },
      ],
    },
    reference: params.reference,
    send_receipt: false,
    success_callback: params.successCallbackUrl,
    success_redirect: params.successRedirectUrl,
    failure_redirect: params.failureRedirectUrl,
  };

  const res = await fetch(`${CHIP_BASE_URL}/purchases/`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CHIP create purchase failed (${res.status}): ${text}`);
  }

  return (await res.json()) as ChipPurchase;
}

export async function getPurchase(id: string): Promise<ChipPurchase> {
  const res = await fetch(`${CHIP_BASE_URL}/purchases/${id}/`, {
    headers: { Authorization: authHeader() },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CHIP get purchase failed (${res.status}): ${text}`);
  }
  return (await res.json()) as ChipPurchase;
}

// The company public key rarely rotates, so it's cached in memory across
// requests. `forceRefresh` lets a failed verification retry once against a
// freshly fetched key before rejecting the signature.
let cachedPublicKey: string | null = null;

export async function getPublicKey(forceRefresh = false): Promise<string> {
  if (cachedPublicKey && !forceRefresh) return cachedPublicKey;

  const res = await fetch(`${CHIP_BASE_URL}/public_key/`, {
    headers: { Authorization: authHeader() },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CHIP get public key failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { public_key: string };
  cachedPublicKey = data.public_key;
  return cachedPublicKey;
}

/**
 * Verify a CHIP purchase callback's `X-Signature` header: a base64-encoded
 * RSA-SHA256 signature of the raw request body, checked against the company
 * public key.
 */
export function verifySignature(
  rawBody: string,
  signature: string | null | undefined,
  publicKey: string
): boolean {
  if (!signature) return false;
  try {
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(rawBody);
    verifier.end();
    return verifier.verify(publicKey, signature, "base64");
  } catch {
    return false;
  }
}
