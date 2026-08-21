import { describe, expect, it } from "vitest";
import { newRequestId } from "../src/api";
import { allocateSettlement, assertActiveTapperMember, calculateOcrValidationScore, calculateSale, canCancelSettlement, resolveDispute, validateAgreementWindow } from "../src/financial";

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
  it("scores OCR from field completeness and arithmetic validation instead of provider constants", () => {
    const score = calculateOcrValidationScore({ saleDate: "2026-08-21", buyerName: "Buyer", productType: "Latex", weightKg: 100, unitPrice: 50, grossSale: 5000, buyerDeductions: 0 });
    expect(score).toBe(100);
    expect(calculateOcrValidationScore({ weightKg: 100, unitPrice: 50, grossSale: 5200 })).toBe(50);
  });
});
