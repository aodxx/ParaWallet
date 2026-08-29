import { describe, expect, it } from "vitest";
import { newRequestId } from "../src/api";
import { normalizeOcrFields, normalizeReceiptDate, receiptReviewGate, receiptScanFeedback, receiptTypeLabel, validateReceiptMath } from "../src/ocr";
import { allocateSettlement, assertActiveTapperMember, calculateSale, canCancelSettlement, canConfirmSale, canCreateAdjustment, canDisputeSale, canResolveDispute, isDuplicateSale, isIdempotentReplay, reconcileWallet, resolveDispute, validateAgreementPercentages, validateAgreementWindow } from "../src/financial";

type SplitInput = { grossSale: number; buyerDeductions?: number; sharedExpenses?: number; ownerPercentage: number; tapperPercentage: number };
function calculate(input: SplitInput) {
  const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const base = round(input.grossSale - (input.buyerDeductions || 0) - (input.sharedExpenses || 0));
  if (base < 0) throw new Error("SPLIT_BASE_NEGATIVE");
  if (round(input.ownerPercentage + input.tapperPercentage) !== 100) throw new Error("PERCENTAGES_MUST_SUM_TO_100");
  const owner = round(base * input.ownerPercentage / 100);
  return { base, owner, tapper: round(base - owner) };
}

