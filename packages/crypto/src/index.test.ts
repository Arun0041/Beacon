import { describe, expect, it } from "vitest";
import {
  createIdentity,
  identityFromSeed,
  openSealed,
  sealToResponder,
  signRecord,
  verifyRecord,
} from "./index";

describe("Beacon crypto", () => {
  it("round-trips signing and detects a tampered character", () => {
    const identity = createIdentity();
    const record = { id: "request-1", note: "Need water", deviceId: identity.deviceId };
    const signed = { ...record, sig: signRecord(record, identity.signingPrivateKey) };
    expect(verifyRecord(signed, identity.signingPublicKey)).toBe(true);
    expect(verifyRecord({ ...signed, note: "Need watrr" }, identity.signingPublicKey)).toBe(false);
  });

  it("derives the same identity from the same seed", () => {
    const first = createIdentity();
    const restored = identityFromSeed(first.seed);
    expect(restored.deviceId).toBe(first.deviceId);
    expect(restored.signingPublicKey).toEqual(first.signingPublicKey);
  });

  it("seals for a responder and rejects a wrong responder key", () => {
    const responder = createIdentity();
    const wrongResponder = createIdentity();
    const envelope = sealToResponder('{"blood":"O+"}', responder.encryptionPublicKey);
    expect(
      openSealed(envelope, responder.encryptionPrivateKey, responder.encryptionPublicKey),
    ).toBe('{"blood":"O+"}');
    expect(() =>
      openSealed(envelope, wrongResponder.encryptionPrivateKey, wrongResponder.encryptionPublicKey),
    ).toThrow();
  });
});
