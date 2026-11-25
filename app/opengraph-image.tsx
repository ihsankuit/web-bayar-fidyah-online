import { ImageResponse } from "next/og";

import {
  RECEIPT_LOGO_ASPECT,
  RECEIPT_LOGO_PNG_BASE64,
} from "@/lib/receipt-logo";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The share image shown when the site is linked in WhatsApp, Facebook, X and
 * so on. Brand blue with the Ihsanku logo, to match the site itself.
 */
export default async function OpengraphImage() {
  const logoH = 84;
  const logoW = Math.round(logoH * RECEIPT_LOGO_ASPECT);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #f4f8ff 0%, #dbe8ff 100%)",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 14,
            background: "#2563eb",
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            right: -140,
            bottom: -180,
            width: 520,
            height: 520,
            borderRadius: 260,
            background: "rgba(37, 99, 235, 0.10)",
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            right: 90,
            bottom: 60,
            width: 150,
            height: 150,
            borderRadius: 75,
            background: "rgba(37, 99, 235, 0.14)",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", padding: "52px 80px" }}>
          <img
            src={`data:image/png;base64,${RECEIPT_LOGO_PNG_BASE64}`}
            width={logoW}
            height={logoH}
            alt=""
          />

          <div
            style={{
              display: "flex",
              marginTop: 44,
              fontSize: 70,
              fontWeight: 700,
              lineHeight: 1.12,
              color: "#0f1b33",
              maxWidth: 1040,
            }}
          >
            Tunaikan Fidyah Anda dengan Mudah &amp; Selamat
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: 30,
              color: "#475569",
            }}
          >
            Kiraan automatik · FPX &amp; kad · Resit terus ke emel
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 36,
              fontSize: 30,
              fontWeight: 700,
              color: "#2563eb",
            }}
          >
            bayarfidyahonline.com
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
