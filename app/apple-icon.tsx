import { ImageResponse } from "next/og";

/**
 * Apple touch icon — same wallet glyph as `icon.tsx`, sized for iOS
 * home screen previews. Kept as a separate file so we can tune the
 * visual weight independently if the standard favicon proves too
 * small at the smallest browser-tab size.
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
            "linear-gradient(135deg, #1FBFA8 0%, #009393 60%, #006666 100%)",
          borderRadius: 40,
        }}
      >
        <svg
          width="112"
          height="112"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2" />
          <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 1 1-1v-4" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
