import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #115e59 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
          padding: "80px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: 2,
            color: "#5eead4",
            textTransform: "uppercase",
            marginBottom: 24,
          }}
        >
          Bayar Fidyah Online
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 800,
            lineHeight: 1.15,
            maxWidth: 900,
          }}
        >
          Tunaikan Fidyah Puasa Anda di Malaysia
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 30,
            color: "#cbd5e1",
            marginTop: 32,
          }}
        >
          Kiraan automatik &middot; Bayaran selamat &middot; Resit ke emel
        </div>
      </div>
    ),
    { ...size }
  );
}
