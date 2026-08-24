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
    expect(app).toContain('showMemberForm && role === "owner"');
    expect(app).toContain('showAgreementForm && role === "owner"');
  });

  it("lets Owner manage registered Tapper accounts without typing internal IDs", () => {
    expect(app).toContain("เพิ่ม Tapper เข้าสวน");
    expect(app).toContain("api.members.add");
    expect(app).toContain("api.members.deactivate");
    expect(app).toContain("เลือก Tapper ในสวน");
    expect(app).not.toContain("Tapper ID<input");
  });

  it("replaces Owner creation actions with review and report navigation", () => {
    expect(app).toContain("ตรวจสอบรายการขาย");
    expect(app).toContain("onReports");
    expect(app).toContain('role === "tapper" && <button className="primary" onClick={onSale}');
  });

  it("does not refetch the heavy dashboard before every tab", () => {
    expect(app).toContain('if (target === "overview" || !dashboard.garden?.id)');
    expect(app).toContain('screen === "settlements" && (!loading || settlements.length > 0)');
    expect(app).toContain('screen === "notifications" && (!loading || notifications.length > 0)');
  });

  it("makes the dual wallet and direct camera scan Tapper's primary workflow", () => {
    expect(app).toContain('className="dual-wallet-priority"');
    expect(app).toContain('className="scan-receipt-cta"');
    expect(app).toContain('receiptCameraRef.current?.click()');
    expect(app).toContain('capture="environment"');
    expect(app).toContain('initialFile={receiptInitialFile}');
  });

  it("collects transfer evidence and explains cash confirmation", () => {
    expect(app).toContain("กรุณาแนบสลิปการโอนเงิน");
    expect(app).toContain("ไฟล์สลิปต้องมีขนาดไม่เกิน 4 MB");
    expect(app).toContain("Owner ต้องกดยืนยันว่าได้รับเงินสดแล้ว");
    expect(app).toContain("ยืนยันว่าได้รับเงินสดแล้ว");
    expect(app).toContain("ดูสลิปที่แนบ");
  });
});
