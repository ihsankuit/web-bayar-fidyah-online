import { describe, expect, it, vi } from "vitest";

import {
  MAX_PROOF_BYTES,
  assertPublicHost,
  fetchProofFromUrl,
  isPrivateAddress,
  sniffProofType,
  validateProofUrl,
} from "./proof-file";

const bytes = (...b: number[]) => new Uint8Array(b);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0);
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34);

describe("sniffProofType", () => {
  it("identifies JPG, PNG, WEBP and PDF from their first bytes", () => {
    expect(sniffProofType(JPEG)).toEqual({ mime: "image/jpeg", ext: "jpg" });
    expect(sniffProofType(PNG)).toEqual({ mime: "image/png", ext: "png" });
    expect(sniffProofType(WEBP)).toEqual({ mime: "image/webp", ext: "webp" });
    expect(sniffProofType(PDF)).toEqual({ mime: "application/pdf", ext: "pdf" });
  });

  it("refuses a script, an executable, an HTML page and an SVG", () => {
    const enc = (s: string) => new TextEncoder().encode(s);
    expect(sniffProofType(enc("<script>alert(1)</script>"))).toBeNull();
    expect(sniffProofType(enc("<!doctype html><html>"))).toBeNull();
    expect(sniffProofType(enc('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sniffProofType(bytes(0x4d, 0x5a, 0x90, 0x00))).toBeNull(); // Windows exe
    expect(sniffProofType(bytes(0x7f, 0x45, 0x4c, 0x46))).toBeNull(); // ELF
  });

  it("does not take a RIFF container for WEBP unless it says WEBP", () => {
    // A WAV file starts with RIFF too.
    const wav = bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45);
    expect(sniffProofType(wav)).toBeNull();
  });

  it("refuses empty and truncated input", () => {
    expect(sniffProofType(new Uint8Array(0))).toBeNull();
    expect(sniffProofType(bytes(0xff, 0xd8))).toBeNull();
  });
});

describe("validateProofUrl", () => {
  it("accepts HTTPS on the allowed host", () => {
    const r = validateProofUrl("https://api.murpati.com/media/abc.jpg");
    expect(r.ok).toBe(true);
  });

  it.each([
    ["http (not HTTPS)", "http://api.murpati.com/a.jpg"],
    ["a different host", "https://evil.example.com/a.jpg"],
    ["a look-alike host", "https://api.murpati.com.evil.com/a.jpg"],
    ["a subdomain of the allowed host", "https://x.api.murpati.com/a.jpg"],
    ["an allowed name used as a userinfo trick", "https://api.murpati.com@evil.com/a.jpg"],
    ["credentials in the URL", "https://user:pw@api.murpati.com/a.jpg"],
    ["a non-standard port", "https://api.murpati.com:8443/a.jpg"],
    ["not a URL", "not a url"],
    ["a file: URL", "file:///etc/passwd"],
    ["a data: URL", "data:image/png;base64,AAAA"],
  ])("rejects %s", (_name, url) => {
    expect(validateProofUrl(url).ok).toBe(false);
  });

  it.each([
    "https://127.0.0.1/a.jpg",
    "https://10.0.0.5/a.jpg",
    "https://192.168.1.1/a.jpg",
    "https://169.254.169.254/latest/meta-data/",
    "https://[::1]/a.jpg",
    "https://[::ffff:7f00:1]/a.jpg",
    "https://2130706433/a.jpg", // 127.0.0.1 written as one integer
    "https://0x7f.0.0.1/a.jpg", // hex octet
    "https://localhost/a.jpg",
    "https://foo.localhost/a.jpg",
    "https://db.internal/a.jpg",
  ])("rejects the private or loopback address %s", (url) => {
    // Even if someone allowlisted it, an address is never acceptable.
    const r = validateProofUrl(url, [
      "127.0.0.1",
      "localhost",
      "10.0.0.5",
      "192.168.1.1",
      "169.254.169.254",
    ]);
    expect(r.ok).toBe(false);
  });

  it("treats a trailing dot as the same host, not a way round the list", () => {
    expect(validateProofUrl("https://api.murpati.com./a.jpg").ok).toBe(true);
    expect(validateProofUrl("https://evil.com./a.jpg").ok).toBe(false);
  });

  it("matches the host case-insensitively", () => {
    expect(validateProofUrl("https://API.Murpati.COM/a.jpg").ok).toBe(true);
  });
});

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.0.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:10.0.0.1",
  ])("flags %s as private", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "104.18.2.3", "2606:4700::1111"])(
    "allows the public address %s",
    (ip) => {
      expect(isPrivateAddress(ip)).toBe(false);
    }
  );

  it("refuses anything that is not an IP address at all", () => {
    expect(isPrivateAddress("not-an-ip")).toBe(true);
  });
});

