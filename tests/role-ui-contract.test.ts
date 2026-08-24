import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const loader = readFileSync(new URL("../src/LoadingAnimation.tsx", import.meta.url), "utf8");
const serviceWorker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const loadingAnimation = JSON.parse(readFileSync(new URL("../public/loading/animation.json", import.meta.url), "utf8"));

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
    expect(app).toContain("รายการขายรอตรวจ");
    expect(app).toContain("การส่งเงินรอยืนยัน");
    expect(app).toContain("onReports");
    expect(app).toContain('role === "tapper" && <button className="primary" onClick={onSale}');
  });

  it("shows separate pending and unread badges and opens notification targets", () => {
    expect(app).toContain("const pendingSales = data.pendingSales || 0");
    expect(app).toContain("const pendingSettlements = data.pendingSettlements || 0");
    expect(app).toContain("const unreadNotifications = data.unreadNotifications");
    expect(app).toContain('pendingSettlements > 0 && <em>{pendingSettlements}</em>');
    expect(app).toContain('unreadNotifications > 0 && <em>{unreadNotifications}</em>');
    expect(app).toContain("const openNotification = async (item: Notification)");
    expect(app).toContain("notificationRows.filter((item) => !item.readAt).length");
    expect(app).toContain("notificationTargetScreen(item.type)");
    expect(app).toContain("await api.notifications.read(item.id)");
    expect(app).toContain('await refresh(target)');
    expect(app).toContain('className={`data-row notification-row');
  });

  it("does not refetch the heavy dashboard before every tab", () => {
    expect(app).toContain('if (target === "overview" || !dashboard.garden?.id)');
    expect(app).toContain('screen === "settlements" && (!loading || settlements.length > 0)');
    expect(app).toContain('screen === "notifications" && (!loading || notifications.length > 0)');
  });

  it("keeps last successful data visible when an optional read model fails", () => {
    expect(app).toContain("Promise.allSettled");
    expect(app).toContain('type ConnectionState = "connecting" | "connected" | "degraded" | "disconnected"');
    expect(app).toContain('setConnectionState("degraded")');
    expect(app).toContain("ข้อมูลหลักเชื่อมต่อแล้ว แต่ข้อมูลบางส่วนยังไม่อัปเดต");
    expect(app).toContain("refreshSequenceRef");
    expect(app).toContain("if (dashboard.walletDetails) setWallet(dashboard.walletDetails)");
    expect(app).not.toContain("api.gardens.list(), api.agreements.list(garden.id), api.wallets.me(garden.id)");
  });

  it("does not render an Owner or Tapper dashboard before role verification finishes", () => {
    expect(app).toContain("if (!hasSuccessfulSyncRef.current) return <InitialSyncScreen");
    expect(app).toContain("กำลังเตรียม ParaWallet");
    expect(app).toContain("ยังไม่แสดงหน้าของ Owner หรือ Tapper จนกว่าจะตรวจสอบสิทธิ์สำเร็จ");
  });

  it("uses the supplied local Lottie animation for stable loading states", () => {
    expect(app).toContain('import LoadingAnimation from "./LoadingAnimation"');
    expect(app).toContain('className="screen-stage" aria-busy={loading}');
    expect(app).toContain('className="loading-overlay"');
    expect(app).toContain('LoadingAnimation compact label="กำลังโหลดใบเสร็จ"');
    expect(app).toContain('LoadingAnimation compact label="กำลังโหลดสลิป"');
    expect(app).not.toContain("กำลังโหลดข้อมูลจาก Google Apps Script...");
    expect(loader).toContain("vendor/lottie_light.min.js");
    expect(loader).toContain("loading/animation.json");
    expect(styles).toContain(".content.is-loading .screen-content{visibility:hidden;opacity:0}");
    expect(serviceWorker).toContain("vendor/lottie_light.min.js");
    expect(serviceWorker).toContain("loading/animation.json");
    expect(loadingAnimation).toMatchObject({ w: 124, h: 124, ip: 0, op: 31 });
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
    expect(app).toContain("สลิปต้องเป็นรูปภาพหรือไฟล์ PDF เท่านั้น");
    expect(app).toContain("Owner ต้องกดยืนยันว่าได้รับเงินสดแล้ว");
    expect(app).toContain("ยืนยันว่าได้รับเงินสดแล้ว");
    expect(app).toContain("ตรวจรายละเอียดการส่งเงิน");
    expect(app).toContain("ฉันตรวจสลิปและพบยอดเงินเข้าจริงแล้ว");
    expect(app).toContain("ฉันตรวจนับและได้รับเงินสดจริงแล้ว");
    expect(app).toContain("api.settlements.evidence");
    expect(app).not.toContain("https://drive.google.com/file/d/");
  });

  it("keeps settlement confirmation reachable above the mobile bottom navigation", () => {
    expect(app).toContain('className="sale-review settlement-review"');
    expect(styles).toContain(".modal-backdrop{z-index:40}");
    expect(styles).toContain("max-height:calc(100dvh - 12px)");
    expect(styles).toContain(".settlement-review .sale-review-actions{position:sticky");
  });

  it("requires Owner to review receipt evidence and calculations before confirmation", () => {
    expect(app).toContain("SaleReviewModal");
    expect(app).toContain("ตรวจหลักฐานและตัวเลขแล้ว");
    expect(app).toContain("api.sales.receipt");
    expect(app).toContain("หลักฐานใบเสร็จ");
    expect(app).toContain("ฐานแบ่งเงิน");
    expect(app).toContain("ยืนยันรายการขาย");
    expect(app).not.toContain("await api.sales.confirm(sale.id); onRefresh();");
  });

  it("links the scanned Receipt record and garden scope into Sale creation", () => {
    expect(app).toContain("gardenId: garden.id, data, mimeType: selected.type");
    expect(app).toContain("setReceiptId");
    expect(app).toContain("agreementId: agreement.id, receiptId");
    expect(app).toContain("!receiptId || !receiptFileId");
  });
});
