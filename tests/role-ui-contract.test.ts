import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

describe("role-aware UI contract", () => {
  it("only exposes sale, receipt, and settlement creation modals to Tapper", () => {
    expect(app).toContain('showSaleForm && role === "tapper"');
    expect(app).toContain('showReceiptForm && role === "tapper"');
    expect(app).toContain('showSettlementForm && role === "tapper"');
  });

  it("only exposes garden and agreement creation modals to Owner", () => {
    expect(app).toContain('showGardenForm && role === "owner"');
    expect(app).toContain('showAgreementForm && role === "owner"');
  });

  it("replaces Owner creation actions with review and report navigation", () => {
    expect(app).toContain("ตรวจสอบรายการขาย");
    expect(app).toContain("onReports");
    expect(app).toContain('role === "tapper" && <button className="primary" onClick={onSale}');
  });
});
