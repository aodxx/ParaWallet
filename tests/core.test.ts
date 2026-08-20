import { describe, expect, it } from "vitest";
import { newRequestId } from "../src/api";

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
});
