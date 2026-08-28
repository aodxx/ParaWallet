import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const loader = readFileSync(new URL("../src/LoadingAnimation.tsx", import.meta.url), "utf8");
const serviceWorker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const loadingAnimation = JSON.parse(readFileSync(new URL("../public/loading/animation.json", import.meta.url), "utf8"));
const splashLogo = readFileSync(new URL("../public/brand/splash-logo.png", import.meta.url));

describe("splash screen branding contract", () => {
  it("uses the supplied logo only for the splash variant and keeps default loading available", () => {
    expect(app).toContain('<LoadingAnimation variant="splash" label="กำลังเตรียม ParaWallet"');
    expect(loader).toContain('variant = "default"');
    expect(loader).toContain('if (variant === "splash") return;');
    expect(loader).toContain('variant === "splash"');
    expect(loader).toContain("brand/splash-logo.png");
    expect(loader).toContain("splash-shine");
    expect(splashLogo.byteLength).toBeGreaterThan(1000);
  });

  it("animates a masked shine and disables it for reduced motion", () => {
    expect(styles).toContain(".splash-shine");
    expect(styles).toContain("@keyframes splash-shine-sweep");
    expect(styles).toContain("@media(prefers-reduced-motion:reduce){.splash-shine");
  });
});

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
    expect(app).toContain("เพิ่มคนกรีด (Tapper) เข้าสวน");
    expect(app).toContain("api.members.add");
    expect(app).toContain("api.members.deactivate");
    expect(app).toContain("เลือกคนกรีด (Tapper) ในสวน");
    expect(app).not.toContain("Tapper ID<input");
  });

  it("replaces Owner creation actions with review and report navigation", () => {
    expect(app).toContain("รายการขายรอตรวจ");
    expect(app).toContain("การส่งเงินรอยืนยัน");
    expect(app).toContain("onReports");
    expect(app).toContain('role === "tapper" && <button className="primary" type="button" onClick={onSale}');
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
    expect(app).toContain("เจ้าของสวน (Owner) หรือคนกรีด (Tapper) จนกว่าจะตรวจสอบสิทธิ์สำเร็จ");
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
    expect(app).toContain('onReceipt={() => { setReceiptInitialFile(null); setShowReceiptForm(true); }}');
    expect(app).toContain('capture="environment"');
    expect(app).toContain('initialFile={receiptInitialFile}');
    expect(app).toContain("formatThaiDateTime(sale.saleDate)");
    expect(app).toContain("formatThaiDateTime(item.transferDate)");
    expect(app).toContain("screenDescription(screen, role)");
    expect(app).toContain('className="panel-actions settlement-confirm-actions settlement-row-actions"');
    expect(styles).toContain(".settlement-row-actions{grid-column:1/-1!important");
    expect(styles).toContain("margin-bottom:calc(140px + env(safe-area-inset-bottom))");
  });

  it("collects transfer evidence and explains cash confirmation", () => {
    expect(app).toContain("กรุณาแนบสลิปการโอนเงิน");
    expect(app).toContain("ไฟล์สลิปต้องมีขนาดไม่เกิน 4 MB");
    expect(app).toContain("สลิปต้องเป็นรูปภาพหรือไฟล์ PDF เท่านั้น");
    expect(app).toContain("เจ้าของสวน (Owner) ต้องกดยืนยันว่าได้รับเงินสดแล้ว");
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

  it("exposes both camera capture and device image selection for OCR", () => {
    expect(app).toContain('className="receipt-upload-actions"');
    expect(app).toContain('className="file-action secondary"><Camera');
    expect(app).toContain("ถ่ายภาพใบเสร็จ");
    expect(app).toContain("เลือกภาพจากเครื่อง");
    expect(app).toContain('accept="image/*" capture="environment"');
    expect(styles).toContain(".receipt-upload-actions");
    expect(styles).toContain(".receipt-upload-actions .file-action input");
  });

  it("links the scanned Receipt record and garden scope into Sale creation", () => {
    expect(app).toContain("gardenId: garden.id, data, mimeType: selected.type");
    expect(app).toContain("setReceiptId");
    expect(app).toContain("agreementId: agreement.id, receiptId");
    expect(app).toContain("!receiptId || !receiptFileId");
  });

  it("keeps the D12.2 mobile refinements scoped to layout and navigation UX", () => {
    expect(app).toContain("LogOut");
    expect(app).toContain('aria-labelledby="developer-credit-title"');
    expect(app).toContain('id="developer-credit-title"');
    expect(app).toContain('rel="noopener noreferrer"');
    expect(app).toContain("setShowMobileMore(false); handleSignOut()");
    expect(styles).toContain("max-height:82dvh");
    expect(styles).toContain("padding:18px 16px calc(28px + env(safe-area-inset-bottom))");
    expect(styles).toContain(".top-actions .signout-button{display:none");
    expect(styles).toContain(".topbar .brand small{display:none}");
    expect(styles).toContain(".topbar .brand{min-width:0;flex:1}");
    expect(styles).toContain(".topbar .notification-button{width:42px;height:42px;padding:0}");
    expect(styles).toContain("--mobile-dock-height:calc(88px + env(safe-area-inset-bottom))");
    expect(styles).toContain("--mobile-content-clearance:calc(var(--mobile-dock-height) + 52px)");
    expect(styles).toContain("min-height:var(--mobile-dock-height)");
    expect(styles).toContain(".content{padding-bottom:var(--mobile-content-clearance);scroll-padding-bottom:var(--mobile-content-clearance)}");
  });

  it("keeps the login experience branded, secure, and responsive", () => {
    expect(app).toContain('className="auth-orbit auth-orbit-one"');
    expect(app).toContain("บัญชีดิจิทัลสำหรับสวนยาง");
    expect(app).toContain("จัดการยอดขาย ส่วนแบ่ง และการส่งเงินของสวนคุณอย่างเป็นระบบในที่เดียว");
    expect(app).toContain('role="alert"');
    expect(app).toContain('role="note"');
    expect(app).toContain("ข้อมูลของคุณยังเป็นส่วนตัว");
    expect(styles).toContain(".auth-card-head");
    expect(styles).toContain(".auth-security-note");
    expect(styles).toContain("min-height:100svh");
    expect(styles).toContain("@media(prefers-reduced-motion:reduce)");
  });
});


