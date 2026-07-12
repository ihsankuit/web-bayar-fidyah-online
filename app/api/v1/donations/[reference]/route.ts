import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorized, unauthorized, serializeDonation } from "@/lib/api";
import type { Donation } from "@/lib/database.types";

/**
 * GET /api/v1/donations/[reference]
 * Fetch a single donation by its reference. Auth: API key.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  if (!isAuthorized(request)) return unauthorized();

  const { reference } = await params;

  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("donations")
      .select("*")
      .eq("reference", reference)
      .maybeSingle<Donation>();

    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ data: serializeDonation(data) });
  } catch (err) {
    console.error("[api/v1/donations/:reference]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
