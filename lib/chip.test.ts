import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifySignature } from "./chip";

function generateKeyPair() {
  return crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}

function sign(privateKey: string, body: string): string {
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(body);
  signer.end();
  return signer.sign(privateKey, "base64");
}

describe("verifySignature", () => {
  const { publicKey, privateKey } = generateKeyPair();
  const body = JSON.stringify({
    id: "abc123",
    status: "paid",
    reference: "FID-TEST01",
    event_type: "purchase.paid",
  });

  it("accepts a signature made with the matching private key", () => {
    const signature = sign(privateKey, body);
    expect(verifySignature(body, signature, publicKey)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const signature = sign(privateKey, body);
    const tampered = body.replace("paid", "failed");
    expect(verifySignature(tampered, signature, publicKey)).toBe(false);
  });

  it("rejects a signature produced by a different key pair", () => {
    const other = generateKeyPair();
    const signature = sign(other.privateKey, body);
    expect(verifySignature(body, signature, publicKey)).toBe(false);
  });

  it("rejects when the signature is missing", () => {
    expect(verifySignature(body, null, publicKey)).toBe(false);
    expect(verifySignature(body, undefined, publicKey)).toBe(false);
    expect(verifySignature(body, "", publicKey)).toBe(false);
  });

  it("returns false instead of throwing on malformed input", () => {
    expect(verifySignature(body, "not-valid-base64!!", publicKey)).toBe(false);
    expect(verifySignature(body, "AAAA", "not a real PEM key")).toBe(false);
  });
});
