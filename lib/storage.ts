/**
 * Password-encrypted seed-phrase storage using the browser WebCrypto API.
 *
 * Threat model:
 * - Seed phrase is encrypted at rest in `sessionStorage` (cleared on tab close).
 * - Encryption key is derived from the user's password via PBKDF2-SHA256.
 * - Cleartext seed only exists transiently in memory while unlocked.
 *
 * This is a template — production wallets should additionally:
 * - Use IndexedDB with a non-extractable CryptoKey (WebAuthn / hardware-backed).
 * - Rate-limit unlock attempts.
 * - Add an integrity check / wipe-after-N-failures policy.
 */

const STORAGE_KEY = "wdk-template:vault";
const SALT_BYTES = 16;
const IV_BYTES = 12;
const PBKDF2_ITERS = 250_000;

function ensureWebCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      "WebCrypto SubtleCrypto is unavailable. This template requires a modern browser.",
    );
  }
  return subtle;
}

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = ensureWebCrypto();
  const passKey = await subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERS,
      hash: "SHA-256",
    },
    passKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export interface VaultBlob {
  v: 1;
  salt: string; // base64
  iv: string; // base64
  ct: string; // base64 ciphertext of seedPhrase
}

/** Encrypt the seed phrase with the user's password and persist to sessionStorage. */
export async function saveVault(seedPhrase: string, password: string): Promise<void> {
  const subtle = ensureWebCrypto();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt);
  const ct = await subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    new TextEncoder().encode(seedPhrase),
  );
  const blob: VaultBlob = {
    v: 1,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ct: toBase64(ct),
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
}

/** Decrypt the stored seed phrase. Throws if no vault or wrong password. */
export async function unlockVault(password: string): Promise<string> {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) throw new Error("No wallet found in this session.");
  const blob = JSON.parse(raw) as VaultBlob;
  if (blob.v !== 1) throw new Error("Unsupported vault format.");
  const subtle = ensureWebCrypto();
  const key = await deriveKey(password, fromBase64(blob.salt));
  try {
    const plain = await subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(blob.iv) as unknown as BufferSource },
      key,
      fromBase64(blob.ct) as unknown as BufferSource,
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error("Incorrect password.");
  }
}

export function hasVault(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(STORAGE_KEY) !== null;
}

export function clearVault(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}
