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

export function canCancelSettlement(status: string, role: string): boolean {
  return role === "tapper" && status === "pending_owner_confirmation";
}

export function resolveDispute(status: string, decision: string): "resolved" | "rejected" {
  if (!["open", "under_review"].includes(status)) throw new Error("DISPUTE_NOT_RESOLVABLE");
  if (!["resolved", "rejected"].includes(decision)) throw new Error("DISPUTE_DECISION_INVALID");
  return decision as "resolved" | "rejected";
}

export function calculateOcrValidationScore(fields: Record<string, unknown>): number {
  let score = 0;
  if (fields.saleDate) score += 10;
  if (fields.buyerName) score += 10;
  if (fields.productType) score += 10;
  if (Number(fields.weightKg) > 0) score += 15;
  if (Number(fields.unitPrice) > 0) score += 15;
  if (Number(fields.grossSale) > 0) score += 15;
  if (Number(fields.weightKg) > 0 && Number(fields.unitPrice) > 0 && Number(fields.grossSale) > 0 && Math.abs(Number(fields.weightKg) * Number(fields.unitPrice) - Number(fields.grossSale)) <= 0.02) score += 20;
  if (Number(fields.buyerDeductions ?? 0) >= 0) score += 5;
  return score;
}

export function classifyOcrScore(score: number): "high" | "recommended" | "mandatory" {
  return score >= 90 ? "high" : score >= 80 ? "recommended" : "mandatory";
}

export function validateAgreementPercentages(ownerPercentage: number, tapperPercentage: number): boolean {
  if (ownerPercentage < 0 || tapperPercentage < 0 || ownerPercentage > 100 || tapperPercentage > 100) throw new Error("PERCENTAGE_OUT_OF_RANGE");
  if (Math.round((ownerPercentage + tapperPercentage) * 100) / 100 !== 100) throw new Error("PERCENTAGES_MUST_SUM_TO_100");
  return true;
}

export function isDuplicateSale(candidate: { gardenId: string; saleDate: string; buyerName?: string; weightKg?: number; grossSale?: number }, existing: Array<{ gardenId: string; saleDate: string; buyerName?: string; weightKg?: number; grossSale?: number }>): boolean {
  return existing.some((row) => row.gardenId === candidate.gardenId && row.saleDate === candidate.saleDate && (row.buyerName || "").trim().toLowerCase() === (candidate.buyerName || "").trim().toLowerCase() && Math.abs(Number(row.weightKg || 0) - Number(candidate.weightKg || 0)) <= 0.01 && Math.abs(Number(row.grossSale || 0) - Number(candidate.grossSale || 0)) <= 0.01);
}

export function reconcileWallet(entitlement: number, received: number): { outstanding: number; balanced: boolean } {
  const outstanding = Math.max(0, Math.round((entitlement - received + Number.EPSILON) * 100) / 100);
  return { outstanding, balanced: outstanding === 0 };
}

export function canConfirmSale(status: string, role: string): boolean {
  return role === "owner" && status === "pending_owner_review";
}

export function canDisputeSale(status: string, role: string): boolean {
  return (role === "owner" || role === "tapper") && ["pending_owner_review", "confirmed"].includes(status);
}

export function canResolveDispute(status: string, role: string): boolean {
  return role === "owner" && ["open", "under_review"].includes(status);
}

export function canCreateAdjustment(saleStatus: string, role: string): boolean {
  return role === "owner" && saleStatus === "confirmed";
}

export function isIdempotentReplay(storedRequestId: string | undefined, requestId: string): boolean {
  return Boolean(storedRequestId && requestId && storedRequestId === requestId);
}
