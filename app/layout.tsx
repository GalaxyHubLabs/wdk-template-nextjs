import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";
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

export const metadata: Metadata = {
  title: "WDK Template Wallet — Next.js",
  description:
    "Self-custodial multi-chain wallet template built on Tether WDK. Solana, TRON, TON, and Ethereum from a single seed. Production-ready scaffold for human users and AI agents.",
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
        <Toaster />
      </body>
    </html>
  );
}
