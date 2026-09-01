import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const code = readFileSync(new URL("../appsscript/Code.gs", import.meta.url), "utf8");
const ocrSource = code.match(/var OCR = \{[\s\S]*?\n\};/)?.[0] || "";

type OcrResult = {
  score: number;
  confidence: number;
  needsReview: boolean;
  reviewLevel: string;
  fields: Record<string, unknown>;
};

const OCR = new Function(`
  function round_(value) { return Math.round((Number(value) + Number.EPSILON) * 100) / 100; }
  function numeric_(value) { var number = Number(value); return isFinite(number) ? number : 0; }
  var PARAWALLET_RELEASE = "2026.09.01-financial-clarity-v11";
  var Config = { geminiModel: function () { return "gemini-3.7-flash"; }, geminiKey: function () { return "configured-for-unit-test"; } };
  ${ocrSource}
  return OCR;
`)() as {
  scored_: (provider: string, fields: Record<string, unknown>) => OcrResult;
  interactionText_: (body: Record<string, unknown>) => string;
  providerErrorCode_: (error: unknown) => string;
  providerConnectionTest_: () => Record<string, unknown>;
  gemini_: (...args: unknown[]) => unknown;
  responseShapeValid_: (fields: Record<string, unknown>) => boolean;
};

describe("Apps Script OCR deterministic reference scenarios", () => {
  it("returns only allowlisted provider self-test error codes", () => {
    expect(OCR.providerErrorCode_(new Error("GEMINI_HTTP_401"))).toBe("GEMINI_HTTP_401");
    expect(OCR.providerErrorCode_(new Error("OCR_PROVIDER_INVALID_JSON"))).toBe("OCR_PROVIDER_INVALID_JSON");
    expect(OCR.providerErrorCode_(new Error("OCR_PROVIDER_SCHEMA_MISMATCH"))).toBe("OCR_PROVIDER_SCHEMA_MISMATCH");
    expect(OCR.providerErrorCode_(new Error("secret-looking provider response"))).toBe("GEMINI_SELF_TEST_FAILED");
  });

  it("requires every structured-output field that the production schema marks as required", () => {
    const valid = { documentClass: "not_receipt", receiptType: "unknown", weightEntriesKg: [], uncertainFields: [], warnings: [], needsReview: true };
    expect(OCR.responseShapeValid_(valid)).toBe(true);
    expect(OCR.responseShapeValid_({ ...valid, needsReview: undefined })).toBe(false);
    expect(OCR.responseShapeValid_({ ...valid, weightEntriesKg: "" })).toBe(false);
  });

  it("reports a successful image and structured-output provider self-test without model content", () => {
    const originalGemini = OCR.gemini_;
    OCR.gemini_ = () => ({
      provider: "gemini:gemini-3.7-flash",
      fields: {
        documentClass: "not_receipt",
        receiptType: "unknown",
        weightEntriesKg: [],
        uncertainFields: [],
        warnings: [],
        needsReview: true,
      },
    });
    try {
      expect(OCR.providerConnectionTest_()).toMatchObject({
        ok: true,
        provider: "gemini",
        model: "gemini-3.7-flash",
        release: "2026.09.01-financial-clarity-v11",
        imageInput: true,
        structuredOutput: true,
        code: "GEMINI_CONNECTION_OK",
      });
    } finally {
      OCR.gemini_ = originalGemini;
    }
  });

  it("reads structured JSON text from the last Interactions model output", () => {
    const text = OCR.interactionText_({
      steps: [
        { type: "thought", summary: [{ type: "text", text: "internal" }] },
        { type: "model_output", content: [{ type: "text", text: '{"documentClass":"rubber_receipt"}' }] },
      ],
    });
    expect(text).toBe('{"documentClass":"rubber_receipt"}');
  });

  it("normalizes the two-row weigh ticket reference values", () => {
    const result = OCR.scored_("reference", {
      documentClass: "rubber_receipt",
      receiptType: "weigh_ticket",
      saleDate: "14/1/69",
      buyerName: "จุดรับซื้อ",
      productType: "ขี้ยาง",
      weightEntriesKg: [175, 149],
      grossWeightKg: 324,
      unitPrice: 29,
      grossSale: 9396,
      uncertainFields: [],
      warnings: [],
      needsReview: false,
    });
    expect(result.fields).toMatchObject({ saleDate: "2026-01-14", grossWeightKg: 324, netWeightKg: 324, weightKg: 324 });
    expect(result).toMatchObject({ score: 100, confidence: 1, needsReview: false, reviewLevel: "high" });
  });

  it("normalizes eleven weight rows, basket tare, and half-baht rounding", () => {
    const result = OCR.scored_("reference", {
      documentClass: "rubber_receipt",
      receiptType: "weigh_ticket",
      saleDate: "15/1/69",
      buyerName: "ร้านรับซื้อยางพารา",
      productType: "ขี้ยาง",
      weightEntriesKg: [36, 41, 42, 35, 38, 43, 51, 49, 39, 39, 35.5],
      tareWeightKg: 17,
      netWeightKg: 431.5,
      unitPrice: 27,
      grossSale: 11650,
      uncertainFields: [],
      warnings: [],
      needsReview: false,
    });
    expect(result.fields).toMatchObject({ saleDate: "2026-01-15", grossWeightKg: 448.5, tareWeightKg: 17, netWeightKg: 431.5, weightKg: 431.5 });
    expect(result.score).toBe(100);
  });

  it("never scores a blank form or promotional example as a sale", () => {
    for (const documentClass of ["blank_template", "promotional_example", "not_receipt"]) {
      const result = OCR.scored_("reference", { documentClass, receiptType: "rubber_form", weightKg: 99, unitPrice: 99, grossSale: 9801, uncertainFields: [], warnings: [], needsReview: true });
      expect(result).toMatchObject({ score: 0, needsReview: true, reviewLevel: "mandatory" });
    }
  });
});
