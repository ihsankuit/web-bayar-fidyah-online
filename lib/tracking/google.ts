/**
 * Server-side GA4 purchase event via the Measurement Protocol. Complements the
 * client-side gtag purchase (GA4 deduplicates by transaction_id). Fails soft.
 */
export interface Ga4PurchaseInput {
  transactionId: string;
  value: number; // Ringgit float
  currency?: string;
  clientId: string; // from the _ga cookie, or a fallback
}

export async function sendGa4Purchase(
  input: Ga4PurchaseInput
): Promise<boolean> {
  const measurementId = process.env.NEXT_PUBLIC_GA_ID;
  const apiSecret = process.env.GA_API_SECRET;
  if (!measurementId || !apiSecret) return false;

  const body = {
    client_id: input.clientId,
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: input.transactionId,
          currency: input.currency ?? "MYR",
          value: input.value,
        },
      },
    ],
  };

  try {
    const res = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );
    return res.ok;
  } catch (err) {
    console.error("[ga4-mp] Measurement Protocol request failed:", err);
    return false;
  }
}

/** Parse the GA client id (e.g. "1234567890.1234567890") from a _ga cookie. */
export function parseGaClientId(gaCookie: string | undefined): string | null {
  if (!gaCookie) return null;
  // Format: GA1.1.<clientId1>.<clientId2>
  const parts = gaCookie.split(".");
  if (parts.length >= 4) return `${parts[2]}.${parts[3]}`;
  return null;
}
