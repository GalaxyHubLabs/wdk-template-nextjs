// Empty stub used as a browser-side substitute for Node-only built-ins
// (`net`, `tls`) that some WDK transitive dependencies reference but
// don't actually invoke when we're using their browser-compatible
// code paths. Turbopack aliases the Node modules to this file via
// `next.config.ts` for `{ browser: ... }`.
export default {};