describe("Thai UI terminology and destination labels", () => {
  it("uses consistent Thai labels with standard English terms in parentheses", () => {
    expect(app).toContain('role === "owner" ? "เจ้าของสวน (Owner)" : "คนกรีด (Tapper)"');
    expect(app).toContain("เวอร์ชัน");
    expect(app).toContain("ส่งออก CSV");
    expect(app).not.toContain(">Export CSV<");
    expect(app).not.toContain("ทุก version");
  });

  it("labels the mobile settlement destination as ส่งเงิน", () => {
    expect(app).toContain('onClick={() => openScreen("settlements")}><span className="mobile-nav-icon"><WalletCards size={22} /></span><span>ส่งเงิน</span>');
    expect(app).not.toContain("<span>กระเป๋า</span>");
  });
});


describe("calendar sales receipt workflow", () => {
  it("renders sales by receipt date and highlights dates with receipt evidence", () => {
    expect(app).toContain("function SalesCalendar");
    expect(app).toContain("const saleDateKey");
    expect(app).toContain("const saleHasReceipt");
    expect(app).toContain('className={`calendar-day ${entries.length ? "has-sales" : ""} ${hasReceipt ? "has-receipt"');
    expect(app).toContain("วันที่ตัด / วันที่ในใบเสร็จ");
    expect(app).toContain("วันที่ตัดที่มีใบเสร็จ");
    expect(styles).toContain(".calendar-grid");
    expect(styles).toContain(".calendar-day.has-receipt");
    expect(styles).toContain("@media(max-width:680px){.calendar-toolbar");
  });

  it("opens the existing full sale review with receipt evidence from a selected date", () => {
    expect(app).toContain("ดูรายละเอียดเต็ม");
    expect(app).toContain("onReview(sale)");
    expect(app).toContain("api.sales.receipt");
    expect(app).toContain("หลักฐานใบเสร็จ");
    expect(app).toContain("รายละเอียดและการแบ่งเงิน");
    expect(app).toContain("hasReceipt = Boolean(sale.receiptFileId || sale.receiptId)");
  });
});


describe("field-use calendar refinement", () => {
  it("removes the duplicate period control from the page heading", () => {
    expect(app).not.toContain('<button className="period">เดือนนี้⌄</button>');
    expect(app).toContain('className="calendar-toolbar-actions"');
    expect(app).toContain('aria-label="เดือนก่อนหน้า"');
    expect(app).toContain('aria-label="เดือนถัดไป"');
  });

  it("places refresh and add actions below the calendar", () => {
    expect(app).toContain('className="calendar-bottom-actions"');
    expect(app).toContain('className="calendar-bottom-actions"><button className="secondary"');
    expect(styles).toContain(".calendar-bottom-actions");
    expect(styles).toContain(".calendar-day.has-receipt{background:#d7f0c9");
    expect(styles).toContain(".calendar-day.has-sales{background:#fff4cf");
  });
});
