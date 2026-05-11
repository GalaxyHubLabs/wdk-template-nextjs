/**
 * Biometric quick-unlock via WebAuthn + PRF.
 *
 * Two-step setup:
 *   1. The user enables biometric unlock from Settings after they're
 *      already inside (i.e. their password has been verified at least
 *      once this session).
 *   2. We register a platform authenticator credential with the
 *      `prf` extension and ask for a PRF output bound to a known
 *      salt. The PRF output is a deterministic 32-byte value the
 *      device only reveals after a successful biometric ceremony
 *      (Touch ID, Windows Hello, Android fingerprint, etc.).
 *   3. We encrypt the user's password with that PRF output using
 *      AES-GCM and store (credentialId + ciphertext + iv) in
 *      localStorage. The seed phrase is never touched here — we
 *      reuse the existing password-derived vault.
 *
 * On unlock:
 *   1. The unlock screen surfaces a "Use biometric" button when a
 *      credential is registered.
 *   2. We call `navigator.credentials.get` with the stored credential
 *      id and ask for the same PRF salt. The authenticator prompts
 *      for biometric, returns the same 32 bytes.
 *   3. We decrypt the stored password and hand it to the existing
 *      `unlockVault(password)` path — every downstream behaviour is
 *      identical to a manual password unlock.
 *
 * Security trade-offs (read before you ship):
 *   - PRF support is currently Chrome ≥ 116, Edge ≥ 116, Safari TP 17+.
 *     We feature-detect and degrade gracefully — users on Firefox or
 *     older browsers see a "not supported in this browser" disabled
 *     state rather than a broken button.
 *   - The encrypted password sits in localStorage. Recovery requires
 *     a working ceremony on the same device, so a stolen laptop can't
 *     be decrypted without the user's biometric. Wiping the wallet
 *     wipes this state too.
 *   - The user's password is still required for the very first
 *     unlock after a wipe / new install — biometric is convenience
 *     layered on top, never the only path to the vault.
 */

const STORAGE_KEY = "wdk-template:biometric";
const PRF_SALT = new TextEncoder().encode("wdk-template:prf-v1");
const RP_NAME = "WDK Template Wallet";

interface StoredBiometric {
  /** base64url of the credential's rawId. */
  credentialId: string;
  /** base64url ciphertext from AES-GCM. */
  password: string;
  /** base64url 12-byte IV. */
  iv: string;
}

function getStored(): StoredBiometric | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredBiometric;
  } catch {
    return null;
  }
}

function setStored(value: StoredBiometric | null): void {
  if (typeof window === "undefined") return;
  if (value == null) {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }
}

/** True when this device looks capable of running the biometric flow.
 *  Doesn't guarantee PRF support — that's only knowable after a real
 *  ceremony. Used to decide whether to surface the setup affordance. */
export async function isBiometricAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("credentials" in navigator)) return false;
  if (!window.PublicKeyCredential) return false;
  try {
    // Most authenticators on macOS / iOS / Android / Windows expose this
    // as `isUserVerifyingPlatformAuthenticatorAvailable`.
    const v =
      await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return Boolean(v);
  } catch {
    return false;
  }
}

/** True when this device has a registered biometric credential for
 *  this wallet. Surfaces the "Use biometric" affordance on /unlock. */
export function isBiometricEnrolled(): boolean {
  return getStored() != null;
}

/** Remove the stored biometric blob. Called from Settings when the
 *  user disables biometric unlock and from the wipe path. */
export function disableBiometric(): void {
  setStored(null);
}

/**
 * Enable biometric unlock. The caller must have just verified the
 * password (typically right after a successful manual unlock).
 *
 * Throws when the browser doesn't support PRF or the user cancels
 * the ceremony. The Settings page catches and surfaces these.
 */
export async function enableBiometric(password: string): Promise<void> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    throw new Error("WebAuthn isn't available in this browser.");
  }

  const rpId = window.location.hostname;
  const userId = bytesToBuffer(crypto.getRandomValues(new Uint8Array(16)));
  const challenge = bytesToBuffer(crypto.getRandomValues(new Uint8Array(32)));

  // Register a platform credential and ask the authenticator for a
  // PRF output bound to PRF_SALT. The output won't be returned by
  // `create()` on most platforms — we have to authenticate once
  // after creation to retrieve it.
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: RP_NAME, id: rpId },
      user: {
        id: userId,
        name: "wdk-template-wallet",
        displayName: "WDK Template Wallet",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 }, // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60_000,
      extensions: {
        prf: { eval: { first: bytesToBuffer(PRF_SALT) } },
      } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;

  if (!cred) throw new Error("Credential creation was cancelled.");

  const rawId = new Uint8Array(cred.rawId);
  // Some platforms include PRF in the create() result; most need an
  // immediate get() to fetch it. Try both paths.
  let prfBytes: Uint8Array | null = extractPrfFromExtensions(
    cred.getClientExtensionResults(),
  );
  if (!prfBytes) {
    prfBytes = await fetchPrfViaAssertion(rawId, rpId);
  }
  if (!prfBytes) {
    throw new Error(
      "Your browser advertised WebAuthn PRF support but the authenticator did not return a PRF output. Try a different browser or update to the latest version.",
    );
  }

  const { ciphertext, iv } = await aesGcmEncrypt(password, prfBytes);
  setStored({
    credentialId: b64url(rawId),
    password: b64url(ciphertext),
    iv: b64url(iv),
  });
}

