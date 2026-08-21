export type SaleCalculationInput = {
  weightKg: number;
  unitPrice: number;
  buyerDeductions?: number;
  sharedExpenses?: number;
  ownerPercentage: number;
  tapperPercentage: number;
};

export type SaleCalculation = {
  grossSale: number;
  deductions: number;
  splitBase: number;
  ownerShare: number;
  tapperShare: number;
};

export type SettlementAllocationCandidate = {
  saleId: string;
  ownerShare: number;
  alreadyAllocated: number;
};

const round = (value: number) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export function calculateSale(input: SaleCalculationInput): SaleCalculation {
  const grossSale = round(input.weightKg * input.unitPrice);
  const deductions = round((input.buyerDeductions || 0) + (input.sharedExpenses || 0));
  const splitBase = round(grossSale - deductions);
  if (input.weightKg <= 0 || input.unitPrice < 0) throw new Error("SALE_INPUT_INVALID");
  if (input.buyerDeductions !== undefined && input.buyerDeductions < 0) throw new Error("DEDUCTION_INVALID");
  if (input.sharedExpenses !== undefined && input.sharedExpenses < 0) throw new Error("DEDUCTION_INVALID");
  if (splitBase < 0) throw new Error("SPLIT_BASE_NEGATIVE");
  if (round(input.ownerPercentage + input.tapperPercentage) !== 100) throw new Error("PERCENTAGES_MUST_SUM_TO_100");
  const ownerShare = round(splitBase * input.ownerPercentage / 100);
  return { grossSale, deductions, splitBase, ownerShare, tapperShare: round(splitBase - ownerShare) };
}

export function validateAgreementWindow(effectiveFrom: string, effectiveTo: string | undefined, date: string): boolean {
  const target = new Date(date).getTime();
  const from = new Date(effectiveFrom).getTime();
  const to = effectiveTo ? new Date(effectiveTo).getTime() : Infinity;
  return !Number.isNaN(target) && !Number.isNaN(from) && target >= from && target <= to;
}

export function allocateSettlement(amount: number, candidates: SettlementAllocationCandidate[]) {
  if (amount <= 0) throw new Error("SETTLEMENT_AMOUNT_INVALID");
  let remaining = round(amount);
  const allocations: Array<{ saleId: string; amount: number }> = [];
  for (const candidate of candidates) {
    if (remaining <= 0) break;
    const available = Math.max(0, round(candidate.ownerShare - candidate.alreadyAllocated));
    const allocated = round(Math.min(remaining, available));
    if (allocated > 0) {
      allocations.push({ saleId: candidate.saleId, amount: allocated });
      remaining = round(remaining - allocated);
    }
  }
  if (remaining !== 0) throw new Error("SETTLEMENT_ALLOCATION_MISMATCH");
  return allocations;
}

export function assertActiveTapperMember(member: { role: string; status: string } | undefined) {
  if (!member || member.role !== "tapper" || member.status !== "active") throw new Error("TAPPER_NOT_ACTIVE_MEMBER");
  return true;
}
