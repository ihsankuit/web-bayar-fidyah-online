import { describe, expect, it } from "vitest";

import {
  apiStatus,
  isApiRecorded,
  isOffline,
  needsReview,
  paymentMethodLabel,
  receiptChannelLabel,
  sourceLabel,
} from "./payment-methods";

describe("payment method labels", () => {
  it("names every method for the admin list", () => {
    expect(paymentMethodLabel("chip")).toBe("Online (CHIP)");
    expect(paymentMethodLabel("manual")).toBe("Pindahan Manual");
    expect(paymentMethodLabel("qr")).toBe("DuitNow QR");
    expect(paymentMethodLabel("bank_transfer")).toBe("Pindahan Bank");
  });

  it("describes the channel on a receipt", () => {
    expect(receiptChannelLabel("chip")).toBe("CHIP (FPX / kad)");
    expect(receiptChannelLabel("qr")).toBe("DuitNow QR");
    expect(receiptChannelLabel("bank_transfer")).toBe("Pindahan bank");
    expect(receiptChannelLabel("manual")).toBe("Pindahan bank");
  });
});

describe("method families", () => {
  it("treats everything but CHIP as having no gateway checkout", () => {
    expect(isOffline("chip")).toBe(false);
    for (const m of ["manual", "qr", "bank_transfer"] as const) {
      expect(isOffline(m)).toBe(true);
    }
  });

  it("singles out the two API-recorded methods", () => {
    expect(isApiRecorded("qr")).toBe(true);
    expect(isApiRecorded("bank_transfer")).toBe(true);
    expect(isApiRecorded("manual")).toBe(false);
    expect(isApiRecorded("chip")).toBe(false);
  });
});

describe("needsReview (Perlu Semak)", () => {
  it("is true for an API-recorded payment straight away, with or without proof", () => {
    for (const method of ["qr", "bank_transfer"] as const) {
      expect(needsReview({ status: "pending", payment_method: method, proof_of_payment_path: null })).toBe(true);
      expect(needsReview({ status: "pending", payment_method: method, proof_of_payment_path: "a/b.jpg" })).toBe(true);
    }
  });

  it("is true for the site's own manual transfer only once proof is uploaded", () => {
    expect(needsReview({ status: "pending", payment_method: "manual", proof_of_payment_path: null })).toBe(false);
    expect(needsReview({ status: "pending", payment_method: "manual", proof_of_payment_path: "a/b.jpg" })).toBe(true);
  });

  it("is never true for an online payment", () => {
    expect(needsReview({ status: "pending", payment_method: "chip", proof_of_payment_path: null })).toBe(false);
    expect(needsReview({ status: "pending", payment_method: "chip", proof_of_payment_path: "a/b.jpg" })).toBe(false);
  });

  it("is false once confirmed or failed", () => {
    for (const status of ["paid", "failed"] as const) {
      expect(needsReview({ status, payment_method: "qr", proof_of_payment_path: "a/b.jpg" })).toBe(false);
    }
  });
});

describe("apiStatus", () => {
  it("reports review for a pending API-recorded payment", () => {
    expect(apiStatus({ status: "pending", payment_method: "qr" })).toBe("review");
    expect(apiStatus({ status: "pending", payment_method: "bank_transfer" })).toBe("review");
  });

  it("leaves every existing row's status exactly as it was", () => {
    // The statuses consumers already know must not change for payments that
    // existed before this feature.
    expect(apiStatus({ status: "pending", payment_method: "chip" })).toBe("pending");
    expect(apiStatus({ status: "pending", payment_method: "manual" })).toBe("pending");
    expect(apiStatus({ status: "paid", payment_method: "chip" })).toBe("paid");
    expect(apiStatus({ status: "failed", payment_method: "chip" })).toBe("failed");
  });

  it("reports paid once staff have confirmed an API-recorded payment", () => {
    expect(apiStatus({ status: "paid", payment_method: "qr" })).toBe("paid");
  });
});

describe("sourceLabel", () => {
  it("shows the chatbot as WhatsApp and leaves other sources to the caller", () => {
    expect(sourceLabel("chatbot-wa")).toBe("WhatsApp");
    expect(sourceLabel("facebook")).toBeNull();
    expect(sourceLabel(null)).toBeNull();
  });
});
