import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeDb } from "./test-helpers/fake-supabase";
import { attachProof } from "./proof-attach";
import { MAX_PROOF_BYTES } from "./proof-file";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 1, 2, 3]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
const PDF = new TextEncoder().encode("%PDF-1.4 fake");

let db: FakeDb;
const publicLookup = async () => [{ address: "104.18.2.3", family: 4 }];

function seed(overrides: Record<string, unknown> = {}) {
  return db.insertRow("donations", {
    reference: "FID-QR000001",
    payment_method: "qr",
    status: "pending",
    proof_of_payment_path: null,
    payer_name: "Ahmad",
    amount_sen: 4000,
    ...overrides,
  });
}

const attach = (reference: string, source: Parameters<typeof attachProof>[2], fetchOptions = {}) =>
  attachProof({ supabase: db.client(), fetchOptions }, reference, source);

const file = (bytes: Uint8Array) => ({ kind: "file", bytes }) as const;

beforeEach(() => {
  db = new FakeDb();
});

describe("attachProof — a valid file", () => {
  it("stores a JPEG and records it on the donation", async () => {
    seed();
    const r = await attach("FID-QR000001", file(JPEG));
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const upload = db.storage.uploads[0];
    expect(upload.bucket).toBe("payment-proofs");
    expect(upload.contentType).toBe("image/jpeg");
    expect(upload.path).toMatch(/^FID-QR000001\/\d+-bukti\.jpg$/);
    expect(db.tables.donations[0].proof_of_payment_path).toBe(upload.path);
    expect(r.replaced).toBe(false);
  });

  it("accepts PNG and PDF", async () => {
    seed();
    expect((await attach("FID-QR000001", file(PNG))).ok).toBe(true);
    expect(db.storage.uploads.at(-1)?.contentType).toBe("image/png");
    expect((await attach("FID-QR000001", file(PDF))).ok).toBe(true);
    expect(db.storage.uploads.at(-1)?.contentType).toBe("application/pdf");
  });

  it("works for a bank-transfer record as well as a QR one", async () => {
    seed({ payment_method: "bank_transfer" });
    expect((await attach("FID-QR000001", file(JPEG))).ok).toBe(true);
  });

  it("replaces an earlier proof and removes the old file", async () => {
    seed({ proof_of_payment_path: "FID-QR000001/111-old.jpg" });
    db.storage.objects.add("payment-proofs/FID-QR000001/111-old.jpg");

    const r = await attach("FID-QR000001", file(PNG));
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.replaced).toBe(true);
    expect(db.storage.removed).toContain("FID-QR000001/111-old.jpg");
    expect(db.tables.donations[0].proof_of_payment_path).not.toBe("FID-QR000001/111-old.jpg");
  });

  it("names the stored file itself, ignoring anything the caller might have called it", async () => {
    seed();
    await attach("FID-QR000001", file(JPEG));
    // No caller-supplied name reaches storage: it is always <ts>-bukti.<ext>.
    expect(db.storage.uploads[0].path).toMatch(/-bukti\.jpg$/);
  });
});

describe("attachProof — forbidden and oversized files", () => {
  beforeEach(() => seed());

  it("refuses a script, whatever it is called", async () => {
    const r = await attach("FID-QR000001", file(new TextEncoder().encode("<script>alert(1)</script>")));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(415);
      expect(r.code).toBe("UNSUPPORTED_FILE_TYPE");
    }
    expect(db.storage.uploads).toHaveLength(0);
  });

  it("refuses a Windows executable and an SVG", async () => {
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 3, 0, 0, 0]);
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
    expect((await attach("FID-QR000001", file(exe))).ok).toBe(false);
    expect((await attach("FID-QR000001", file(svg))).ok).toBe(false);
    expect(db.storage.uploads).toHaveLength(0);
  });

  it("refuses an empty file", async () => {
    const r = await attach("FID-QR000001", file(new Uint8Array(0)));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("EMPTY_FILE");
  });

  it("refuses a file over 5MB with 413, even if it is a real JPEG", async () => {
    const big = new Uint8Array(MAX_PROOF_BYTES + 1);
    big.set(JPEG);
    const r = await attach("FID-QR000001", file(big));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(413);
      expect(r.code).toBe("FILE_TOO_LARGE");
    }
    expect(db.storage.uploads).toHaveLength(0);
  });

  it("accepts a file of exactly 5MB", async () => {
    const edge = new Uint8Array(MAX_PROOF_BYTES);
    edge.set(JPEG);
    expect((await attach("FID-QR000001", file(edge))).ok).toBe(true);
  });
});

