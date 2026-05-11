import { ImageResponse } from "next/og";

/**
 * Dynamically generated favicon for the WDK Template Wallet.
 *
 * Renders the template's "W" wordmark in Tether teal on a dark gradient.
 * Next.js picks this up automatically and serves it at `/icon` plus the
 * standard link-rel paths in the document head.
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
            "linear-gradient(135deg, #0f3a3a 0%, #0a1f1f 65%, #050d0d 100%)",
          color: "#1FBFA8",
          fontSize: 40,
          fontWeight: 800,
          letterSpacing: -2,
          fontFamily: "system-ui, sans-serif",
          borderRadius: 16,
        }}
      >
        W
      </div>
    ),
    { ...size },
  );
}
