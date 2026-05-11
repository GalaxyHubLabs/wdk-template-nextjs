import { ImageResponse } from "next/og";

/**
 * Apple touch icon — same wordmark as `icon.tsx`, sized for iOS home
 * screen previews. Kept as a separate file so we can tune the visual
 * weight independently if the standard favicon proves too small.
 */

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
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
          fontSize: 120,
          fontWeight: 800,
          letterSpacing: -6,
          fontFamily: "system-ui, sans-serif",
          borderRadius: 40,
        }}
      >
        W
      </div>
    ),
    { ...size },
  );
}