/**
 * Run the biometric ceremony and return the stored password.
 *
 * The caller (the unlock screen) then hands the password to the
 * existing `unlockVault(password)` flow, so the rest of the app is
 * agnostic to whether the unlock came from manual entry or biometric.
 */
export async function unlockWithBiometric(): Promise<string> {
  const stored = getStored();
  if (!stored) throw new Error("Biometric unlock is not set up.");

  const rpId = window.location.hostname;
  const challenge = bytesToBuffer(crypto.getRandomValues(new Uint8Array(32)));
  const credId = bytesToBuffer(fromB64url(stored.credentialId));

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId,
      timeout: 60_000,
      userVerification: "required",
      allowCredentials: [
        {
          type: "public-key",
          id: credId,
          transports: ["internal"],
        },
      ],
      extensions: {
        prf: { eval: { first: bytesToBuffer(PRF_SALT) } },
      } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;

  if (!assertion) throw new Error("Biometric ceremony cancelled.");

  const prfBytes = extractPrfFromExtensions(
    assertion.getClientExtensionResults(),
  );
  if (!prfBytes) {
    throw new Error(
      "Biometric ceremony succeeded but the authenticator didn't return a PRF output. Disable biometric unlock and try again.",
    );
  }

  return await aesGcmDecrypt(
    fromB64url(stored.password),
    fromB64url(stored.iv),
    prfBytes,
  );
}

// ─── WebAuthn extension helpers ───────────────────────────────────────

interface PrfExtensionResults {
  prf?: {
    results?: {
      first?: ArrayBuffer;
    };
  };
}

function extractPrfFromExtensions(
  results: AuthenticationExtensionsClientOutputs,
): Uint8Array | null {
  const prf = (results as PrfExtensionResults)?.prf?.results?.first;
  if (!prf) return null;
  return new Uint8Array(prf);
}

/** Some authenticators only emit the PRF output on the assertion step,
 *  not on creation. This helper does an immediate-after-create get()
 *  ceremony to fetch it. The user sees a single combined prompt on
 *  most platforms because the credential is already attested. */
async function fetchPrfViaAssertion(
  rawId: Uint8Array,
  rpId: string,
): Promise<Uint8Array | null> {
  try {
    const challenge = bytesToBuffer(crypto.getRandomValues(new Uint8Array(32)));
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId,
        timeout: 60_000,
        userVerification: "required",
        allowCredentials: [
          {
            type: "public-key",
            id: bytesToBuffer(rawId),
            transports: ["internal"],
          },
        ],
        extensions: {
          prf: { eval: { first: bytesToBuffer(PRF_SALT) } },
        } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential | null;
    if (!assertion) return null;
    return extractPrfFromExtensions(assertion.getClientExtensionResults());
  } catch {
    return null;
  }
}

/** Convert a Uint8Array into a plain ArrayBuffer with a matching byte
 *  range. TypeScript 5's strict ArrayBufferLike vs ArrayBuffer split
 *  bites every WebAuthn caller — this helper lets us pass through
 *  cleanly without `as any` everywhere. */
function bytesToBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

// ─── Symmetric crypto helpers ─────────────────────────────────────────

async function aesGcmEncrypt(
  plaintext: string,
  keyMaterial: Uint8Array,
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  const key = await importAesKey(keyMaterial);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: bytesToBuffer(iv) },
    key,
    bytesToBuffer(new TextEncoder().encode(plaintext)),
  );
  return { ciphertext: new Uint8Array(ct), iv };
}

async function aesGcmDecrypt(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  keyMaterial: Uint8Array,
): Promise<string> {
  const key = await importAesKey(keyMaterial);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytesToBuffer(iv) },
    key,
    bytesToBuffer(ciphertext),
  );
  return new TextDecoder().decode(pt);
}

async function importAesKey(keyMaterial: Uint8Array): Promise<CryptoKey> {
  // PRF output is already 32 bytes — perfect for AES-256. We import
  // it directly rather than running PBKDF2 on top.
  return crypto.subtle.importKey(
    "raw",
    bytesToBuffer(keyMaterial),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

// ─── base64url helpers ────────────────────────────────────────────────

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
