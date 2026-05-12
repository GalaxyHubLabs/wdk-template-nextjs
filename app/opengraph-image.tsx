import { ImageResponse } from "next/og";

/**
 * Open Graph image served when the template URL is shared on Twitter,
 * Discord, Telegram, etc. Rendered server-side at build time so we
 * don't need to commit a 1200×630 PNG to the repo.
 *
 * Composition: dark teal gradient, wordmark on the left, value prop
 * stack on the right, "Built on Tether WDK" footer. Same brand
 * palette as the rest of the app.
 */

export const alt = "WDK Template Wallet — multi-chain wallet starter built on Tether WDK";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background:
            "linear-gradient(135deg, #0f3a3a 0%, #0a1f1f 60%, #050d0d 100%)",
          color: "#e5e7eb",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Top row — wordmark + tagline */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
          }}
        >
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              background:
                "linear-gradient(135deg, #1FBFA8 0%, #009393 60%, #006666 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 10px 40px rgba(31, 191, 168, 0.35)",
            }}
          >
            <svg
              width="56"
              height="56"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2" />
              <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 1 1-1v-4" />
            </svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: 28,
                color: "#1FBFA8",
                fontWeight: 600,
                letterSpacing: 4,
                textTransform: "uppercase",
              }}
            >
              WDK Template
            </span>
            <span
              style={{
                fontSize: 22,
                color: "#9ca3af",
                marginTop: 4,
              }}
            >
              Open-source multi-chain wallet starter
            </span>
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <span
            style={{
              fontSize: 84,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -3,
              color: "#ffffff",
            }}
          >
            One seed.
          </span>
          <span
            style={{
              fontSize: 84,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -3,
              color: "#ffffff",
            }}
          >
            Ten chains. USDT-first.
          </span>
          <span
            style={{
              fontSize: 28,
              color: "#9ca3af",
              marginTop: 12,
              lineHeight: 1.3,
            }}
          >
            Solana · TRON · TON · Ethereum · BSC · Polygon · Arbitrum · Base · Optimism · Bitcoin
          </span>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "#6b7280",
            fontSize: 22,
          }}
        >
          <span>Next.js 16 · TypeScript · Tailwind v4</span>
          <span style={{ color: "#1FBFA8" }}>Built on Tether WDK</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
