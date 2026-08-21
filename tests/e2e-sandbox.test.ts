import { describe, expect, it } from "vitest";
import {
  allocateSettlement,
  assertActiveTapperMember,
  calculateSale,
  canConfirmSale,
  isIdempotentReplay,
  reconcileWallet,
  validateAgreementWindow,
} from "../src/financial";

type Status = "pending_owner_review" | "confirmed";
type SettlementStatus = "pending_owner_confirmation" | "confirmed";

type SandboxSale = {
  id: string;
  requestId: string;
  ticketNumber: string;
  status: Status;
  ownerShare: number;
  tapperShare: number;
  grossSale: number;
  deductions: number;
  splitBase: number;
};

type SandboxSettlement = {
  id: string;
  requestId: string;
  status: SettlementStatus;
  amount: number;
};

class SandboxE2E {
  readonly gardenId = "sandbox-garden-pahpayom";
  readonly ownerId = "sandbox-owner";
  readonly tapperId = "sandbox-tapper";
  readonly agreement = {
    id: "sandbox-agreement-v1",
    gardenId: this.gardenId,
    ownerId: this.ownerId,
    tapperId: this.tapperId,
    ownerPercentage: 60,
    tapperPercentage: 40,
    effectiveFrom: "2026-08-21",
    effectiveTo: "",
    status: "active" as const,
  };
  readonly sales: SandboxSale[] = [];
  readonly settlements: SandboxSettlement[] = [];
  readonly walletEntries: Array<{ walletUserId: string; saleId?: string; settlementId?: string; type: string; amount: number; status: string }> = [];
  readonly allocations: Array<{ settlementId: string; saleId: string; amount: number }> = [];
  readonly audit: Array<{ action: string; entityId: string; requestId: string }> = [];
  readonly requests = new Map<string, unknown>();

  private replay<T>(requestId: string, action: () => T): T {
    if (this.requests.has(requestId)) return this.requests.get(requestId) as T;
    const value = action();
    this.requests.set(requestId, value);
    return value;
  }

  createSale(requestId: string): SandboxSale {
    return this.replay(requestId, () => {
      assertActiveTapperMember({ role: "tapper", status: "active" });
      if (!validateAgreementWindow(this.agreement.effectiveFrom, this.agreement.effectiveTo, "2026-08-21")) throw new Error("AGREEMENT_NOT_ACTIVE");
      const calculation = calculateSale({
        weightKg: 100,
        unitPrice: 60,
        buyerDeductions: 100,
        sharedExpenses: 50,
        ownerPercentage: this.agreement.ownerPercentage,
        tapperPercentage: this.agreement.tapperPercentage,
      });
      const sale: SandboxSale = {
        id: "sandbox-sale-001",
        requestId,
        ticketNumber: "SANDBOX-E2E-001",
        status: "pending_owner_review",
        ownerShare: calculation.ownerShare,
        tapperShare: calculation.tapperShare,
        grossSale: calculation.grossSale,
        deductions: calculation.deductions,
        splitBase: calculation.splitBase,
      };
      this.sales.push(sale);
      this.walletEntries.push(
        { walletUserId: this.ownerId, saleId: sale.id, type: "sale_entitlement", amount: sale.ownerShare, status: "pending" },
        { walletUserId: this.tapperId, saleId: sale.id, type: "tapper_income", amount: sale.tapperShare, status: "pending" },
      );
      this.audit.push({ action: "sale_created", entityId: sale.id, requestId });
      return sale;
    });
  }

  confirmSale(saleId: string, requestId: string): SandboxSale {
    return this.replay(requestId, () => {
      const sale = this.sales.find((item) => item.id === saleId);
      if (!sale) throw new Error("SALE_NOT_FOUND");
      if (!canConfirmSale(sale.status, "owner")) throw new Error("SALE_NOT_REVIEWABLE");
      sale.status = "confirmed";
      this.walletEntries.filter((entry) => entry.saleId === sale.id).forEach((entry) => (entry.status = "confirmed"));
      this.audit.push({ action: "sale_confirmed", entityId: sale.id, requestId });
      return sale;
    });
  }

  createSettlement(requestId: string, amount: number): SandboxSettlement {
    return this.replay(requestId, () => {
      const sale = this.sales.find((item) => item.status === "confirmed");
      if (!sale) throw new Error("CONFIRMED_SALE_REQUIRED");
      const received = this.allocations.filter((item) => item.saleId === sale.id).reduce((sum, item) => sum + item.amount, 0);
      const outstanding = reconcileWallet(sale.ownerShare, received).outstanding;
      if (amount <= 0 || amount > outstanding) throw new Error("SETTLEMENT_AMOUNT_INVALID");
      const settlement: SandboxSettlement = { id: "sandbox-settlement-001", requestId, status: "pending_owner_confirmation", amount };
      this.settlements.push(settlement);
      this.audit.push({ action: "settlement_created", entityId: settlement.id, requestId });
      return settlement;
    });
  }