describe("attachProof — which records may take a proof", () => {
  it("refuses an ONLINE (CHIP) record", async () => {
    seed({ payment_method: "chip", reference: "FID-CHIP0001" });
    const r = await attach("FID-CHIP0001", file(JPEG));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(409);
      expect(r.code).toBe("NOT_MANUAL_PAYMENT");
    }
    expect(db.storage.uploads).toHaveLength(0);
  });

  it("refuses the site's own bank-transfer record (that flow has its own upload)", async () => {
    seed({ payment_method: "manual", reference: "FID-MAN00001" });
    const r = await attach("FID-MAN00001", file(JPEG));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("NOT_MANUAL_PAYMENT");
  });

  it("refuses a record staff have already confirmed", async () => {
    seed({ status: "paid" });
    const r = await attach("FID-QR000001", file(JPEG));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("NOT_AWAITING_REVIEW");
    expect(db.storage.uploads).toHaveLength(0);
  });

  it("refuses a failed record", async () => {
    seed({ status: "failed" });
    expect((await attach("FID-QR000001", file(JPEG))).ok).toBe(false);
  });

  it("answers 404 for an unknown reference", async () => {
    const r = await attach("FID-NOPE", file(JPEG));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(404);
  });

  it("does not leave an orphan when the record is confirmed mid-upload", async () => {
    seed();
    // The row is confirmed between the eligibility check and the final write.
    db.storage.failUpload = false;
    const client = db.client();
    const realFrom = client.from.bind(client);
    let updates = 0;
    (client as unknown as { from: unknown }).from = (table: string) => {
      const q = realFrom(table) as unknown as { update: (p: unknown) => unknown };
      const realUpdate = q.update.bind(q);
      q.update = (patch: unknown) => {
        if (updates++ === 0) db.tables.donations[0].status = "paid"; // staff got there first
        return realUpdate(patch);
      };
      return q;
    };

    const r = await attachProof({ supabase: client }, "FID-QR000001", file(JPEG));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("NOT_AWAITING_REVIEW");
    // The file that was uploaded is removed again.
    expect(db.storage.removed).toHaveLength(1);
    expect(db.tables.donations[0].proof_of_payment_path).toBeNull();
  });
});

describe("attachProof — proof_url", () => {
  beforeEach(() => seed());

  it("downloads from the allowed host and stores the result", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JPEG as BodyInit, { status: 200 }));
    const r = await attach(
      "FID-QR000001",
      { kind: "url", url: "https://api.murpati.com/media/abc.jpg" },
      { fetchImpl, lookup: publicLookup }
    );
    expect(r.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(db.storage.uploads[0].contentType).toBe("image/jpeg");
  });

  it.each([
    ["a host that is not on the list", "https://evil.example.com/a.jpg"],
    ["plain http", "http://api.murpati.com/a.jpg"],
    ["the cloud metadata address", "https://169.254.169.254/latest/meta-data/"],
    ["localhost", "https://localhost/admin"],
    ["a private address", "https://192.168.0.10/a.jpg"],
  ])("refuses %s without making any request", async (_n, url) => {
    const fetchImpl = vi.fn();
    const r = await attach("FID-QR000001", { kind: "url", url }, { fetchImpl, lookup: publicLookup });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(400);
      expect(r.code).toBe("PROOF_URL_NOT_ALLOWED");
    }
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(db.storage.uploads).toHaveLength(0);
  });

  it("checks the file type of what it downloaded, not what the URL says", async () => {
    const html = new TextEncoder().encode("<html>login</html>");
    const fetchImpl = vi.fn().mockResolvedValue(new Response(html as BodyInit, { status: 200 }));
    const r = await attach(
      "FID-QR000001",
      { kind: "url", url: "https://api.murpati.com/media/receipt.jpg" },
      { fetchImpl, lookup: publicLookup }
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("UNSUPPORTED_FILE_TYPE");
  });

  it("will not attach to an online record through proof_url either", async () => {
    db.tables.donations = [];
    seed({ payment_method: "chip", reference: "FID-CHIP0002" });
    const fetchImpl = vi.fn();
    const r = await attach(
      "FID-CHIP0002",
      { kind: "url", url: "https://api.murpati.com/media/abc.jpg" },
      { fetchImpl, lookup: publicLookup }
    );
    expect(r.ok).toBe(false);
    // Refused before anything was downloaded.
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