describe("assertPublicHost", () => {
  it("passes a host that resolves only to public addresses", async () => {
    const lookup = vi.fn().mockResolvedValue([{ address: "104.18.2.3", family: 4 }]);
    expect((await assertPublicHost("api.murpati.com", lookup)).ok).toBe(true);
  });

  it("fails a host that resolves to a private address, even alongside a public one", async () => {
    const lookup = vi.fn().mockResolvedValue([
      { address: "104.18.2.3", family: 4 },
      { address: "10.0.0.7", family: 4 },
    ]);
    expect((await assertPublicHost("api.murpati.com", lookup)).ok).toBe(false);
  });

  it("fails a host that does not resolve", async () => {
    const lookup = vi.fn().mockRejectedValue(new Error("ENOTFOUND"));
    expect((await assertPublicHost("api.murpati.com", lookup)).ok).toBe(false);
  });
});

describe("fetchProofFromUrl", () => {
  const publicLookup = async () => [{ address: "104.18.2.3", family: 4 }];
  const respond = (body: Uint8Array | null, init: ResponseInit = {}) =>
    new Response(body as BodyInit | null, { status: 200, ...init });

  it("downloads from an allowed host", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(respond(JPEG));
    const r = await fetchProofFromUrl("https://api.murpati.com/a.jpg", {
      fetchImpl,
      lookup: publicLookup,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(Array.from(r.bytes)).toEqual(Array.from(JPEG));
  });

  it("never makes a request for a host that is not allowed", async () => {
    const fetchImpl = vi.fn();
    const r = await fetchProofFromUrl("https://evil.example.com/a.jpg", {
      fetchImpl,
      lookup: publicLookup,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("PROOF_URL_NOT_ALLOWED");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("never makes a request when an allowed name resolves to a private address", async () => {
    const fetchImpl = vi.fn();
    const r = await fetchProofFromUrl("https://api.murpati.com/a.jpg", {
      fetchImpl,
      lookup: async () => [{ address: "127.0.0.1", family: 4 }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("PROOF_URL_NOT_ALLOWED");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("asks fetch not to follow redirects, and refuses one that arrives", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        respond(null, { status: 302, headers: { location: "http://169.254.169.254/" } })
      );
    const r = await fetchProofFromUrl("https://api.murpati.com/a.jpg", {
      fetchImpl,
      lookup: publicLookup,
    });
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("PROOF_URL_FETCH_FAILED");
  });

  it("refuses a file whose declared length is over the cap, without reading it", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      respond(JPEG, { headers: { "content-length": String(MAX_PROOF_BYTES + 1) } })
    );
    const r = await fetchProofFromUrl("https://api.murpati.com/big.jpg", {
      fetchImpl,
      lookup: publicLookup,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(413);
      expect(r.code).toBe("FILE_TOO_LARGE");
    }
  });

  it("stops reading a stream that outgrows the cap even when it lied about its length", async () => {
    // No Content-Length, and more data than allowed.
    const chunk = new Uint8Array(1024 * 1024);
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent >= 8) return controller.close();
        sent += 1;
        controller.enqueue(chunk);
      },
    });
    const fetchImpl = vi.fn().mockResolvedValue(respond(body as unknown as Uint8Array));
    const r = await fetchProofFromUrl("https://api.murpati.com/stream.bin", {
      fetchImpl,
      lookup: publicLookup,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("FILE_TOO_LARGE");
    // It stopped early rather than draining all 8MB.
    expect(sent).toBeLessThan(8);
  });

  it("reports a timeout as 504", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(
      Object.assign(new Error("timed out"), { name: "TimeoutError" })
    );
    const r = await fetchProofFromUrl("https://api.murpati.com/slow.jpg", {
      fetchImpl,
      lookup: publicLookup,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(504);
      expect(r.code).toBe("PROOF_URL_TIMEOUT");
    }
  });

  it("passes a 15 second abort signal to fetch", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(respond(JPEG));
    await fetchProofFromUrl("https://api.murpati.com/a.jpg", {
      fetchImpl,
      lookup: publicLookup,
    });
    expect(fetchImpl.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("reports an upstream error status as a fetch failure", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(respond(null, { status: 404 }));
    const r = await fetchProofFromUrl("https://api.murpati.com/gone.jpg", {
      fetchImpl,
      lookup: publicLookup,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("PROOF_URL_FETCH_FAILED");
  });
});
