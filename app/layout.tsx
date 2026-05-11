import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";
import { CommandPalette } from "@/components/command-palette";
import { ThemeToggle, themeInitScript } from "@/components/theme";
import { Toaster } from "@/components/toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Resolve metadataBase from the deployment URL when Vercel injects one,
// otherwise fall back to the production domain. This is what Next.js
// uses to expand relative URLs in OG and Twitter card images.
const metadataBase = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://wdk-template.dev"),
);

export const metadata: Metadata = {
  metadataBase,
  title: "WDK Template Wallet — Next.js",
  description:
    "Self-custodial multi-chain wallet template built on Tether WDK. Solana, TRON, TON, Ethereum, BSC, Polygon, Arbitrum, Base, and Optimism from a single seed. USDT-first. Production-ready scaffold for human users and AI agents.",
  applicationName: "WDK Template Wallet",
  authors: [{ name: "GalaxyHubLabs" }],
  keywords: [
    "Tether",
    "WDK",
    "Wallet Development Kit",
    "USDT",
    "Solana",
    "TRON",
    "TON",
    "Ethereum",
    "multi-chain wallet",
    "self-custody",
    "Next.js",
    "AI agents",
  ],
  openGraph: {
    type: "website",
    title: "WDK Template Wallet — multi-chain, USDT-first",
    description:
      "One seed, nine chains. Open-source Next.js template built on Tether's Wallet Development Kit. Solana · TRON · TON · Ethereum · BSC · Polygon · Arbitrum · Base · Optimism.",
    siteName: "WDK Template Wallet",
  },
  twitter: {
    card: "summary_large_image",
    title: "WDK Template Wallet — multi-chain, USDT-first",
    description:
      "Open-source Next.js wallet template on Tether WDK. Nine chains from one seed. Designed to be forked.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Pre-React script applies the stored theme to <html> before paint
            so the wallet never flashes a wrong-palette frame on first load. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        {/* Floating theme toggle — visible on every page in the top-right. */}
        <div className="absolute right-4 top-4 z-50">
          <ThemeToggle />
        </div>
        {children}
        <CommandPalette />
        <Toaster />
      </body>
    </html>
  );
}
