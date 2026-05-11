import type { NextConfig } from "next";

/**
 * WDK pulls in `sodium-universal`, which by default uses `sodium-native`
 * (Node addon with a binary `.node` file). For browser bundles we substitute
 * `sodium-javascript` (pure JS) — `sodium-universal` already declares this
 * mapping in its `browser` field but Turbopack/Webpack need it explicit.
 *
 * Additional Node built-ins referenced transitively by WDK get empty stubs.
 */
const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      "sodium-native": { browser: "sodium-javascript" },
      "bare-node-runtime": { browser: "next/dist/compiled/util/util.js" },
      // `@tetherto/wdk-wallet-btc` ships multiple transport options
      // (Blockbook REST, Electrum WS, Electrum TCP/SSL). The Electrum
      // TCP path pulls in Node-only `net` / `tls`, but we configure the
      // wallet with the Blockbook HTTP client which never touches those
      // modules at runtime. Aliasing them to an empty stub on browser
      // bundles lets Turbopack tree-shake the TCP transport without
      // tripping over the static import graph.
      net: { browser: "./lib/empty-module.js" },
      tls: { browser: "./lib/empty-module.js" },
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve = config.resolve ?? {};
      // Force sodium-native → sodium-javascript on client bundles
      config.resolve.alias = {
        ...(config.resolve.alias ?? {}),
        "sodium-native": "sodium-javascript",
      };
      config.resolve.fallback = {
        ...(config.resolve.fallback ?? {}),
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        path: false,
        os: false,
        "bare-node-runtime": false,
      };
    }
    return config;
  },
};

export default nextConfig;
