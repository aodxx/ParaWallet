import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../src/api.ts", import.meta.url), "utf8");
const ocr = readFileSync(new URL("../src/ocr.ts", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const loader = readFileSync(new URL("../src/LoadingAnimation.tsx", import.meta.url), "utf8");
const serviceWorker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const loadingAnimation = JSON.parse(readFileSync(new URL("../public/loading/animation.json", import.meta.url), "utf8"));
const splashLogo = readFileSync(new URL("../public/brand/splash-logo-transparent.png", import.meta.url));

describe("splash screen branding contract", () => {
  it("uses the supplied logo only for the splash variant and keeps default loading available", () => {
    expect(app).toContain('<main className="splash-screen"><LoadingAnimation variant="splash" label="กำลังเตรียม ParaWallet"');
    expect(app).not.toContain('<section className="auth-card loading-card"><LoadingAnimation variant="splash"');
    expect(styles).toContain(".splash-screen{min-height:100vh");
    expect(styles).toContain("place-items:center");
    expect(styles).toContain("width:min(850px,calc(100vw - 48px),48vh)");
    expect(styles).toContain("width:min(790px,calc(100vw - 32px),48vh)");
    expect(loader).toContain('variant = "default"');
    expect(loader).toContain('if (variant === "splash") return;');
    expect(loader).toContain('variant === "splash"');
    expect(loader).toContain("brand/splash-logo-transparent.png");
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

  it("lets the garden owner manage registered tapper accounts without typing internal IDs", () => {
    expect(app).toContain("เพิ่มคนกรีดเข้าสวน");
    expect(app).toContain("api.members.add");
    expect(app).toContain("api.members.deactivate");
    expect(app).toContain("เลือกคนกรีดในสวน");
    expect(app).not.toContain("Tapper ID<input");
  });

  it("replaces Owner creation actions with review and report navigation", () => {
    expect(app).toContain("รายการขายรอตรวจ");
    expect(app).toContain("เงินที่คนกรีดส่งมารอยืนยัน");
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
    expect(app).toContain("item.entityId");
    expect(app).toContain("setReviewSale(sale)");
    expect(app).toContain("setFocusedSettlementId(settlement.id)");
    expect(app).toContain("การแจ้งเตือนยังไม่ถูกทำเครื่องหมายว่าอ่านแล้ว");
    expect(app).toContain("setActionRetry(() => () => void openNotification(item))");
    expect(app).toContain('onRetry={actionRetry || (() => void refresh(screen))}');
    expect(app).toContain('className={`data-row notification-row');
  });

  it("prioritizes pending/latest sales and provides a completion receipt", () => {
    expect(app).toContain('role="tablist" aria-label="มุมมองรายการขาย"');
    expect(app).toContain("รอตรวจ");
    expect(app).toContain("ล่าสุด");
    expect(app).toContain('className="sale-primary-list"');
    expect(app).toContain("เปิดรายละเอียดได้ทันทีโดยไม่ต้องเลือกวันที่จากปฏิทิน");
    expect(app).toContain('className="sale-calendar-disclosure"');
    expect(app).toContain('onReviewSales={() => openSales("pending")}');
    expect(app).toContain("รอเจ้าของสวนตรวจหลักฐานและยืนยัน");
    expect(app).toContain("CompletionReceipt");
    expect(app).toContain("ดูรายการนี้");
  });

  it("shows persistent record-specific outcomes for every financial mutation", () => {
    expect(app).toContain('const COMPLETION_STORAGE_KEY = "parawallet.pendingCompletion"');
    expect(app).toContain("storeCompletion_(receipt)");
    expect(app).toContain('className="completion-status"');
    expect(app).toContain('className="completion-summary"');
    expect(app).toContain("สถานะใหม่");
    expect(app).toContain("กลับหน้าหลัก");
    expect(app).toContain("รอเจ้าของตรวจ");
    expect(app).toContain("รอเจ้าของยืนยันรับเงิน");
    expect(app).toContain("ยอดคงค้างก่อนยืนยัน");
    expect(app).toContain("ยอดคงค้างใหม่");
    expect(app).toContain('entityType: "sale"');
    expect(app).toContain('entityType: "settlement"');
    expect(app).toContain("setReviewSale(target)");
    expect(app).toContain("setFocusedSettlementId(target.id)");
    expect(app).toContain('impact="สถานะจะเปลี่ยนเป็นอยู่ระหว่างโต้แย้ง');
    expect(app).toContain('impact="รายการจะถูกปฏิเสธและยอดคงค้างจะไม่ถูกตัด"');
    expect(app).toContain("onCancel={() => setReasonOpen(false)}");
  });

  it("does not refetch the heavy dashboard before every tab", () => {
    expect(app).toContain('if (target === "overview" || !dashboard.garden?.id)');
    expect(app).toContain('screen === "settlements" && (!loading || settlements.length > 0)');
    expect(app).toContain('screen === "notifications" && (!loading || notifications.length > 0)');
  });

  it("keeps last successful data visible when an optional read model fails", () => {
    expect(app).toContain("Promise.allSettled");
    expect(app).toContain("const [authStatus, setAuthStatus]");
    expect(app).toContain("const [connectionStatus, setConnectionStatus]");
    expect(app).toContain("const [actionStatus, setActionStatus]");
    expect(app).toContain('createSystemStatus("connection", "partial"');
    expect(app).toContain("ข้อมูลบางส่วนยังไม่อัปเดต");
    expect(app).toContain("กำลังแสดงข้อมูลที่โหลดล่าสุด");
    expect(app).toContain("refreshSequenceRef");
    expect(app).toContain("if (dashboard.walletDetails) setWallet(dashboard.walletDetails)");
    expect(app).not.toContain("api.gardens.list(), api.agreements.list(garden.id), api.wallets.me(garden.id)");
  });

  it("uses one typed status contract without false signed-out or duplicate global alerts", () => {
    expect(app).toContain("SystemStatusBanner");
    expect(app).toContain("status.retryable && onRetry");
    expect(app).toContain("status.dismissible && onDismiss");
    expect(app).not.toContain("const [message, setMessage]");
    expect(app).not.toContain("setConnectionState");
    expect(app).not.toContain("กรุณาเข้าสู่ระบบด้วย Google ก่อนเชื่อมต่อฐานข้อมูล");
    expect(app).not.toContain('className="sync-banner"');
  });

  it("shows actionable async failures and blocks duplicate submissions", () => {
    expect(app).toContain("โหลดรายงานไม่สำเร็จ");
    expect(app).not.toContain("catch { setReport(null); }");
    expect(app).toContain("กำลังบันทึกสวน...");
    expect(app).toContain("กำลังบันทึกรายการขาย...");
    expect(app).toContain("กำลังบันทึกหลักฐาน...");
    expect(app).toContain("กำลังยกเลิก...");
    expect(app).toContain("ReasonDialog");
    expect(app).not.toContain("window.prompt");
    expect(app).toContain('const [cancelTarget, setCancelTarget] = useState<Settlement | null>(null);');
    expect(app).toContain('<ConfirmDialog title="ยกเลิกรายการส่งเงิน"');
    expect(app).not.toContain('window.confirm("ยกเลิกรายการส่งเงินนี้หรือไม่")');
  });

  it("does not render either role dashboard before role verification finishes", () => {
    expect(app).toContain("if (!hasSuccessfulSyncRef.current) return <InitialSyncScreen");
    expect(app).toContain("กำลังเตรียม ParaWallet");
    expect(app).toContain("เจ้าของสวนหรือคนกรีด จนกว่าจะตรวจสอบสิทธิ์สำเร็จ");
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

  it("makes the dual wallet and sale-entry dock the tapper's primary workflow", () => {
    expect(app).toContain('className="dual-wallet-priority"');
    expect(app).toContain('className="scan-receipt-cta desktop-scan-receipt"');
    expect(app).toContain('role === "tapper" && <div className={`mobile-scan-action');
    expect(app).toContain('aria-haspopup="menu"');
    expect(app).toContain('aria-label="วิธีเพิ่มรายการขาย"');
    expect(app).toContain("เพิ่มรายการขาย");
    expect(app).toContain("ถ่ายภาพบิล");
    expect(app).toContain("เลือกภาพจากเครื่อง");
    expect(app).toContain("กรอกตัวเลขเอง");
    expect(app).toContain('onReceipt={() => { setReceiptInitialFile(null); setShowReceiptForm(true); }}');
    expect(app).toContain('capture="environment"');
    expect(app).toContain('ref={receiptGalleryRef}');
    expect(app).toContain('initialFile={receiptInitialFile}');
    expect(app).toContain("formatThaiDateTime(sale.saleDate)");
    expect(app).toContain("formatThaiDateTime(item.transferDate)");
    expect(app).toContain("screenDescription(screen, role)");
    expect(app).toContain('className="panel-actions settlement-confirm-actions settlement-row-actions"');
    expect(styles).toContain(".settlement-row-actions{grid-column:1/-1!important");
    expect(styles).toContain("margin-bottom:calc(140px + env(safe-area-inset-bottom))");
  });

  it("preloads the transparent splash asset and rotates the shell cache", () => {
    expect(serviceWorker).toContain('const CACHE = "parawallet-shell-v6"');
    expect(serviceWorker).toContain("brand/splash-logo-transparent.png");
    expect(serviceWorker).not.toContain("brand/splash-logo.png`");
  });

  it("animates the Tapper scan actions without trapping Android back or reduced-motion users", () => {
    expect(app).toContain("window.history.pushState");
    expect(app).toContain('window.addEventListener("popstate", handlePopState)');
    expect(app).toContain('event.key === "Escape"');
    expect(app).toContain('className="mobile-scan-backdrop"');
    expect(styles).toContain(".mobile-bottom-nav.has-scan-action{grid-template-columns:repeat(5");
    expect(styles).toContain(".mobile-scan-action.is-open .scan-option");
    expect(styles).toContain(".desktop-scan-receipt{display:none}");
    expect(styles).toContain("@media(prefers-reduced-motion:reduce)");
  });

  it("collects transfer evidence and explains cash confirmation", () => {
    expect(app).toContain("กรุณาแนบสลิปการโอนเงิน");
    expect(app).toContain("ไฟล์สลิปต้องมีขนาดไม่เกิน 4 MB");
    expect(app).toContain("สลิปต้องเป็นรูปภาพหรือไฟล์ PDF เท่านั้น");
    expect(app).toContain("เจ้าของสวนต้องกดยืนยันว่าได้รับเงินสดแล้ว");
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

  it("exposes all three sale-entry methods in one place", () => {
    expect(app).toContain('className="receipt-upload-actions"');
    expect(app).toContain('className="file-action secondary" aria-disabled={scanWorking}><Camera');
    expect(app).toContain("ถ่ายภาพบิล");
    expect(app).toContain("เลือกภาพจากเครื่อง");
    expect(app).toContain("กรอกตัวเลขเอง");
    expect(styles).toContain("grid-template-columns:repeat(3,minmax(0,1fr))");
    expect(app).toContain('accept="image/*" capture="environment"');
    expect(styles).toContain(".receipt-upload-actions");
    expect(styles).toContain(".receipt-upload-actions .file-action input");
    expect(app).toContain("prepareReceiptImage_(selected)");
    expect(app).toContain('imageOrientation: "from-image"');
    expect(app).toContain('canvas.toBlob(resolve, "image/jpeg"');
    expect(app).toContain('className="receipt-scan-preview"');
    expect(styles).toContain(".receipt-scan-preview");
  });

  it("shows plain-language scan progress, outcomes, and recovery actions", () => {
    expect(app).toContain("เลือกภาพ");
    expect(app).toContain("กำลังอ่านข้อมูลในบิล...");
    expect(app).toContain("ขั้นตอนสุดท้าย: ตรวจตัวเลขกับภาพ");
    expect(app).toContain("ลองอ่านภาพนี้อีกครั้ง");
    expect(app).toContain("กรอกตัวเลขเอง");
    expect(app).toContain("ข้อมูลสำหรับผู้ดูแลระบบ");
    expect(app).toContain("showReviewFields &&");
    expect(styles).toContain(".receipt-scan-status");
    expect(styles).toContain(".receipt-scan-spinner");
  });

  it("links the scanned Receipt record and garden scope into Sale creation", () => {
    expect(app).toContain("gardenId: garden.id, data, mimeType: prepared.type");
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
    expect(styles).toContain(".topbar .notification-button{width:44px!important;height:44px!important}");
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

  it("closes every visible menu with an observable action and keyboard escape", () => {
    expect(app).toContain("ข้อมูลเพิ่มเติม");
    expect(app).not.toContain("ข้อมูลและการตั้งค่า");
    expect(app).toContain("if (!showMobileMore) return");
    expect(app).toContain('if (event.key === "Escape") setShowMobileMore(false)');
    expect(app).toContain('aria-label="ปิดเมนูเพิ่มเติม"');
    expect(app).toContain('aria-label={`ปิดหน้าต่าง ${title}`}');
  });

  it("uses role-specific empty, report, and permission page states", () => {
    expect(app).toContain("function PageState");
    expect(app).not.toContain("function Empty(");
    expect(app).toContain("บัญชีนี้ยังไม่ได้รับสิทธิ์เข้าสวน");
    expect(app).toContain("ติดต่อเจ้าของสวนให้เพิ่มบัญชี Google นี้เป็นคนกรีด");
    expect(app).toContain("ยังไม่มีประวัติการส่งเงิน");
    expect(app).toContain("ยังไม่มีข้อตกลงแบ่งรายได้");
    expect(app).toContain("ไม่พบรายการในช่วงนี้");
    expect(app).toContain("โหลดรายงานไม่สำเร็จ");
    expect(app).toContain("โหลดรายงานที่มีรายการก่อน จึงจะดาวน์โหลดตารางได้");
  });

  it("does not expose raw workflow status or implementation identifiers", () => {
    expect(app).toContain("labelStatus(agreement.status)");
    expect(app).not.toContain("{agreement.status}");
    expect(app).toContain("ข้อตกลงเวอร์ชัน");
    expect(app).not.toContain("agreementId.slice");
    expect(app).not.toContain("member.email || member.userId");
    expect(`${app}\n${api}\n${ocr}`).not.toContain("Gemini API Key");
    expect(ocr).toContain("แจ้งผู้ดูแลระบบให้เปิดบริการอ่านบิล หรือเลือกกรอกตัวเลขเอง");
    expect(app).toContain("ข้อมูลสำหรับผู้ดูแลระบบ");
  });

  it("keeps important mobile text readable and touch targets at least 44 pixels", () => {
    expect(styles).toContain("UX workstreams 5–7");
    expect(styles).toContain(".mobile-scan-trigger-label,.mobile-bottom-nav .scan-option");
    expect(styles).toContain(".receipt-scan-steps small,.receipt-scan-status span");
    expect(styles).toContain("font-size:12px!important");
    expect(styles).toContain("min-height:44px!important");
    expect(styles).toContain(".page-state-actions button{min-height:44px}");
  });
});


describe("Thai UI terminology and role-specific destination labels", () => {
  it("uses plain Thai role labels in normal screens", () => {
    expect(app).toContain('role === "owner" ? "เจ้าของสวน" : "คนกรีด"');
    expect(app).not.toContain("เจ้าของสวน (Owner)");
    expect(app).not.toContain("คนกรีด (Tapper)");
    expect(app).toContain("เวอร์ชัน");
    expect(app).toContain("ดาวน์โหลดตาราง");
    expect(app).not.toContain(">Export CSV<");
    expect(app).not.toContain("ทุก version");
  });

  it("labels settlement and garden destinations by role", () => {
    expect(app).toContain('role === "owner" ? "รับเงิน" : "ส่งเงิน"');
    expect(app).toContain('role === "owner" ? "สวนและสมาชิก" : "ข้อมูลสวน"');
    expect(app).toContain("รายงานและดาวน์โหลดตาราง");
    expect(app).toContain('role === "owner" ? "เงินที่คนกรีดส่งมา" : "การส่งเงิน"');
    expect(app).not.toContain("<span>กระเป๋า</span>");
  });

  it("makes owner wallet relationships explicit", () => {
    expect(app).toContain("ส่วนแบ่งทั้งหมดของฉัน");
    expect(app).toContain("ได้รับแล้ว");
    expect(app).toContain("ยังอยู่กับคนกรีด");
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
