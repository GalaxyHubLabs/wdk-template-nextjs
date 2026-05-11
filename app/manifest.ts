import type { MetadataRoute } from "next";

/**
 * PWA manifest for the WDK Template Wallet.
 *
 * Lets users install the template as a standalone app from supported
 * browsers. Icons are generated dynamically via `app/icon.tsx` and
 * `app/apple-icon.tsx` — Next.js resolves the `/icon` and
 * `/apple-icon` routes for us, so we don't need to commit binary
 * assets.
 */

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WDK Template Wallet",
    short_name: "WDK Wallet",
    description:
      "Multi-chain, USDT-first wallet template built on Tether's Wallet Development Kit. Designed to be forked.",
    start_url: "/",
    display: "standalone",
    background_color: "#050d0d",
    theme_color: "#1FBFA8",
    icons: [
      {
        src: "/icon",
        sizes: "64x64",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