describe("ParaWallet core safeguards", () => {
  it("creates unique request ids for idempotent API mutations", () => {
    const first = newRequestId();
    const second = newRequestId();
    expect(first).not.toBe(second);
    expect(first).toMatch(/^\d+-/);
  });
  it("balances the dual wallet after deductions", () => {
    const result = calculate({ grossSale: 10000, buyerDeductions: 500, sharedExpenses: 300, ownerPercentage: 60, tapperPercentage: 40 });
    expect(result.base).toBe(9200);
    expect(result.owner + result.tapper).toBe(result.base);
  });
  it("rejects invalid percentage contracts", () => {
    expect(() => calculate({ grossSale: 100, ownerPercentage: 70, tapperPercentage: 20 })).toThrow("PERCENTAGES_MUST_SUM_TO_100");
  });
  it("keeps server-equivalent sale calculation authoritative", () => {
    const result = calculateSale({ weightKg: 100, unitPrice: 50, buyerDeductions: 200, sharedExpenses: 100, ownerPercentage: 60, tapperPercentage: 40 });
    expect(result.grossSale).toBe(5000);
    expect(result.splitBase).toBe(4700);
    expect(result.ownerShare + result.tapperShare).toBe(result.splitBase);
  });
  it("rejects negative deductions and invalid sale input", () => {
    expect(() => calculateSale({ weightKg: 0, unitPrice: 50, ownerPercentage: 60, tapperPercentage: 40 })).toThrow("SALE_INPUT_INVALID");
    expect(() => calculateSale({ weightKg: 10, unitPrice: 50, buyerDeductions: -1, ownerPercentage: 60, tapperPercentage: 40 })).toThrow("DEDUCTION_INVALID");
  });
  it("accepts only sales inside the agreement effective window", () => {
    expect(validateAgreementWindow("2026-01-01", "2026-12-31", "2026-06-30")).toBe(true);
    expect(validateAgreementWindow("2026-01-01", "2026-12-31", "2027-01-01")).toBe(false);
  });
  it("requires an active tapper garden member", () => {
    expect(assertActiveTapperMember({ role: "tapper", status: "active" })).toBe(true);
    expect(() => assertActiveTapperMember({ role: "owner", status: "active" })).toThrow("TAPPER_NOT_ACTIVE_MEMBER");
    expect(() => assertActiveTapperMember({ role: "tapper", status: "disabled" })).toThrow("TAPPER_NOT_ACTIVE_MEMBER");
  });
  it("allocates a confirmed settlement without exceeding sale entitlements", () => {
    const allocations = allocateSettlement(800, [
      { saleId: "sale-1", ownerShare: 500, alreadyAllocated: 100 },
      { saleId: "sale-2", ownerShare: 600, alreadyAllocated: 0 },
    ]);
    expect(allocations).toEqual([{ saleId: "sale-1", amount: 400 }, { saleId: "sale-2", amount: 400 }]);
    expect(() => allocateSettlement(1201, [{ saleId: "sale-1", ownerShare: 1200, alreadyAllocated: 0 }])).toThrow("SETTLEMENT_ALLOCATION_MISMATCH");
  });
  it("allows only a tapper to cancel a pending settlement", () => {
    expect(canCancelSettlement("pending_owner_confirmation", "tapper")).toBe(true);
    expect(canCancelSettlement("confirmed", "tapper")).toBe(false);
    expect(canCancelSettlement("pending_owner_confirmation", "owner")).toBe(false);
  });
  it("resolves disputes only from open or under-review states", () => {
    expect(resolveDispute("open", "resolved")).toBe("resolved");
    expect(resolveDispute("under_review", "rejected")).toBe("rejected");
    expect(() => resolveDispute("confirmed", "resolved")).toThrow("DISPUTE_NOT_RESOLVABLE");
    expect(() => resolveDispute("open", "cancelled")).toThrow("DISPUTE_DECISION_INVALID");
  });
  it("normalizes weigh tickets into the existing Sale fields", () => {
    const fields = normalizeOcrFields({ documentClass: "rubber_receipt", receiptType: "weigh_ticket", saleDate: "14/1/69", buyer: "จุดรับซื้อ", productType: "ขี้ยาง", weightEntriesKg: [175, 149], grossWeight: "324", price: "29", totalAmount: "9396", needsReview: false });
    expect(fields.receiptType).toBe("weigh_ticket");
    expect(fields.saleDate).toBe("2026-01-14");
    expect(fields.grossWeightKg).toBe("324");
    expect(fields.netWeightKg).toBe("324");
    expect(fields.weightKg).toBe("324");
    expect(fields.unitPrice).toBe("29");
    expect(fields.grossSale).toBe("9396");
    expect(validateReceiptMath(fields)).toEqual({ weightConsistent: null, entrySumConsistent: true, netWeightConsistent: true, amountConsistent: true });
    expect(receiptReviewGate(fields, true)).toEqual({ canSubmit: true, reasons: [] });
    expect(receiptTypeLabel(fields.receiptType)).toContain("ราคาต่อกิโล");
  });

  it("turns missing OCR configuration into an actionable Thai status", () => {
    expect(receiptScanFeedback({ provider: "none", systemState: "not_configured", warnings: ["OCR_PROVIDER_UNAVAILABLE"] })).toMatchObject({ kind: "unavailable", allowReview: false, retryable: false, title: "ระบบอ่านบิลยังไม่ได้เปิดใช้งาน" });
  });

  it("hides raw all-field uncertainty from users", () => {
    const feedback = receiptScanFeedback({ provider: "gemini:gemini-3.7-flash", documentClass: "rubber_receipt", uncertainFields: ["all", "unitPrice"], score: 40 });
    expect(feedback.detail).toContain("ราคาต่อกิโล");
    expect(feedback.detail).not.toContain("all");
  });

  it("supports a multi-row cash bill with basket tare and one-baht shop rounding", () => {
    const fields = normalizeOcrFields({ documentClass: "rubber_receipt", receiptType: "weigh_ticket", saleDate: "15/1/69", buyerName: "ร้านรับซื้อยางพารา", productType: "ขี้ยาง", weightEntriesKg: [36, 41, 42, 35, 38, 43, 51, 49, 39, 39, 35.5], tareWeightKg: 17, netWeightKg: 431.5, unitPrice: 27, grossSale: 11650, needsReview: false });
    expect(fields.saleDate).toBe("2026-01-15");
    expect(fields.grossWeightKg).toBe("448.5");
    expect(fields.tareWeightKg).toBe("17");
    expect(fields.weightKg).toBe("431.5");
    expect(validateReceiptMath(fields)).toEqual({ weightConsistent: null, entrySumConsistent: true, netWeightConsistent: true, amountConsistent: true });
  });

  it("normalizes rubber forms and flags inconsistent handwritten arithmetic", () => {
    const fields = normalizeOcrFields({ documentClass: "rubber_receipt", receiptType: "rubber_form", saleDate: "2026-01-15", buyerName: "ร้านน้ำยาง", productType: "น้ำยางสด", freshWeightKg: "99", drc: "49", dryWeightKg: "48.51", unitPrice: "99", grossSale: "4802", needsReview: false });
    expect(fields.weightKg).toBe("48.51");
    expect(validateReceiptMath(fields)).toEqual({ weightConsistent: true, entrySumConsistent: null, netWeightConsistent: null, amountConsistent: true });
    expect(validateReceiptMath({ ...fields, dryWeightKg: "40" }).weightConsistent).toBe(false);
  });

  it("rejects blank templates and promotional sample collages as sale evidence", () => {
    const template = normalizeOcrFields({ documentClass: "blank_template", receiptType: "rubber_form", needsReview: true });
    const promotion = normalizeOcrFields({ documentClass: "promotional_example", receiptType: "weigh_ticket", weightKg: 99, unitPrice: 99, grossSale: 9801, needsReview: true });
    expect(receiptReviewGate(template, true).canSubmit).toBe(false);
    expect(receiptReviewGate(promotion, true).reasons[0]).toContain("ไม่ใช่บิลขาย");
    expect(receiptReviewGate(normalizeOcrFields({ documentClass: "unreadable", receiptType: "weigh_ticket", saleDate: "2026-01-15", buyerName: "ร้าน", productType: "ขี้ยาง", weightKg: 100, unitPrice: 30, grossSale: 3000 }), true).canSubmit).toBe(false);
  });

  it("requires a human image check even when OCR arithmetic is complete", () => {
    const fields = normalizeOcrFields({ documentClass: "rubber_receipt", receiptType: "weigh_ticket", saleDate: "2026-01-15", buyerName: "ร้าน", productType: "ขี้ยาง", weightKg: 100, unitPrice: 30, grossSale: 3000, needsReview: false });
    expect(receiptReviewGate(fields, false).reasons).toContain("กรุณายืนยันว่าได้ตรวจตัวเลขกับภาพบิลแล้ว");
    expect(receiptReviewGate(fields, true).canSubmit).toBe(true);
  });

  it.each([["15/1/69", "2026-01-15"], ["15/1/2569", "2026-01-15"], ["2026-01-15", "2026-01-15"], ["31/2/69", ""]] as const)("normalizes Thai receipt date %s", (input, expected) => {
    expect(normalizeReceiptDate(input)).toBe(expected);
  });

  it.each([[60, 40], [100, 0], [0, 100]] as const)("accepts agreement percentages %s/%s", (owner, tapper) => {
    expect(validateAgreementPercentages(owner, tapper)).toBe(true);
  });
  it.each([[60, 30, "PERCENTAGES_MUST_SUM_TO_100"], [-1, 101, "PERCENTAGE_OUT_OF_RANGE"], [101, 0, "PERCENTAGE_OUT_OF_RANGE"]] as const)("rejects invalid agreement percentages %s/%s", (owner, tapper, error) => {
    expect(() => validateAgreementPercentages(owner, tapper)).toThrow(error);
  });
  it("detects duplicate sales only inside the same garden and matching business fields", () => {
    const existing = [{ gardenId: "g1", saleDate: "2026-08-21", buyerName: "Buyer A", weightKg: 100, grossSale: 5000 }];
    expect(isDuplicateSale({ gardenId: "g1", saleDate: "2026-08-21", buyerName: " buyer a ", weightKg: 100, grossSale: 5000 }, existing)).toBe(true);
    expect(isDuplicateSale({ gardenId: "g2", saleDate: "2026-08-21", buyerName: "Buyer A", weightKg: 100, grossSale: 5000 }, existing)).toBe(false);
    expect(isDuplicateSale({ gardenId: "g1", saleDate: "2026-08-22", buyerName: "Buyer A", weightKg: 100, grossSale: 5000 }, existing)).toBe(false);
  });
  it("reconciles wallet balances without allowing negative outstanding", () => {
    expect(reconcileWallet(5000, 3000)).toEqual({ outstanding: 2000, balanced: false });
    expect(reconcileWallet(5000, 5000)).toEqual({ outstanding: 0, balanced: true });
    expect(reconcileWallet(5000, 5200)).toEqual({ outstanding: 0, balanced: true });
  });
  it.each([["pending_owner_review", "owner", true], ["pending_owner_review", "tapper", false], ["confirmed", "owner", false], ["disputed", "owner", false]] as const)("sale confirmation authorization %s/%s = %s", (status, role, expected) => {
    expect(canConfirmSale(status, role)).toBe(expected);
  });
  it.each([["confirmed", "owner", true], ["confirmed", "tapper", true], ["pending_owner_review", "tapper", true], ["disputed", "tapper", false], ["confirmed", "viewer", false]] as const)("sale dispute authorization %s/%s = %s", (status, role, expected) => {
    expect(canDisputeSale(status, role)).toBe(expected);
  });
  it.each([["open", "owner", true], ["under_review", "owner", true], ["open", "tapper", false], ["resolved", "owner", false]] as const)("dispute resolution authorization %s/%s = %s", (status, role, expected) => {
    expect(canResolveDispute(status, role)).toBe(expected);
  });
  it.each([["confirmed", "owner", true], ["confirmed", "tapper", false], ["pending_owner_review", "owner", false], ["disputed", "owner", false]] as const)("adjustment authorization %s/%s = %s", (status, role, expected) => {
    expect(canCreateAdjustment(status, role)).toBe(expected);
  });
  it("replays only the exact stored RequestID", () => {
    expect(isIdempotentReplay("req-1", "req-1")).toBe(true);
    expect(isIdempotentReplay("req-1", "req-2")).toBe(false);
    expect(isIdempotentReplay(undefined, "req-1")).toBe(false);
  });
});
