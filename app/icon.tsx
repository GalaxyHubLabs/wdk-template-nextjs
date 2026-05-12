import { ImageResponse } from "next/og";

/**
 * Dynamically generated favicon for the WDK Template Wallet.
 *
 * A wallet glyph in white on a Tether-teal gradient. The shape is a
 * universally-readable "this is a wallet" mark — no text, no
 * borrowed brand IP, just the icon every crypto user already
 * associates with wallet apps. Reads cleanly at 16 px and 32 px,
 * which is where favicons actually live in browser tabs.
 *
 * Next.js picks this up automatically and serves it at `/icon` plus
 * the standard link-rel paths in the document head.
 */

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #1FBFA8 0%, #009393 60%, #006666 100%)",
          borderRadius: 14,
        }}
      >
        {/* Wallet glyph — Lucide-style path, drawn pure white at the
            size that fills the icon canvas neatly. */}
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2" />
          <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