  confirmSettlement(settlementId: string, requestId: string): SandboxSettlement {
    return this.replay(requestId, () => {
      const settlement = this.settlements.find((item) => item.id === settlementId);
      const sale = this.sales.find((item) => item.status === "confirmed");
      if (!settlement || !sale) throw new Error("SETTLEMENT_NOT_FOUND");
      const prior = this.allocations.filter((item) => item.saleId === sale.id).reduce((sum, item) => sum + item.amount, 0);
      const allocation = allocateSettlement(settlement.amount, [{ saleId: sale.id, ownerShare: sale.ownerShare, alreadyAllocated: prior }]);
      this.allocations.push(...allocation.map((item) => ({ settlementId: settlement.id, saleId: item.saleId, amount: item.amount })));
      settlement.status = "confirmed";
      this.walletEntries.push({ walletUserId: this.ownerId, settlementId: settlement.id, type: "settlement_owner_received", amount: settlement.amount, status: "confirmed" });
      this.audit.push({ action: "settlement_confirmed", entityId: settlement.id, requestId });
      return settlement;
    });
  }
}

describe("sandbox E2E — controlled fixture only", () => {
  it("completes Sale → Owner Confirm → Settlement → Owner Confirm", () => {
    const app = new SandboxE2E();
    const sale = app.createSale("SANDBOX-E2E-001-SALE");
    expect(sale).toMatchObject({ status: "pending_owner_review", grossSale: 6000, deductions: 150, splitBase: 5850, ownerShare: 3510, tapperShare: 2340 });
    app.confirmSale(sale.id, "SANDBOX-E2E-001-SALE-CONFIRM");
    const settlement = app.createSettlement("SANDBOX-E2E-001-SETTLEMENT", 2000);
    expect(settlement.status).toBe("pending_owner_confirmation");
    app.confirmSettlement(settlement.id, "SANDBOX-E2E-001-SETTLEMENT-CONFIRM");
    expect(app.settlements[0].status).toBe("confirmed");
  });

  it("keeps Tapper income unchanged while Owner outstanding decreases", () => {
    const app = new SandboxE2E();
    const sale = app.createSale("SANDBOX-E2E-002-SALE");
    app.confirmSale(sale.id, "SANDBOX-E2E-002-SALE-CONFIRM");
    const before = reconcileWallet(sale.ownerShare, 0);
    const settlement = app.createSettlement("SANDBOX-E2E-002-SETTLEMENT", 2000);
    app.confirmSettlement(settlement.id, "SANDBOX-E2E-002-SETTLEMENT-CONFIRM");
    const received = app.allocations.reduce((sum, item) => sum + item.amount, 0);
    expect(before.outstanding).toBe(3510);
    expect(reconcileWallet(sale.ownerShare, received).outstanding).toBe(1510);
    expect(sale.tapperShare).toBe(2340);
  });

  it("replays identical request IDs without duplicate rows", () => {
    const app = new SandboxE2E();
    const first = app.createSale("SANDBOX-E2E-003-SALE");
    const replay = app.createSale("SANDBOX-E2E-003-SALE");
    expect(replay).toEqual(first);
    expect(app.sales).toHaveLength(1);
    expect(isIdempotentReplay(first.requestId, "SANDBOX-E2E-003-SALE")).toBe(true);
  });

  it("does not confirm a Sale as Tapper", () => {
    const app = new SandboxE2E();
    const sale = app.createSale("SANDBOX-E2E-004-SALE");
    expect(canConfirmSale(sale.status, "tapper")).toBe(false);
  });

  it("records all auditable state transitions", () => {
    const app = new SandboxE2E();
    const sale = app.createSale("SANDBOX-E2E-005-SALE");
    app.confirmSale(sale.id, "SANDBOX-E2E-005-SALE-CONFIRM");
    const settlement = app.createSettlement("SANDBOX-E2E-005-SETTLEMENT", 2000);
    app.confirmSettlement(settlement.id, "SANDBOX-E2E-005-SETTLEMENT-CONFIRM");
    expect(app.audit.map((event) => event.action)).toEqual(["sale_created", "sale_confirmed", "settlement_created", "settlement_confirmed"]);
    expect(app.walletEntries.filter((entry) => entry.saleId === sale.id)).toHaveLength(2);
    expect(app.walletEntries.filter((entry) => entry.settlementId === settlement.id)).toHaveLength(1);
  });
});
