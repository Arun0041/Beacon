import { ed25519, x25519 } from "@noble/curves/ed25519";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { randomBytes } from "@noble/hashes/utils";
import { xchacha20poly1305 } from "@noble/ciphers/chacha";
import canonicalize from "canonicalize";

export type Uint8ArrayLike = Uint8Array;

export type BeaconIdentity = {
  seed: Uint8Array;
  deviceId: string;
  signingPublicKey: Uint8Array;
  signingPrivateKey: Uint8Array;
  encryptionPublicKey: Uint8Array;
  encryptionPrivateKey: Uint8Array;
};

export type SignedEnvelope = {
  keyId: string;
  ephemeralPublicKey: string;
  nonce: string;
  ciphertext: string;
};

function b64(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromB64(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  if (typeof atob !== "function") throw new Error("base64 decoding is unavailable");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function info(label: string): Uint8Array {
  return new TextEncoder().encode(`Beacon/${label}/v1`);
}

export function createIdentity(seed = randomBytes(32)): BeaconIdentity {
  if (seed.length !== 32) throw new Error("identity seed must be 32 bytes");
  const signingPrivateKey = seed.slice();
  const signingPublicKey = ed25519.getPublicKey(signingPrivateKey);
  const encryptionPrivateKey = hkdf(sha256, seed, undefined, info("X25519"), 32);
  const encryptionPublicKey = x25519.getPublicKey(encryptionPrivateKey);
  const publicHash = sha256(signingPublicKey);
  const deviceId = b64(publicHash.slice(0, 16));
  return {
    seed,
    deviceId,
    signingPublicKey,
    signingPrivateKey,
    encryptionPublicKey,
    encryptionPrivateKey,
  };
}

export function identityFromSeed(seed: Uint8Array): BeaconIdentity {
  return createIdentity(seed);
}

export function seedToBase64(seed: Uint8Array): string {
  return b64(seed);
}

export function seedFromBase64(seed: string): Uint8Array {
  return fromB64(seed);
}

export function canonicalJson(value: unknown): string {
  const result = canonicalize(value);
  if (result === undefined) throw new Error("value cannot be canonicalized");
  return result;
}

export function signRecord(record: object, privateKey: Uint8Array): string {
  const withoutSig = { ...(record as Record<string, unknown>) };
  delete withoutSig.sig;
  delete withoutSig.serverSig;
  const message = new TextEncoder().encode(canonicalJson(withoutSig));
  return b64(ed25519.sign(message, privateKey));
}

export function verifyRecord(record: object, publicKey: Uint8Array): boolean {
  const value = record as Record<string, unknown>;
  if (typeof value.sig !== "string") return false;
  try {
    const withoutSig = { ...value };
    delete withoutSig.sig;
    delete withoutSig.serverSig;
    const message = new TextEncoder().encode(canonicalJson(withoutSig));
    return ed25519.verify(fromB64(value.sig), message, publicKey);
  } catch {
    return false;
  }
}

export function sealingKeyId(publicKey: Uint8Array): string {
  return b64(sha256(publicKey).slice(0, 8));
}

export function sealToResponder(
  plaintext: string,
  responderEncryptionPublicKey: Uint8Array,
): SignedEnvelope {
  const ephemeralPrivateKey = randomBytes(32);
  const ephemeralPublicKey = x25519.getPublicKey(ephemeralPrivateKey);
  const shared = x25519.getSharedSecret(ephemeralPrivateKey, responderEncryptionPublicKey);
  const nonce = randomBytes(24);
  const key = hkdf(sha256, shared, nonce, info("XChaCha20-Poly1305"), 32);
  const ciphertext = xchacha20poly1305(key, nonce).encrypt(new TextEncoder().encode(plaintext));
  return {
    keyId: sealingKeyId(responderEncryptionPublicKey),
    ephemeralPublicKey: b64(ephemeralPublicKey),
    nonce: b64(nonce),
    ciphertext: b64(ciphertext),
  };
}

export function openSealed(
  envelope: SignedEnvelope,
  responderEncryptionPrivateKey: Uint8Array,
  responderEncryptionPublicKey: Uint8Array,
): string {
  if (envelope.keyId !== sealingKeyId(responderEncryptionPublicKey)) {
    throw new Error("sealed envelope is for a different responder key");
  }
  const ephemeralPublicKey = fromB64(envelope.ephemeralPublicKey);
  const shared = x25519.getSharedSecret(responderEncryptionPrivateKey, ephemeralPublicKey);
  const nonce = fromB64(envelope.nonce);
  const key = hkdf(sha256, shared, nonce, info("XChaCha20-Poly1305"), 32);
  const plaintext = xchacha20poly1305(key, nonce).decrypt(fromB64(envelope.ciphertext));
  return new TextDecoder().decode(plaintext);
}
