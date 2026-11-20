import { NextResponse } from "next/server";

import { isAuthorized, unauthorized } from "@/lib/api";
import { getLandingContent } from "@/lib/settings";
import { qadaYearsInfo } from "@/lib/ramadan";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/qada-years
 * The years a payer can choose for lewat qada' today, each with the
 * multiplier it carries now, plus when the next Ramadan flips them. Auth: API key.
 */
export async function GET(request: Request) {
  if (!(await isAuthorized(request))) return unauthorized();
  const content = await getLandingContent();
  return NextResponse.json({
    data: qadaYearsInfo(new Date(), content.fidyah_rate_sen),
  });
}
