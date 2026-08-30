import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, Agreement, ApiError, DashboardData, Garden, GardenMember, Notification, Role, Sale, SaleReceiptEvidence, Settlement, SettlementEvidence, WalletData, onAuthFailure, setAuthToken, userMessageForApiError } from "./api";
import GoogleSignIn from "./GoogleSignIn";
import LoadingAnimation from "./LoadingAnimation";
import { normalizeOcrFields, receiptFieldLabel, receiptReviewGate, receiptScanFeedback, validateReceiptMath } from "./ocr";
import { createSystemStatus, idleSystemStatus, isErrorStatus, shouldShowStatus, SystemStatus } from "./systemStatus";
import { AlertTriangle, Banknote, Bell, Camera, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleDollarSign, Eye, FileDown, FileText, House, Image, Leaf, LoaderCircle, LogOut, Menu, Plus, RefreshCw, ShieldCheck, Sprout, Upload, UserMinus, UserPlus, Users, WalletCards, X } from "lucide-react";

type Screen = "overview" | "sales" | "gardens" | "agreements" | "settlements" | "reports" | "notifications";
type ConnectionState = "connecting" | "connected" | "degraded" | "disconnected";
type ReceiptScanPhase = "idle" | "preparing" | "reading" | "complete" | "attention" | "failed";
type SaleView = "pending" | "latest" | "confirmed" | "all";
type CompletionReceiptData = {
  title: string;
  detail: string;
  statusLabel: string;
  rows: Array<{ label: string; value: string }>;
  nextScreen?: Screen;
  entityType?: "sale" | "settlement";
  entityId?: string;
  openLabel?: string;
};

const fallback: DashboardData = { role: "owner", garden: undefined, wallet: { owner: 0, tapper: 0, outstanding: 0, currency: "THB" }, pendingReviews: 0, pendingSales: 0, pendingSettlements: 0, unreadNotifications: 0, monthlySales: 0 };
const money = (value: number) => `฿${Number(value || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;
const dateToday = () => new Date().toISOString().slice(0, 10);
const formatThaiDateTime = (value?: string) => {
  if (!value) return "ไม่ระบุวันที่";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const options = { timeZone: "Asia/Bangkok" } as const;
  const date = parsed.toLocaleDateString("th-TH", { ...options, day: "numeric", month: "short", year: "numeric" });
  if (!/T\d{2}:\d{2}/.test(value)) return date;
  const time = parsed.toLocaleTimeString("th-TH", { ...options, hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} · ${time} น.`;
};
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const AUTH_STORAGE_KEY = "parawallet.googleIdToken";
const COMPLETION_STORAGE_KEY = "parawallet.pendingCompletion";
const MAX_EVIDENCE_BYTES = 4 * 1024 * 1024;

function loadStoredCompletion_(): CompletionReceiptData | null {
  try {
    const value = window.sessionStorage.getItem(COMPLETION_STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as CompletionReceiptData;
    return parsed?.title && parsed?.statusLabel && Array.isArray(parsed.rows) ? parsed : null;
  } catch {
    return null;
  }
}

function storeCompletion_(receipt: CompletionReceiptData | null) {
  try {
    if (receipt) window.sessionStorage.setItem(COMPLETION_STORAGE_KEY, JSON.stringify(receipt));
    else window.sessionStorage.removeItem(COMPLETION_STORAGE_KEY);
  } catch {
    // The in-memory receipt still works when session storage is unavailable.
  }
}

export default function App() {
  const [role, setRole] = useState<Role>("owner");
  const [screen, setScreen] = useState<Screen>("overview");
  const [authToken, setAuthTokenState] = useState(() => localStorage.getItem(AUTH_STORAGE_KEY) || "");
  const [data, setData] = useState<DashboardData>(fallback);
  const [gardens, setGardens] = useState<Garden[]>([]);
  const [members, setMembers] = useState<GardenMember[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState<SystemStatus>(() => idleSystemStatus("authentication"));
  const [connectionStatus, setConnectionStatus] = useState<SystemStatus>(() => idleSystemStatus("connection"));
  const [actionStatus, setActionStatus] = useState<SystemStatus>(() => idleSystemStatus("action"));
  const [actionRetry, setActionRetry] = useState<(() => void) | null>(null);
  const [showGardenForm, setShowGardenForm] = useState(false);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [reviewSale, setReviewSale] = useState<Sale | null>(null);
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [receiptInitialFile, setReceiptInitialFile] = useState<File | null>(null);
  const [showAgreementForm, setShowAgreementForm] = useState(false);
  const [showSettlementForm, setShowSettlementForm] = useState(false);
  const [showMobileMore, setShowMobileMore] = useState(false);
  const [showScanMenu, setShowScanMenu] = useState(false);
  const [completionReceipt, setCompletionReceipt] = useState<CompletionReceiptData | null>(() => loadStoredCompletion_());
  const [completionOpening, setCompletionOpening] = useState(false);
  const [completionOpenError, setCompletionOpenError] = useState("");
  const [deactivateTarget, setDeactivateTarget] = useState<GardenMember | null>(null);
  const [deactivateBusy, setDeactivateBusy] = useState(false);
  const [salesInitialView, setSalesInitialView] = useState<SaleView | undefined>(undefined);
  const [focusedSettlementId, setFocusedSettlementId] = useState("");
  const receiptCameraRef = useRef<HTMLInputElement>(null);
  const receiptGalleryRef = useRef<HTMLInputElement>(null);
  const scanMenuHistoryRef = useRef(false);
  const refreshSequenceRef = useRef(0);
  const hasSuccessfulSyncRef = useRef(false);
  const activeGarden = data.garden || gardens[0];
  const connectionState: ConnectionState = connectionStatus.kind === "working" ? "connecting" : connectionStatus.kind === "success" ? "connected" : ["partial", "offline"].includes(connectionStatus.kind) ? "degraded" : "disconnected";
  const connected = hasSuccessfulSyncRef.current || ["success", "partial", "offline"].includes(connectionStatus.kind);
  const pendingSales = data.pendingSales || 0;
  const pendingSettlements = data.pendingSettlements || 0;
  const unreadNotifications = data.unreadNotifications ?? notifications.filter((item) => !item.readAt).length;

  const closeScanMenu = useCallback(() => {
    if (scanMenuHistoryRef.current && window.history.state?.paraWalletScanMenu) {
      window.history.back();
      return;
    }
    scanMenuHistoryRef.current = false;
    setShowScanMenu(false);
  }, []);

  useEffect(() => {
    if (!showScanMenu) return;
    if (!scanMenuHistoryRef.current) {
      window.history.pushState({ ...(window.history.state || {}), paraWalletScanMenu: true }, "");
      scanMenuHistoryRef.current = true;
    }
    const handlePopState = () => {
      scanMenuHistoryRef.current = false;
      setShowScanMenu(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeScanMenu();
    };
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeScanMenu, showScanMenu]);

  useEffect(() => {
    if (!showMobileMore) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowMobileMore(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showMobileMore]);

  const handleSignOut = useCallback((reason = "") => {
    refreshSequenceRef.current += 1;
    hasSuccessfulSyncRef.current = false;
    localStorage.removeItem(AUTH_STORAGE_KEY);
    storeCompletion_(null);
    setCompletionReceipt(null);
    setAuthToken("");
    setAuthTokenState("");
    setConnectionStatus(idleSystemStatus("connection"));
    setActionStatus(idleSystemStatus("action"));
    setAuthStatus(reason
      ? createSystemStatus("authentication", "auth_error", "เข้าสู่ระบบใหม่อีกครั้ง", reason, { nextAction: "เลือกบัญชี Google ที่ลงทะเบียนกับ ParaWallet", retryable: true })
      : idleSystemStatus("authentication"));
    window.google?.accounts?.id?.disableAutoSelect?.();
  }, []);

  const refresh = async (target: Screen = screen) => {
    const refreshSequence = ++refreshSequenceRef.current;
    const isCurrent = () => refreshSequence === refreshSequenceRef.current;
    setLoading(true);
    setConnectionStatus(createSystemStatus("connection", "working", "กำลังอัปเดตข้อมูล", "ระบบกำลังโหลดข้อมูลล่าสุดจาก ParaWallet", { nextAction: "รอสักครู่" }));
    try {
      let dashboard = data;
      let partialFailure = false;
      // Navigation uses the dashboard already in memory. Re-fetching the heavy
      // dashboard read model before every list page made a single tab change take
      // 8–12 seconds on Apps Script.
      if (target === "overview" || !dashboard.garden?.id) {
        dashboard = await api.dashboard();
        if (!isCurrent()) return;
        setData(dashboard);
        setRole(dashboard.role);
        if (dashboard.walletDetails) setWallet(dashboard.walletDetails);
        hasSuccessfulSyncRef.current = true;
      }
      const garden = dashboard.garden || gardens[0];
      if (garden?.id) {
        if (target === "overview") {
          const [gardenResult, agreementResult] = await Promise.allSettled([api.gardens.list(), api.agreements.list(garden.id)]);
          if (!isCurrent()) return;
          if (gardenResult.status === "fulfilled") setGardens(gardenResult.value);
          if (agreementResult.status === "fulfilled") setAgreements(agreementResult.value);
          partialFailure = [gardenResult, agreementResult].some((result) => result.status === "rejected");
        } else if (target === "sales") {
          const [saleResult, agreementResult] = await Promise.allSettled([api.sales.list({ gardenId: garden.id }), api.agreements.list(garden.id)]);
          if (!isCurrent()) return;
          if (saleResult.status === "fulfilled") setSales(saleResult.value);
          if (agreementResult.status === "fulfilled") setAgreements(agreementResult.value);
          partialFailure = [saleResult, agreementResult].some((result) => result.status === "rejected");
        } else if (target === "gardens") {
          const [gardenResult, memberResult] = await Promise.allSettled([api.gardens.list(), dashboard.role === "owner" ? api.members.list(garden.id) : Promise.resolve([])]);
          if (!isCurrent()) return;
          if (gardenResult.status === "fulfilled") setGardens(gardenResult.value);
          if (memberResult.status === "fulfilled") setMembers(memberResult.value);
          partialFailure = [gardenResult, memberResult].some((result) => result.status === "rejected");
        } else if (target === "agreements") {
          const [agreementResult, memberResult] = await Promise.allSettled([api.agreements.list(garden.id), dashboard.role === "owner" ? api.members.list(garden.id) : Promise.resolve([])]);
          if (!isCurrent()) return;
          if (agreementResult.status === "fulfilled") setAgreements(agreementResult.value);
          if (memberResult.status === "fulfilled") setMembers(memberResult.value);
          partialFailure = [agreementResult, memberResult].some((result) => result.status === "rejected");
        } else if (target === "settlements") {
          const [walletResult, settlementResult] = await Promise.allSettled([api.wallets.me(garden.id), api.settlements.list(garden.id)]);
          if (!isCurrent()) return;
          if (walletResult.status === "fulfilled") setWallet(walletResult.value);
          if (settlementResult.status === "fulfilled") setSettlements(settlementResult.value);
          partialFailure = [walletResult, settlementResult].some((result) => result.status === "rejected");
        }
      }
      if (target === "notifications") {
        const notificationRows = await api.notifications.list();
        if (!isCurrent()) return;
        setNotifications(notificationRows);
        setData((current) => ({ ...current, unreadNotifications: notificationRows.filter((item) => !item.readAt).length }));
      }
      if (!isCurrent()) return;
      hasSuccessfulSyncRef.current = true;
      const syncedAt = new Date().toISOString();
      if (partialFailure) {
        setConnectionStatus(createSystemStatus("connection", "partial", "ข้อมูลบางส่วนยังไม่อัปเดต", `ข้อมูลหลักพร้อมใช้งาน · โหลดล่าสุด ${formatThaiDateTime(syncedAt)}`, { nextAction: "กดลองใหม่เพื่อโหลดส่วนที่ยังขาด", retryable: true, updatedAt: syncedAt }));
      } else {
        setConnectionStatus(createSystemStatus("connection", "success", "ข้อมูลเป็นปัจจุบัน", `โหลดล่าสุด ${formatThaiDateTime(syncedAt)}`, { updatedAt: syncedAt }));
      }
    } catch (error) {
      if (!isCurrent()) return;
      if (error instanceof ApiError && ["AUTH_REQUIRED", "INVALID_GOOGLE_ID_TOKEN", "GOOGLE_TOKEN_EXPIRED", "USER_NOT_REGISTERED"].includes(error.code)) {
        handleSignOut("เซสชัน Google หมดอายุหรือไม่มีสิทธิ์ โปรดเข้าสู่ระบบใหม่");
      } else {
        if (hasSuccessfulSyncRef.current) {
          const lastUpdated = connectionStatus.updatedAt ? formatThaiDateTime(connectionStatus.updatedAt) : "ครั้งก่อน";
          setConnectionStatus(createSystemStatus("connection", "offline", "กำลังแสดงข้อมูลที่โหลดล่าสุด", `${userMessageForApiError(error)} · ข้อมูลล่าสุดจาก ${lastUpdated}`, { nextAction: "ตรวจอินเทอร์เน็ตแล้วกดลองใหม่", retryable: true, updatedAt: connectionStatus.updatedAt }));
        } else {
          setConnectionStatus(createSystemStatus("connection", "api_error", "โหลดข้อมูลไม่สำเร็จ", userMessageForApiError(error), { nextAction: "ตรวจการเชื่อมต่อแล้วกดลองใหม่", retryable: true }));
        }
      }
    } finally {
      if (isCurrent()) setLoading(false);
    }
  };

  useEffect(() => {
    onAuthFailure(() => handleSignOut("เซสชัน Google หมดอายุหรือไม่มีสิทธิ์ โปรดเข้าสู่ระบบใหม่"));
    setAuthToken(authToken);
    if (authToken) void refresh("overview");
    else {
      setConnectionStatus(idleSystemStatus("connection"));
      setAuthStatus((current) => current.kind === "auth_error" ? current : idleSystemStatus("authentication"));
    }
  }, [authToken]);

  const handleCredential = useCallback((token: string) => {
    localStorage.setItem(AUTH_STORAGE_KEY, token);
    setAuthTokenState(token);
    setAuthStatus(createSystemStatus("authentication", "working", "กำลังตรวจสอบบัญชี", "ระบบกำลังตรวจสอบสิทธิ์ของบัญชี Google", { nextAction: "รอสักครู่" }));
  }, []);
  const nav = useMemo(() => [
    ["overview", "ภาพรวม", <Leaf size={18} />],
    ["sales", "รายการขาย", <FileText size={18} />],
    ["gardens", "สวนและแปลง", <Sprout size={18} />],
    ["agreements", "ข้อตกลง", <CircleDollarSign size={18} />],
    ["settlements", role === "owner" ? "รับเงิน" : "ส่งเงิน", <WalletCards size={18} />],
    ["reports", "รายงาน", <CircleDollarSign size={18} />],
    ["notifications", "แจ้งเตือน", <Bell size={18} />],
  ] as const, [role]);

  const openScreen = (next: Screen) => { if (showScanMenu) closeScanMenu(); setScreen(next); void refresh(next); };
  const openSales = (view: SaleView) => { setSalesInitialView(view); openScreen("sales"); };
  const openMobileScreen = (next: Screen) => { setShowMobileMore(false); openScreen(next); };
  const showCompletion = (receipt: CompletionReceiptData) => {
    setCompletionOpenError("");
    storeCompletion_(receipt);
    setCompletionReceipt(receipt);
  };
  const clearCompletion = () => {
    storeCompletion_(null);
    setCompletionReceipt(null);
    setCompletionOpenError("");
  };
  const returnCompletionToOverview = () => {
    clearCompletion();
    openScreen("overview");
  };
  const openCompletionRecord = async () => {
    const receipt = completionReceipt;
    if (!receipt || completionOpening) return;
    if (!receipt.nextScreen) { clearCompletion(); return; }
    if (!receipt.entityType || !receipt.entityId || !activeGarden) {
      clearCompletion();
      openScreen(receipt.nextScreen);
      return;
    }
    setCompletionOpening(true);
    setCompletionOpenError("");
    try {
      if (receipt.entityType === "sale") {
        const rows = await api.sales.list({ gardenId: activeGarden.id });
        const target = rows.find((row) => row.id === receipt.entityId);
        if (!target) throw new ApiError("COMPLETION_TARGET_NOT_FOUND", "Completed sale target was not found");
        setSales(rows);
        setSalesInitialView(["pending_owner_review", "ocr_review"].includes(target.status) ? "pending" : "latest");
        setScreen("sales");
        setReviewSale(target);
      } else {
        const rows = await api.settlements.list(activeGarden.id);
        const target = rows.find((row) => row.id === receipt.entityId);
        if (!target) throw new ApiError("COMPLETION_TARGET_NOT_FOUND", "Completed settlement target was not found");
        setSettlements(rows);
        setScreen("settlements");
        setFocusedSettlementId(target.id);
      }
      clearCompletion();
    } catch (caught) {
      setCompletionOpenError(`${userMessageForApiError(caught)} ใบสรุปนี้ยังไม่ถูกปิด กรุณาลองอีกครั้ง`);
    } finally {
      setCompletionOpening(false);
    }
  };
  const deactivateMember = async () => {
    if (!activeGarden || !deactivateTarget || deactivateBusy) return;
    setDeactivateBusy(true); setActionRetry(null); setActionStatus(createSystemStatus("action", "working", "กำลังปิดสิทธิ์คนกรีด", "ระบบกำลังตรวจสอบรายการและยอดคงค้าง", { nextAction: "รอสักครู่" }));
    try {
      const targetName = deactivateTarget.name || deactivateTarget.email || "คนกรีด";
      await api.members.deactivate({ gardenId: activeGarden.id, memberId: deactivateTarget.id });
      setDeactivateTarget(null);
      showCompletion({ title: "ปิดสิทธิ์คนกรีดสำเร็จ", detail: "บุคคลนี้เข้าใช้ข้อมูลสวนไม่ได้แล้ว แต่ประวัติเดิมยังอยู่ครบ", statusLabel: "ปิดสิทธิ์แล้ว", rows: [{ label: "คนกรีด", value: targetName }, { label: "ผลต่อข้อมูลเดิม", value: "เก็บประวัติไว้ครบ" }], nextScreen: "gardens", openLabel: "ดูสมาชิกสวน" });
      void refresh("gardens");
    }
    catch (caught) { setActionRetry(() => () => void deactivateMember()); setActionStatus(createSystemStatus("action", "api_error", "ปิดสิทธิ์ไม่สำเร็จ", userMessageForApiError(caught), { nextAction: "ตรวจรายการค้างแล้วลองใหม่", retryable: true, dismissible: true })); }
    finally { setDeactivateBusy(false); }
  };
  const mobileNavIndex = screen === "overview" ? 0 : screen === "sales" ? 1 : screen === "settlements" ? 2 : 3;

  const openNotification = async (item: Notification) => {
    const wasUnread = !item.readAt;
    const target = item.targetScreen || notificationTargetScreen(item.type);
    setActionRetry(null);
    setActionStatus(createSystemStatus("action", "working", "กำลังเปิดรายการ", "ระบบกำลังโหลดข้อมูลที่เกี่ยวข้อง", { nextAction: "รอสักครู่" }));
    try {
      let openedExactRecord = false;
      if (target === "sales" && activeGarden) {
        const rows = await api.sales.list({ gardenId: activeGarden.id });
        setSales(rows);
        setSalesInitialView(item.type === "sale_pending_review" ? "pending" : "latest");
        setScreen("sales");
        if (item.entityId) {
          const sale = rows.find((row) => row.id === item.entityId);
          if (!sale) throw new ApiError("NOTIFICATION_TARGET_NOT_FOUND", "Notification sale target was not found");
          setReviewSale(sale);
          openedExactRecord = true;
        }
      } else if (target === "settlements" && activeGarden) {
        const rows = await api.settlements.list(activeGarden.id);
        setSettlements(rows);
        setScreen("settlements");
        if (item.entityId) {
          const settlement = rows.find((row) => row.id === item.entityId);
          if (!settlement) throw new ApiError("NOTIFICATION_TARGET_NOT_FOUND", "Notification settlement target was not found");
          setFocusedSettlementId(settlement.id);
          openedExactRecord = true;
        }
      } else if (target !== "notifications") {
        setScreen(target);
        await refresh(target);
      }
      if (wasUnread) await api.notifications.read(item.id);
      if (wasUnread) {
        const readAt = new Date().toISOString();
        setNotifications((items) => items.map((row) => row.id === item.id ? { ...row, readAt } : row));
        setData((current) => ({ ...current, unreadNotifications: Math.max(0, (current.unreadNotifications || 0) - 1) }));
      }
      setActionStatus(createSystemStatus("action", "success", openedExactRecord ? "เปิดรายการที่แจ้งเตือนแล้ว" : "เปิดข้อมูลที่เกี่ยวข้องแล้ว", openedExactRecord ? "แสดงรายละเอียดรายการโดยตรงเรียบร้อย" : "การแจ้งเตือนเดิมไม่มีเลขรายการ จึงเปิดหน้ารวมที่เกี่ยวข้อง", { dismissible: true }));
    } catch (caught) {
      setActionRetry(() => () => void openNotification(item));
      setActionStatus(createSystemStatus("action", "api_error", "เปิดรายการไม่สำเร็จ", userMessageForApiError(caught), { nextAction: "การแจ้งเตือนยังไม่ถูกทำเครื่องหมายว่าอ่านแล้ว กดลองเปิดอีกครั้ง", retryable: true, dismissible: true }));
    }
  };

  if (!authToken) return <AuthScreen clientId={googleClientId} status={authStatus} onCredential={handleCredential} onError={(detail) => setAuthStatus(createSystemStatus("authentication", "auth_error", "เข้าสู่ระบบไม่สำเร็จ", detail, { nextAction: "ตรวจบัญชี Google แล้วลองใหม่", retryable: true }))} />;
  if (!hasSuccessfulSyncRef.current) return <InitialSyncScreen loading={loading || connectionState === "connecting"} status={connectionStatus} onRetry={() => void refresh("overview")} onSignOut={() => handleSignOut()} />;

  return <div className="app-shell">
    <header className="topbar">
      <button className="icon-button mobile-only" aria-label="เปิดเมนูเพิ่มเติม" onClick={() => setShowMobileMore(true)}><Menu size={21} /></button>
      <div className="brand"><span className="brand-mark"><Leaf size={22} /></span><span><b>ParaWallet</b><small>ระบบกระเป๋าคู่</small></span></div>
      <div className="top-actions"><button className="secondary signout-button" onClick={() => handleSignOut()}>ออกจากระบบ</button><span className="role-badge">{role === "owner" ? "เจ้าของสวน" : "คนกรีด"}</span><button className="icon-button notification-button" onClick={() => openScreen("notifications")} aria-label={`การแจ้งเตือนที่ยังไม่อ่าน ${unreadNotifications} รายการ`}><Bell size={20} />{unreadNotifications > 0 && <em>{unreadNotifications}</em>}</button></div>
      <div className="mobile-header-context"><div><small>สวนที่กำลังใช้งาน</small><strong>{activeGarden?.name || "ยังไม่มีสวน"}</strong></div><span className={`header-connection ${connectionState}`}>{connectionState === "connected" ? "เชื่อมต่อแล้ว" : connectionState === "degraded" ? "ข้อมูลบางส่วน" : "ยังไม่เชื่อมต่อ"}</span></div>
      <svg className="topbar-wave" viewBox="0 0 390 52" preserveAspectRatio="none" aria-hidden="true"><path d="M0 15 C76 15 93 48 184 48 C278 48 298 7 390 7 L390 52 L0 52 Z" /></svg>
    </header>
    {["partial", "offline", "api_error"].includes(connectionStatus.kind) && <SystemStatusBanner status={connectionStatus} busy={loading} onRetry={() => void refresh()} />}
    {shouldShowStatus(actionStatus) && <SystemStatusBanner status={actionStatus} onRetry={actionRetry || (() => void refresh(screen))} onDismiss={() => { setActionStatus(idleSystemStatus("action")); setActionRetry(null); }} />}
    <div className="mobile-context"><div><small>กำลังดูข้อมูล</small><strong>{activeGarden?.name || "ยังไม่มีสวน"}</strong></div><button onClick={() => openScreen("gardens")} aria-label="เปลี่ยนสวน"><Sprout size={18} /></button></div>
    <div className="layout">
      <aside className="sidebar">
        <div className="garden-selector"><small>กำลังดูข้อมูล</small><strong>{activeGarden?.name || "ยังไม่มีสวน"}</strong><span>{activeGarden ? `${activeGarden.areaRai || 0} ไร่ · ${(activeGarden.treeCount || 0).toLocaleString()} ต้น` : "เชื่อมต่อระบบเพื่อเริ่มต้น"}</span></div>
        <nav>{nav.map(([key, label, icon]) => { const badge = key === "sales" ? pendingSales : key === "settlements" ? pendingSettlements : key === "notifications" ? unreadNotifications : 0; return <button key={key} className={screen === key ? "active" : ""} onClick={() => openScreen(key)}>{icon}{label}{badge > 0 && <em>{badge}</em>}</button>; })}</nav>
        <button className="settings" onClick={() => setShowMobileMore(true)}><Menu size={18} />ข้อมูลเพิ่มเติม</button>
      </aside>
      <main className={`content ${loading ? "is-loading" : ""}`}>
        <div className="page-heading"><div><p>{new Date().toLocaleDateString("th-TH", { dateStyle: "full" })}</p><h1>{screenTitle(screen, role)}</h1><span>{screenDescription(screen, role)}</span></div></div>
        <div className="screen-stage" aria-busy={loading}>
          <div className="screen-content" key={screen}>
        {!activeGarden && screen !== "notifications" ? <NoGardenState role={role} onCreate={() => setShowGardenForm(true)} onSwitchAccount={() => handleSignOut()} /> : <>
        {screen === "overview" && <Overview data={data} wallet={wallet} role={role} connected={connected} onSale={() => setShowSaleForm(true)} onReceipt={() => { setReceiptInitialFile(null); setShowReceiptForm(true); }} onSettlement={() => setShowSettlementForm(true)} onReviewSales={() => openSales("pending")} onReviewSettlements={() => openScreen("settlements")} onReports={() => openScreen("reports")} />}
        {screen === "sales" && (!loading || sales.length > 0) && <SalesScreen sales={sales} role={role} initialView={salesInitialView} onViewApplied={() => setSalesInitialView(undefined)} onSale={() => setShowSaleForm(true)} onReview={setReviewSale} onRefresh={() => refresh("sales")} />}
        {screen === "gardens" && <GardensScreen garden={activeGarden} gardens={gardens.length ? gardens : activeGarden ? [activeGarden] : []} members={members} role={role} onCreate={() => setShowGardenForm(true)} onAddMember={() => setShowMemberForm(true)} onDeactivate={(member) => setDeactivateTarget(member)} />}
        {screen === "agreements" && (!loading || agreements.length > 0) && <AgreementsScreen agreements={agreements} garden={activeGarden} role={role} onCreate={() => setShowAgreementForm(true)} />}
        {screen === "settlements" && (!loading || settlements.length > 0) && <SettlementsScreen settlements={settlements} wallet={wallet} role={role} focusedSettlementId={focusedSettlementId} onFocusHandled={() => setFocusedSettlementId("")} onCreate={() => setShowSettlementForm(true)} onRefresh={() => refresh("settlements")} onCompleted={showCompletion} />}
        {screen === "reports" && <ReportsScreen garden={activeGarden} />}
        {screen === "notifications" && (!loading || notifications.length > 0) && <NotificationsScreen notifications={notifications} onOpen={openNotification} />}
        </>}
          </div>
          {loading && <div className="loading-overlay"><LoadingAnimation label="กำลังอัปเดตข้อมูล" detail="ตรวจสอบข้อมูลล่าสุดจาก ParaWallet" /></div>}
        </div>
      </main>
    </div>
    <input ref={receiptCameraRef} className="camera-input" type="file" accept="image/*" capture="environment" aria-label="ถ่ายภาพบิลเพื่อเพิ่มรายการขาย" onChange={(event) => { const selected = event.target.files?.[0] || null; event.target.value = ""; if (selected) { setReceiptInitialFile(selected); setShowReceiptForm(true); } }} />
    <input ref={receiptGalleryRef} className="camera-input" type="file" accept="image/*" aria-label="เลือกภาพใบเสร็จจากเครื่อง" onChange={(event) => { const selected = event.target.files?.[0] || null; event.target.value = ""; if (selected) { setReceiptInitialFile(selected); setShowReceiptForm(true); } }} />
    {showScanMenu && <button className="mobile-scan-backdrop" type="button" aria-label="ปิดเมนูเพิ่มรายการขาย" onClick={closeScanMenu} />}
    <nav className={`mobile-bottom-nav ${role === "tapper" ? "has-scan-action" : ""}`} aria-label="เมนูหลักบนมือถือ" data-active={mobileNavIndex}>
      <button className={screen === "overview" ? "active" : ""} onClick={() => openScreen("overview")}><span className="mobile-nav-icon"><House size={22} /></span><span>ภาพรวม</span></button>
      <button className={screen === "sales" ? "active" : ""} onClick={() => openScreen("sales")}><span className="mobile-nav-icon"><FileText size={22} /></span><span>รายการ</span>{pendingSales > 0 && <em>{pendingSales}</em>}</button>
      {role === "tapper" && <div className={`mobile-scan-action ${showScanMenu ? "is-open" : ""}`}>
        <div className="mobile-scan-menu" role="menu" aria-label="วิธีเพิ่มรายการขาย">
          <button className="scan-option scan-option-camera" type="button" role="menuitem" onClick={() => { receiptCameraRef.current?.click(); closeScanMenu(); }}><span><Camera size={23} /></span><strong>ถ่ายภาพบิล</strong></button>
          <button className="scan-option scan-option-gallery" type="button" role="menuitem" onClick={() => { receiptGalleryRef.current?.click(); closeScanMenu(); }}><span><Image size={23} /></span><strong>เลือกภาพจากเครื่อง</strong></button>
          <button className="scan-option scan-option-manual" type="button" role="menuitem" onClick={() => { setShowSaleForm(true); closeScanMenu(); }}><span><Plus size={24} /></span><strong>กรอกตัวเลขเอง</strong></button>
        </div>
        <button className="mobile-scan-trigger" type="button" aria-haspopup="menu" aria-expanded={showScanMenu} aria-label={showScanMenu ? "ปิดเมนูเพิ่มรายการขาย" : "เปิดเมนูเพิ่มรายการขาย"} onClick={() => showScanMenu ? closeScanMenu() : setShowScanMenu(true)}><span className="mobile-scan-trigger-icon">{showScanMenu ? <X size={30} /> : <Camera size={29} />}</span><span className="mobile-scan-trigger-label">เพิ่มรายการขาย</span></button>
      </div>}
      <button className={screen === "settlements" ? "active" : ""} onClick={() => openScreen("settlements")}><span className="mobile-nav-icon"><WalletCards size={22} /></span><span>{role === "owner" ? "รับเงิน" : "ส่งเงิน"}</span>{pendingSettlements > 0 && <em>{pendingSettlements}</em>}</button>
      <button className={mobileNavIndex === 3 ? "active" : ""} onClick={() => { if (showScanMenu) closeScanMenu(); setShowMobileMore(true); }}><span className="mobile-nav-icon"><Menu size={22} /></span><span>เพิ่มเติม</span>{unreadNotifications > 0 && <em>{unreadNotifications}</em>}</button>
    </nav>
    {showMobileMore && <div className="mobile-more-backdrop" role="presentation" onClick={() => setShowMobileMore(false)}><section className="mobile-more-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-more-title" onClick={(event) => event.stopPropagation()}><div className="mobile-more-head"><div><small>เมนู ParaWallet</small><h2 id="mobile-more-title">เพิ่มเติม</h2></div><button className="icon-button" onClick={() => setShowMobileMore(false)} aria-label="ปิดเมนูเพิ่มเติม"><X size={22} /></button></div><div className="mobile-more-grid"><button onClick={() => openMobileScreen("gardens")}><Sprout size={22} /><span><strong>{role === "owner" ? "สวนและสมาชิก" : "ข้อมูลสวน"}</strong><small>{role === "owner" ? "ข้อมูลสวนและสิทธิ์ของคนกรีด" : "ดูข้อมูลสวนที่ได้รับสิทธิ์"}</small></span></button><button onClick={() => openMobileScreen("agreements")}><CircleDollarSign size={22} /><span><strong>ข้อตกลง</strong><small>สัดส่วนและเวอร์ชัน</small></span></button><button onClick={() => openMobileScreen("reports")}><FileDown size={22} /><span><strong>รายงาน</strong><small>เลือกช่วงวันที่และดาวน์โหลดตาราง</small></span></button><button onClick={() => openMobileScreen("notifications")}><Bell size={22} /><span><strong>การแจ้งเตือน</strong><small>{unreadNotifications > 0 ? `ยังไม่อ่าน ${unreadNotifications} รายการ` : "อ่านครบแล้ว"}</small></span></button><button onClick={() => { setShowMobileMore(false); handleSignOut(); }}><LogOut size={22} /><span><strong>ออกจากระบบ</strong><small>เปลี่ยนบัญชี Google หรือจบการใช้งาน</small></span></button></div><DeveloperCredit /></section></div>}
    {showGardenForm && role === "owner" && <GardenForm onClose={() => setShowGardenForm(false)} onSaved={(receipt) => { setShowGardenForm(false); showCompletion(receipt); void refresh("gardens"); }} />}
    {showMemberForm && role === "owner" && <MemberForm garden={activeGarden} onClose={() => setShowMemberForm(false)} onSaved={(receipt) => { setShowMemberForm(false); showCompletion(receipt); void refresh("gardens"); }} />}
    {showSaleForm && role === "tapper" && <SaleForm garden={activeGarden} agreement={agreements[0]} role={role} onClose={() => setShowSaleForm(false)} onSaved={(receipt) => { setShowSaleForm(false); showCompletion(receipt); void refresh("sales"); }} />}
    {reviewSale && <SaleReviewModal sale={reviewSale} agreement={agreements.find((item) => item.id === reviewSale.agreementId)} role={role} onClose={() => setReviewSale(null)} onChanged={(receipt) => { setReviewSale(null); showCompletion(receipt); void refresh("sales"); }} />}
    {showReceiptForm && role === "tapper" && <ReceiptForm garden={activeGarden} agreement={agreements[0]} initialFile={receiptInitialFile} onClose={() => { setShowReceiptForm(false); setReceiptInitialFile(null); }} onUseManual={() => { setShowReceiptForm(false); setReceiptInitialFile(null); setShowSaleForm(true); }} onSaved={(receipt) => { setShowReceiptForm(false); setReceiptInitialFile(null); showCompletion(receipt); void refresh("sales"); }} />}
    {showAgreementForm && role === "owner" && <AgreementForm garden={activeGarden} members={members} onClose={() => setShowAgreementForm(false)} onSaved={(receipt) => { setShowAgreementForm(false); showCompletion(receipt); void refresh("agreements"); }} />}
    {showSettlementForm && role === "tapper" && <SettlementForm garden={activeGarden} role={role} onClose={() => setShowSettlementForm(false)} onSaved={(receipt) => { setShowSettlementForm(false); showCompletion(receipt); void refresh("settlements"); }} />}
      {completionReceipt && <CompletionReceipt receipt={completionReceipt} busy={completionOpening} openError={completionOpenError} onClose={returnCompletionToOverview} onOpen={() => void openCompletionRecord()} />}
      {deactivateTarget && <ConfirmDialog title="ปิดสิทธิ์คนกรีด" detail={`ถอด ${deactivateTarget.name || deactivateTarget.email || "คนกรีด"} ออกจากสวนนี้หรือไม่ ระบบจะตรวจสอบข้อตกลง รายการค้าง และยอดเงินคงค้างก่อนดำเนินการ`} busy={deactivateBusy} onCancel={() => setDeactivateTarget(null)} onConfirm={() => void deactivateMember()} />}
  </div>;
}
function CompletionReceipt({ receipt, busy, openError, onClose, onOpen }: { receipt: CompletionReceiptData; busy: boolean; openError: string; onClose: () => void; onOpen: () => void }) { return <div className="completion-backdrop" role="presentation"><section className="completion-receipt" role="dialog" aria-modal="true" aria-labelledby="completion-title"><CheckCircle2 size={38} aria-hidden="true" /><h2 id="completion-title">{receipt.title}</h2><p>{receipt.detail}</p><div className="completion-status"><span>สถานะใหม่</span><strong>{receipt.statusLabel}</strong></div><dl className="completion-summary">{receipt.rows.map((row) => <div key={`${row.label}-${row.value}`}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>{openError && <div className="form-error" role="alert">{openError}</div>}<div className="completion-actions"><button className="secondary" type="button" onClick={onClose} disabled={busy}>กลับหน้าหลัก</button>{receipt.nextScreen && <button className="primary" type="button" onClick={onOpen} disabled={busy}>{busy ? "กำลังเปิดรายการ..." : receipt.openLabel || "ดูรายการนี้"}</button>}</div></section></div>; }
function ReasonDialog({ title, prompt, impact, value, busy, onChange, onCancel, onConfirm, confirmLabel }: { title: string; prompt: string; impact: string; value: string; busy: boolean; onChange: (value: string) => void; onCancel: () => void; onConfirm: () => void; confirmLabel: string }) { return <div className="completion-backdrop" role="presentation"><section className="reason-dialog" role="dialog" aria-modal="true" aria-labelledby="reason-title"><h2 id="reason-title">{title}</h2><p>กรุณาระบุเหตุผลเพื่อให้ทั้งสองฝ่ายติดตามรายการได้</p><div className="reason-impact"><AlertTriangle size={18} aria-hidden="true" /><span><strong>ผลหลังยืนยัน</strong>{impact}</span></div><label>{prompt}<textarea autoFocus value={value} onChange={(event) => onChange(event.target.value)} placeholder="กรุณาระบุเหตุผล" required /></label><div className="completion-actions"><button className="secondary" type="button" onClick={onCancel} disabled={busy}>ยกเลิก</button><button className="danger-button" type="button" onClick={onConfirm} disabled={busy || !value.trim()}>{busy ? "กำลังดำเนินการ..." : confirmLabel}</button></div></section></div>; }
function ConfirmDialog({ title, detail, busy, onCancel, onConfirm }: { title: string; detail: string; busy: boolean; onCancel: () => void; onConfirm: () => void }) { return <div className="completion-backdrop" role="presentation"><section className="reason-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><h2 id="confirm-title">{title}</h2><p>{detail}</p><div className="completion-actions"><button className="secondary" type="button" onClick={onCancel} disabled={busy}>ยกเลิก</button><button className="danger-button" type="button" onClick={onConfirm} disabled={busy}>{busy ? "กำลังยกเลิก..." : "ยืนยันการยกเลิก"}</button></div></section></div>; }
function notificationTargetScreen(type: string): Screen {
  if (type.startsWith("settlement_")) return "settlements";
  if (type.startsWith("sale_") || type.startsWith("dispute_")) return "sales";
  if (type.startsWith("garden_member_")) return "gardens";
  if (type.startsWith("agreement_")) return "agreements";
  return "notifications";
}

function screenTitle(screen: Screen, role: Role) { if (screen === "settlements") return role === "owner" ? "เงินที่คนกรีดส่งมา" : "การส่งเงิน"; return ({ overview: "ภาพรวมการแบ่งรายได้", sales: "รายการขายยาง", gardens: "สวนและแปลง", agreements: "ข้อตกลงแบ่งรายได้", reports: "รายงาน", notifications: "การแจ้งเตือน" } as Record<Exclude<Screen, "settlements">, string>)[screen]; }

function screenDescription(screen: Screen, role: Role) {
  if (screen === "overview") return role === "owner" ? "ภาพรวมสิทธิในเงิน งานรอตรวจ และยอดคงค้าง" : "รายได้ของคุณ เงินเจ้าของที่ถืออยู่ และงานสำคัญวันนี้";
  return ({
    sales: "ตรวจสอบรายการขาย หลักฐาน และสถานะการยืนยัน",
    gardens: "ดูข้อมูลสวน สมาชิก และสิทธิ์การเข้าถึง",
    agreements: "ตรวจสัดส่วนและข้อตกลงที่ใช้คำนวณการแบ่งเงิน",
    settlements: role === "owner" ? "ตรวจเงินที่คนกรีดส่งมาและยืนยันการรับเงิน" : "ติดตามยอดที่ต้องส่งและประวัติการส่งเงิน",
    reports: "เลือกช่วงเวลาเพื่อดูยอดรวมและดาวน์โหลดตาราง",
    notifications: "ติดตามงานใหม่และเปิดรายการที่เกี่ยวข้อง",
  } as Record<Exclude<Screen, "overview">, string>)[screen];
}

function DeveloperCredit() {
  return <section className="developer-credit" aria-labelledby="developer-credit-title"><span className="developer-credit__label"><strong id="developer-credit-title">เกี่ยวกับแอป</strong><small>พัฒนาโดย <b>aod</b></small></span><a className="developer-credit__link" href="https://www.facebook.com/share/1AWvhjdr44/" target="_blank" rel="noopener noreferrer" aria-label="เปิด Facebook ของ aod"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.6 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.6-1.5h1.7V4a21 21 0 0 0-2.5-.1c-2.5 0-4.2 1.5-4.2 4.2V10H7.5v3h2.7v8h3.4Z" /></svg><span>Facebook</span></a></section>;
}

function AuthScreen({ clientId, status, onCredential, onError }: { clientId: string; status: SystemStatus; onCredential: (token: string) => void; onError: (detail: string) => void }) {
  return <main className="auth-screen"><div className="auth-orbit auth-orbit-one" aria-hidden="true" /><div className="auth-orbit auth-orbit-two" aria-hidden="true" /><section className="auth-card"><header className="auth-card-head"><div className="brand-mark"><Leaf size={24} /></div><div><p className="eyebrow">PARAWALLET SECURE ACCESS</p><span className="auth-kicker">บัญชีดิจิทัลสำหรับสวนยาง</span></div></header><div className="auth-copy"><h1>เข้าสู่ระบบ <span>ParaWallet</span></h1><p>จัดการยอดขาย ส่วนแบ่ง และการส่งเงินของสวนคุณอย่างเป็นระบบในที่เดียว</p></div><div className="auth-rule" aria-hidden="true"><span /><i>ปลอดภัยและเป็นส่วนตัว</i><span /></div><GoogleSignIn clientId={clientId} onCredential={onCredential} onError={onError} />{shouldShowStatus(status) && <SystemStatusBanner status={status} /> }<div className="auth-security-note" role="note"><ShieldCheck size={18} aria-hidden="true" /><span><strong>เข้าสู่ระบบด้วยบัญชี Google</strong><small>ระบบจะโหลดเฉพาะสวนและสิทธิ์ที่บัญชีของคุณได้รับอนุญาต</small></span></div><footer className="auth-footer"><span>Forest Fintech workspace</span><span><i aria-hidden="true" />ข้อมูลของคุณยังเป็นส่วนตัว</span></footer></section></main>;
}

function InitialSyncScreen({ loading, status, onRetry, onSignOut }: { loading: boolean; status: SystemStatus; onRetry: () => void; onSignOut: () => void }) {
  if (loading) return <main className="splash-screen"><LoadingAnimation variant="splash" label="กำลังเตรียม ParaWallet" detail="ตรวจสอบบัญชีและโหลดข้อมูลล่าสุด" /></main>;
  return <main className="auth-screen"><section className="auth-card"><div className="brand-mark"><Leaf size={24} /></div><p className="eyebrow">PARAWALLET SECURE SYNC</p><h1>ยังเชื่อมต่อข้อมูลไม่ได้</h1><p>ระบบยังไม่แสดงหน้าของเจ้าของสวนหรือคนกรีด จนกว่าจะตรวจสอบสิทธิ์สำเร็จ</p><SystemStatusBanner status={status} onRetry={onRetry} /><div className="quick-actions"><button className="secondary" onClick={onSignOut}>เปลี่ยนบัญชี Google</button></div></section></main>;
}

function SystemStatusBanner({ status, busy = false, onRetry, onDismiss }: { status: SystemStatus; busy?: boolean; onRetry?: () => void; onDismiss?: () => void }) {
  const alert = isErrorStatus(status);
  return <section className={`system-status ${status.scope} ${status.kind}`} role={alert ? "alert" : "status"} aria-live={alert ? "assertive" : "polite"}>
    <span className="system-status-icon" aria-hidden="true">{status.kind === "working" ? <LoaderCircle size={22} /> : status.kind === "success" ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}</span>
    <span className="system-status-copy"><strong>{status.title}</strong><span>{status.detail}</span>{status.nextAction && <small>{status.nextAction}</small>}</span>
    <span className="system-status-actions">{status.retryable && onRetry && <button className="secondary" type="button" onClick={onRetry} disabled={busy}>{busy ? "กำลังลองใหม่..." : "ลองใหม่"}</button>}{status.dismissible && onDismiss && <button className="icon-button" type="button" onClick={onDismiss} aria-label="ปิดข้อความสถานะ"><X size={17} /></button>}</span>
  </section>;
}

function Overview({ data, wallet, role, connected, onSale, onReceipt, onSettlement, onReviewSales, onReviewSettlements, onReports }: { data: DashboardData; wallet: WalletData | null; role: Role; connected: boolean; onSale: () => void; onReceipt: () => void; onSettlement: () => void; onReviewSales: () => void; onReviewSettlements: () => void; onReports: () => void }) {
  const owner = wallet?.owner.totalEntitlement ?? data.wallet.owner;
  const tapper = wallet?.tapper.totalIncome ?? data.wallet.tapper;
  const outstanding = wallet?.owner.outstanding ?? data.wallet.outstanding;
  const salesSeries = data.monthlySalesSeries || [];
  const salesSeriesMax = Math.max(1, ...salesSeries);
  const showMoney = (value: number) => connected ? money(value) : "—";
  if (role === "tapper") return <TapperOverview data={data} wallet={wallet} connected={connected} salesSeries={salesSeries} salesSeriesMax={salesSeriesMax} onReceipt={onReceipt} onSettlement={onSettlement} onReports={onReports} />;
  return <div className="owner-overview"><section className="pending-work" aria-label="งานที่เจ้าของต้องตรวจสอบ"><div><strong>งานที่ต้องทำ</strong><span>ตรวจหลักฐานก่อนยืนยันรายการขายและการรับเงิน</span></div><div className="pending-work-actions"><button onClick={onReviewSales}><FileText size={18} /><span>รายการขายรอตรวจ</span><strong>{data.pendingSales || 0}</strong></button><button onClick={onReviewSettlements}><WalletCards size={18} /><span>เงินที่คนกรีดส่งมารอยืนยัน</span><strong>{data.pendingSettlements || 0}</strong></button></div></section><section className="owner-wallet-pair" aria-label="กระเป๋าคู่ของเจ้าของ"><article><span><small>ส่วนแบ่งทั้งหมดของฉัน</small><WalletCards size={21} /></span><strong>{showMoney(owner)}</strong><p>ส่วนแบ่งที่ยืนยันแล้ว</p></article><article><span><small>ได้รับแล้ว</small><ShieldCheck size={21} /></span><strong>{showMoney(wallet?.owner.totalReceived || 0)}</strong><p>ยังอยู่กับคนกรีด {showMoney(outstanding)}</p></article></section><section className="owner-summary-grid"><Metric label="งานรอตรวจสอบ" value={connected ? `${data.pendingReviews} รายการ` : "—"} icon={<FileText />} /><Metric label="ยอดขายเดือนนี้" value={showMoney(data.monthlySales)} icon={<Sprout />} /></section><section className="owner-sales-card sales-card"><div><small>ยอดขายรวมเดือนนี้</small><strong>{showMoney(data.monthlySales)}</strong><span className="growth">{connected ? "ข้อมูลจากระบบ" : "รอเชื่อมต่อฐานข้อมูล"}</span></div><div className="bars">{connected && salesSeries.some((value) => value > 0) ? salesSeries.map((value, i) => <div key={i} style={{ height: `${Math.max(8, value / salesSeriesMax * 100)}%` }}><span>ส.{i + 1}</span></div>) : <p className="empty-chart">{connected ? "ยังไม่มียอดขายที่ยืนยันในเดือนนี้" : "กราฟจะแสดงเมื่อโหลดข้อมูลจริงสำเร็จ"}</p>}</div></section><section className="quick-actions"><button onClick={onReports}><FileDown size={18} />ดูรายงาน</button></section></div>;
}

function TapperOverview({ data, wallet, connected, salesSeries, salesSeriesMax, onReceipt, onSettlement, onReports }: { data: DashboardData; wallet: WalletData | null; connected: boolean; salesSeries: number[]; salesSeriesMax: number; onReceipt: () => void; onSettlement: () => void; onReports: () => void }) {
  const tapperIncome = wallet?.tapper.totalIncome ?? data.wallet.tapper;
  const ownerMoneyHeld = wallet?.tapper.ownerMoneyHeld ?? data.wallet.outstanding;
  const ownerMoneyTransferred = wallet?.tapper.ownerMoneyTransferred ?? 0;
  const showMoney = (value: number) => connected ? money(value) : "—";
  return <div className="tapper-overview">
    <section className="dual-wallet-priority" aria-label="กระเป๋าเงินคู่">
      <div className="dual-wallet-heading"><span><WalletCards size={21} />กระเป๋าเงินคู่</span><small>ยอดสิทธิของทั้งสองฝ่ายจากข้อมูลล่าสุด</small></div>
      <div className="dual-wallet-grid">
        <article className="wallet-tapper"><small>รายได้ของฉัน</small><strong>{showMoney(tapperIncome)}</strong><span>ส่วนแบ่งที่ยืนยันแล้ว</span></article>
        <article className="wallet-owner"><small>เงินเจ้าของที่ฉันถืออยู่</small><strong>{showMoney(ownerMoneyHeld)}</strong><span>รอส่งหรือรอเจ้าของยืนยัน</span></article>
      </div>
      <div className="wallet-transferred"><ShieldCheck size={16} /><span>ส่งให้เจ้าของและยืนยันแล้ว</span><strong>{showMoney(ownerMoneyTransferred)}</strong></div>
    </section>
    <section className="tapper-action-center" aria-label="งานหลักของคนกรีด">
      <button className="scan-receipt-cta desktop-scan-receipt" onClick={onReceipt}><Camera size={31} /><span><strong>เพิ่มรายการขาย</strong><small>ถ่ายภาพบิล เลือกภาพจากเครื่อง หรือกรอกตัวเลขเอง</small></span></button>
      <div className="tapper-secondary-actions">
        <button onClick={onSettlement}><Banknote size={21} /><span>บันทึกส่งเงิน</span></button>
        <button onClick={onReports}><FileDown size={21} /><span>รายงานและดาวน์โหลดตาราง</span></button>
      </div>
    </section>
    <section className="tapper-summary-grid"><Metric label="รายการกำลังรอเจ้าของสวนยืนยัน" value={connected ? `${data.pendingReviews} รายการ` : "—"} icon={<FileText />} /><Metric label="ยอดขายเดือนนี้" value={showMoney(data.monthlySales)} icon={<Sprout />} /></section>
    <section className="tapper-sales-card sales-card"><div><small>ยอดขายที่ยืนยันแล้วรายสัปดาห์</small><strong>{showMoney(data.monthlySales)}</strong><span className="growth">{connected ? "ข้อมูลจากระบบ" : "รอเชื่อมต่อฐานข้อมูล"}</span></div><div className="bars">{connected && salesSeries.some((value) => value > 0) ? salesSeries.map((value, i) => <div key={i} style={{ height: `${Math.max(8, value / salesSeriesMax * 100)}%` }}><span>ส.{i + 1}</span></div>) : <p className="empty-chart">{connected ? "ยังไม่มียอดขายที่ยืนยันในเดือนนี้" : "กราฟจะแสดงเมื่อโหลดข้อมูลจริงสำเร็จ"}</p>}</div></section>
  </div>;
}

const weekdayLabels = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const thaiDateKeyFromDate = (value: Date) => { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value); const fields = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])); return `${fields.year}-${fields.month}-${fields.day}`; };
const saleDateKey = (value?: string) => { if (!value) return ""; const dateOnly = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || ""; if (!value.includes("T")) return dateOnly; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? dateOnly : thaiDateKeyFromDate(parsed); };
const calendarMonthLabel = (value: Date) => value.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
const calendarDateLabel = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
};
const saleHasReceipt = (sale: Sale) => Boolean(sale.receiptFileId || sale.receiptId);

function SalesCalendar({ sales, role, onReview, onSale }: { sales: Sale[]; role: Role; onReview: (sale: Sale) => void; onSale: () => void }) {
  const [activeMonth, setActiveMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const salesByDate = useMemo(() => {
    const grouped = new Map<string, Sale[]>();
    sales.forEach((sale) => {
      const key = saleDateKey(sale.saleDate);
      if (!key) return;
      grouped.set(key, [...(grouped.get(key) || []), sale]);
    });
    return grouped;
  }, [sales]);
  const cells = useMemo(() => {
    const firstWeekday = new Date(activeMonth.getFullYear(), activeMonth.getMonth(), 1).getDay();
    const daysInMonth = new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 0).getDate();
    return Array.from({ length: firstWeekday + daysInMonth }, (_, index) => {
      if (index < firstWeekday) return { key: `empty-${index}`, day: 0, dateKey: "" };
      const day = index - firstWeekday + 1;
      return { key: `${activeMonth.getFullYear()}-${activeMonth.getMonth()}-${day}`, day, dateKey: `${activeMonth.getFullYear()}-${String(activeMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
    });
  }, [activeMonth]);
  const selectedSales = selectedDate ? salesByDate.get(selectedDate) || [] : [];
  const moveMonth = (offset: number) => {
    setActiveMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
    setSelectedDate(null);
  };

  return <div className="sales-calendar">
    <div className="calendar-toolbar">
      <div><span className="calendar-kicker"><CalendarDays size={16} />ปฏิทินรายการขาย</span><h3>{calendarMonthLabel(activeMonth)}</h3><p>วันที่ตัด (วันที่ในใบเสร็จ) ที่มีภาพใบเสร็จจะเปลี่ยนเป็นสีเขียว และแตะวันที่เพื่อดูรายการ</p></div>
      <div className="calendar-toolbar-actions"><button className="icon-button" type="button" onClick={() => moveMonth(-1)} aria-label="เดือนก่อนหน้า"><ChevronLeft size={18} /></button><button className="secondary" type="button" onClick={() => { setActiveMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setSelectedDate(null); }}>วันนี้</button><button className="icon-button" type="button" onClick={() => moveMonth(1)} aria-label="เดือนถัดไป"><ChevronRight size={18} /></button></div>
    </div>
    <div className="calendar-legend" aria-label="คำอธิบายสีปฏิทิน"><span><i className="calendar-legend-swatch receipt" />วันที่ตัดที่มีใบเสร็จ</span><span><i className="calendar-legend-swatch sale" />มีรายการแต่ยังไม่มีภาพใบเสร็จ</span></div>
    <div className="calendar-grid" role="grid" aria-label={`ปฏิทินรายการขาย ${calendarMonthLabel(activeMonth)}`}>
      {weekdayLabels.map((label) => <span className="calendar-weekday" role="columnheader" key={label}>{label}</span>)}
      {cells.map((cell) => {
        if (!cell.day) return <span className="calendar-day-empty" role="gridcell" aria-hidden="true" key={cell.key} />;
        const entries = salesByDate.get(cell.dateKey) || [];
        const hasReceipt = entries.some(saleHasReceipt);
        const isToday = cell.dateKey === thaiDateKeyFromDate(new Date());
        const isSelected = selectedDate === cell.dateKey;
        return <button type="button" role="gridcell" className={`calendar-day ${entries.length ? "has-sales" : ""} ${hasReceipt ? "has-receipt" : ""} ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}`} key={cell.key} onClick={() => setSelectedDate(cell.dateKey)} aria-label={`${calendarDateLabel(cell.dateKey)}${hasReceipt ? ` มีใบเสร็จ ${entries.filter(saleHasReceipt).length} รายการ` : entries.length ? ` มีรายการ ${entries.length} รายการ` : " ไม่มีรายการ"}`} aria-pressed={isSelected}><span className="calendar-day-number">{cell.day}</span>{entries.length > 0 && <span className="calendar-day-count">{entries.length} รายการ</span>}{hasReceipt && <span className="calendar-day-receipt">มีใบเสร็จ</span>}</button>;
      })}
    </div>
    <section className="calendar-selected-day" aria-live="polite">
      <div className="calendar-selected-head"><div><small>วันที่ตัด / วันที่ในใบเสร็จ</small><h3>{selectedDate ? calendarDateLabel(selectedDate) : "เลือกวันที่จากปฏิทิน"}</h3></div><span>{selectedDate ? `${selectedSales.length} รายการ` : "แตะช่องวันที่เพื่อเปิดรายการ"}</span></div>
      {!selectedDate ? <div className="calendar-empty-selection"><CalendarDays size={22} /><span>เลือกวันที่ตัดที่มีสีเขียวเพื่อดูรายการที่มีใบเสร็จและเปิดรายละเอียดเต็ม</span></div> : selectedSales.length === 0 ? <div className="calendar-empty-selection"><span>ไม่มีรายการขายในวันที่เลือก</span></div> : <div className="calendar-sale-list">{selectedSales.map((sale) => { const hasReceipt = saleHasReceipt(sale); const canConfirm = role === "owner" && sale.status === "pending_owner_review"; return <article className={`calendar-sale-card ${hasReceipt ? "with-receipt" : ""}`} key={sale.id}><div className="calendar-sale-card-main"><div><strong>{sale.buyerName || "ร้านรับซื้อไม่ระบุ"}</strong><span>{sale.productType || "ยางพารา"} · {sale.netWeight || sale.weightKg || 0} กก.</span><small>{hasReceipt ? `มีภาพใบเสร็จ · ระบบอ่านข้อมูลได้ ${Math.round(Number(sale.ocrConfidence || 0) * 100)}%` : "ยังไม่มีภาพใบเสร็จ"}</small></div><strong>{money(sale.grossSale || 0)}</strong></div><div className="calendar-sale-card-actions"><span className={`status ${sale.status}`}>{labelStatus(sale.status)}</span><button className={canConfirm ? "primary" : "link-button"} type="button" onClick={() => onReview(sale)}>{canConfirm ? <><ShieldCheck size={15} />ตรวจและยืนยัน</> : <><Eye size={15} />ดูรายละเอียดเต็ม</>}</button></div></article>; })}</div>}
    </section>
    {sales.length === 0 && <div className="calendar-no-data"><span>ยังไม่มีรายการขายจากสวนที่เลือก</span></div>}
  </div>;
}

const saleWorkflowMessage = (sale: Sale, role: Role) => {
  if (["pending_owner_review", "ocr_review"].includes(sale.status)) return role === "owner" ? "รอคุณตรวจหลักฐานและยืนยัน" : "รอเจ้าของสวนตรวจหลักฐานและยืนยัน";
  if (sale.status === "disputed") return "รอทั้งสองฝ่ายตรวจเหตุผลและสรุปข้อคัดค้าน";
  if (sale.status === "confirmed") return "ยืนยันแล้ว · ยอดถูกนำไปคำนวณในกระเป๋าคู่";
  return "เปิดรายละเอียดเพื่อตรวจสถานะและขั้นตอนถัดไป";
};
const saleSortValue = (sale: Sale) => String(sale.createdAt || sale.saleDate || "");
const sortSalesForWork = (items: Sale[]) => [...items].sort((a, b) => {
  const priority = (sale: Sale) => ["pending_owner_review", "ocr_review"].includes(sale.status) ? 0 : sale.status === "disputed" ? 1 : 2;
  return priority(a) - priority(b) || saleSortValue(b).localeCompare(saleSortValue(a));
});

function SalesScreen({ sales, role, initialView, onViewApplied, onSale, onReview, onRefresh }: { sales: Sale[]; role: Role; initialView?: SaleView; onViewApplied: () => void; onSale: () => void; onReview: (sale: Sale) => void; onRefresh: () => void }) {
  const [view, setView] = useState<SaleView>(initialView || (role === "owner" && sales.some((sale) => ["pending_owner_review", "ocr_review"].includes(sale.status)) ? "pending" : "latest"));
  useEffect(() => { if (initialView) { setView(initialView); onViewApplied(); } }, [initialView, onViewApplied]);
  const pending = sortSalesForWork(sales.filter((sale) => ["pending_owner_review", "ocr_review"].includes(sale.status)));
  const latest = sortSalesForWork(sales).slice(0, 20);
  const visible = view === "pending" ? pending : view === "latest" ? latest : view === "confirmed" ? sortSalesForWork(sales.filter((sale) => sale.status === "confirmed")) : sortSalesForWork(sales);
  return <section className="panel sales-panel">
    <div className="record-tabs" role="tablist" aria-label="มุมมองรายการขาย">{([["pending", `รอตรวจ${pending.length ? ` (${pending.length})` : ""}`], ["latest", "ล่าสุด"], ["confirmed", "ยืนยันแล้ว"], ["all", "ทั้งหมด"]] as const).map(([key, label]) => <button type="button" role="tab" aria-selected={view === key} className={view === key ? "active" : ""} onClick={() => setView(key)} key={key}>{label}</button>)}</div>
    {visible.length === 0 ? <PageState title={view === "pending" ? "ตรวจครบแล้ว" : "ยังไม่มีรายการขาย"} detail={view === "pending" ? "ขณะนี้ไม่มีรายการที่รอคุณตรวจ สามารถเปิดรายการล่าสุดเพื่อดูประวัติได้" : role === "tapper" ? "เพิ่มรายการขายจากภาพบิลหรือกรอกตัวเลขเองได้ทันที" : "เมื่อคนกรีดบันทึกรายการขาย รายการจะปรากฏที่นี่"} actionLabel={view === "pending" ? "ดูรายการล่าสุด" : role === "tapper" ? "เพิ่มรายการขาย" : undefined} onAction={view === "pending" ? () => setView("latest") : role === "tapper" ? onSale : undefined} /> : <>
      <section className="sale-primary-list" aria-label={view === "pending" ? "รายการขายที่รอตรวจ" : "รายการขายล่าสุด"}>
        <header><div><strong>{view === "pending" ? "รายการที่ต้องตรวจ" : view === "latest" ? "รายการล่าสุด" : view === "confirmed" ? "รายการที่ยืนยันแล้ว" : "รายการขายทั้งหมด"}</strong><span>เปิดรายละเอียดได้ทันทีโดยไม่ต้องเลือกวันที่จากปฏิทิน</span></div><em>{visible.length} รายการ</em></header>
        <div className="sale-record-cards">{visible.map((sale) => { const needsOwner = role === "owner" && ["pending_owner_review", "ocr_review"].includes(sale.status); return <article className={`sale-record-card ${needsOwner ? "needs-action" : ""}`} key={sale.id}><div className="sale-record-main"><div><strong>{sale.buyerName || "ร้านรับซื้อไม่ระบุ"}</strong><span>{formatThaiDateTime(sale.saleDate)} · {sale.productType || "ยางพารา"} · {sale.netWeight || sale.weightKg || 0} กก.</span><small>{saleWorkflowMessage(sale, role)}</small></div><strong>{money(sale.grossSale || 0)}</strong></div><div className="sale-record-actions"><span className={`status ${sale.status}`}>{labelStatus(sale.status)}</span><button className={needsOwner ? "primary" : "secondary"} type="button" onClick={() => onReview(sale)}>{needsOwner ? <><ShieldCheck size={15} />ตรวจและยืนยัน</> : <><Eye size={15} />ดูรายละเอียด</>}</button></div></article>; })}</div>
      </section>
      <details className="sale-calendar-disclosure"><summary><CalendarDays size={17} />ดูรายการในปฏิทิน</summary><SalesCalendar sales={visible} role={role} onReview={onReview} onSale={onSale} /></details>
    </>}
    <div className="calendar-bottom-actions"><button className="secondary" type="button" onClick={onRefresh}>รีเฟรชข้อมูล</button>{role === "tapper" && <button className="primary" type="button" onClick={onSale}><Plus size={16} />เพิ่มรายการขาย</button>}</div>
  </section>;
}

function SaleReviewModal({ sale, agreement, role, onClose, onChanged }: { sale: Sale; agreement?: Agreement; role: Role; onClose: () => void; onChanged: (receipt: CompletionReceiptData) => void }) {
  const hasReceipt = Boolean(sale.receiptFileId || sale.receiptId);
  const [evidence, setEvidence] = useState<SaleReceiptEvidence | null>(null);
  const [loadingEvidence, setLoadingEvidence] = useState(hasReceipt);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");
  useEffect(() => {
    let active = true;
    if (!hasReceipt) { setLoadingEvidence(false); return () => { active = false; }; }
    void api.sales.receipt(sale.id).then((result) => { if (active) setEvidence(result); }).catch((caught) => { if (active) setError(userMessageForApiError(caught)); }).finally(() => { if (active) setLoadingEvidence(false); });
    return () => { active = false; };
  }, [sale.id, hasReceipt]);
  const confirmSale = async () => {
    if (!reviewed || busy) return;
    setBusy(true); setError("");
    try {
      await api.sales.confirm(sale.id);
      onChanged({
        title: "ยืนยันรายการขายสำเร็จ",
        detail: "ส่วนแบ่งของทั้งสองฝ่ายย้ายจากยอดรอตรวจเป็นยอดยืนยันแล้ว",
        statusLabel: "ยืนยันแล้ว",
        rows: [
          { label: "ยอดขาย", value: money(sale.grossSale || 0) },
          { label: "กระเป๋าเจ้าของสวน", value: `เพิ่มยอดยืนยัน ${money(sale.ownerShare || 0)}` },
          { label: "กระเป๋าคนกรีด", value: `เพิ่มยอดยืนยัน ${money(sale.tapperShare || 0)}` }
        ],
        nextScreen: "sales",
        entityType: "sale",
        entityId: sale.id
      });
    }
    catch (caught) { setError(userMessageForApiError(caught)); }
    finally { setBusy(false); }
  };
  const disputeSale = async () => {
    if (!reason.trim() || busy) return;
    setBusy(true); setError("");
    try {
      await api.sales.dispute({ saleId: sale.id, reason: reason.trim() });
      setReasonOpen(false);
      onChanged({
        title: "คัดค้านรายการขายแล้ว",
        detail: "ระบบเก็บเหตุผลและประวัติรายการไว้ ยอดกระเป๋าจะยังไม่เปลี่ยนจนกว่าจะจัดการข้อคัดค้าน",
        statusLabel: "อยู่ระหว่างโต้แย้ง",
        rows: [{ label: "ยอดขาย", value: money(sale.grossSale || 0) }, { label: "ผลต่อกระเป๋า", value: "ยอดยืนยันยังไม่เปลี่ยน" }],
        nextScreen: "sales",
        entityType: "sale",
        entityId: sale.id
      });
    }
    catch (caught) { setError(userMessageForApiError(caught)); }
    finally { setBusy(false); }
  };
  const canDispute = ["pending_owner_review", "confirmed"].includes(sale.status);
  return <Modal title="ตรวจรายละเอียดรายการขาย" onClose={onClose}><div className="sale-review"><div className="sale-review-summary"><div><small>ยอดขายก่อนหัก</small><strong>{money(sale.grossSale || 0)}</strong><span>{formatThaiDateTime(sale.saleDate)} · {sale.buyerName || "ไม่ระบุร้านรับซื้อ"}</span></div><span className={`status ${sale.status}`}>{labelStatus(sale.status)}</span></div><section className="receipt-evidence"><div className="receipt-evidence-head"><div><Image size={18} /><span><strong>หลักฐานใบเสร็จ</strong><small>{hasReceipt ? `ระบบอ่านข้อมูลได้ ${Math.round(Number(sale.ocrConfidence || 0) * 100)}% · ต้องตรวจภาพจริง` : "รายการบันทึกด้วยมือ"}</small></span></div></div>{loadingEvidence ? <div className="receipt-placeholder loading-evidence"><LoadingAnimation compact label="กำลังโหลดใบเสร็จ" /></div> : evidence ? <img src={evidence.dataUrl} alt="ภาพใบเสร็จของรายการขายที่กำลังตรวจ" /> : <div className="receipt-placeholder manual"><FileText size={25} /><strong>ไม่มีภาพใบเสร็จ</strong><span>รายการนี้ถูกบันทึกด้วยมือ โปรดตรวจตัวเลขกับหลักฐานภายนอกก่อนยืนยัน</span></div>}</section><section className="sale-calculation"><h3>รายละเอียดและการแบ่งเงิน</h3><div className="sale-detail-grid"><Detail label="ประเภทสินค้า" value={sale.productType || "ไม่ระบุ"} /><Detail label="น้ำหนักสุทธิ" value={`${sale.netWeight || sale.weightKg || 0} กก.`} /><Detail label="ราคาต่อหน่วย" value={money(sale.unitPrice || 0)} /><Detail label="หักหน้าร้าน" value={money(sale.buyerDeductions || 0)} /><Detail label="ค่าใช้จ่ายร่วม" value={money(sale.sharedExpenses || 0)} /><Detail label="ฐานแบ่งเงิน" value={money(sale.splitBase || 0)} /></div><div className="split-review"><div><span>ส่วนของเจ้าของสวน</span><strong>{money(sale.ownerShare || 0)}</strong></div><div><span>ส่วนของคนกรีด</span><strong>{money(sale.tapperShare || 0)}</strong></div></div><small className="agreement-reference">{agreement ? `ข้อตกลงเวอร์ชัน ${agreement.version} · มีผล ${formatThaiDateTime(agreement.effectiveFrom)}` : "ไม่พบรายละเอียดเวอร์ชันข้อตกลง"}</small></section>{role === "owner" && sale.status === "pending_owner_review" && <label className="review-confirmation"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /><span><strong>ฉันตรวจหลักฐานและตัวเลขแล้ว</strong><small>เมื่อยืนยัน รายการจะเปลี่ยนจากรอตรวจเป็นยืนยันแล้ว</small></span></label>}{error && <div className="form-error" role="alert">{error}</div>}<div className="sale-review-actions">{canDispute && <button className="danger-button" disabled={busy} onClick={() => { setReason(""); setReasonOpen(true); }}>คัดค้านรายการ</button>}{role === "owner" && sale.status === "pending_owner_review" && <button className="primary" disabled={busy || !reviewed || loadingEvidence || Boolean(hasReceipt && !evidence)} onClick={() => void confirmSale()}><CheckCircle2 size={17} />{busy ? "กำลังยืนยัน..." : "ยืนยันรายการขาย"}</button>}{reasonOpen && <ReasonDialog title="คัดค้านรายการขาย" prompt="เหตุผลที่คัดค้าน" impact="สถานะจะเปลี่ยนเป็นอยู่ระหว่างโต้แย้ง และยอดยืนยันจะยังไม่เปลี่ยน" value={reason} busy={busy} onChange={setReason} onCancel={() => setReasonOpen(false)} onConfirm={() => void disputeSale()} confirmLabel="ส่งเหตุผลและคัดค้าน" />}</div></div></Modal>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div><small>{label}</small><strong>{value}</strong></div>; }

function GardensScreen({ garden, gardens, members, role, onCreate, onAddMember, onDeactivate }: { garden?: Garden; gardens: Garden[]; members: GardenMember[]; role: Role; onCreate: () => void; onAddMember: () => void; onDeactivate: (member: GardenMember) => void }) {
  return <section className="panel"><div className="panel-head"><div><h2>สวนและแปลง</h2><p>จัดการพื้นที่ จำนวนต้นยาง และสมาชิกที่เข้าถึงข้อมูลสวน</p></div>{role === "owner" && <button className="primary" onClick={onCreate}><Plus size={16} />เพิ่มสวน</button>}</div>{gardens.length === 0 ? <PageState title="บัญชีนี้ยังไม่มีสวน" detail={role === "owner" ? "เพิ่มสวนแรกเพื่อเริ่มจัดการสมาชิก ข้อตกลง และรายการขาย" : "เจ้าของสวนต้องเพิ่มบัญชี Google ของคุณเป็นคนกรีดก่อน"} actionLabel={role === "owner" ? "เพิ่มสวน" : undefined} onAction={role === "owner" ? onCreate : undefined} tone="permission" /> : <div className="card-grid">{gardens.map((item) => <div className="info-card" key={item.id}><span className="eyebrow">สวนที่ใช้งานอยู่</span><h3>{item.name}</h3><p>{item.province || "ไม่ระบุจังหวัด"} · {item.district || "ไม่ระบุอำเภอ"}</p><strong>{item.areaRai || 0} ไร่ · {(item.treeCount || 0).toLocaleString()} ต้น</strong></div>)}</div>}{role === "owner" && garden && <section className="member-management" aria-label="จัดการสมาชิกสวน"><div className="member-management-head"><div><span><Users size={19} />สมาชิกสวน</span><small>เฉพาะเจ้าของสวนเท่านั้นที่เพิ่มหรือปิดสิทธิ์คนกรีดได้</small></div><button className="secondary" onClick={onAddMember}><UserPlus size={16} />เพิ่มคนกรีด</button></div>{members.length === 0 ? <PageState title="ยังไม่มีคนกรีดในสวนนี้" detail="เพิ่มบัญชี Google ของคนกรีดเพื่อให้เข้าถึงข้อมูลสวนและบันทึกรายการได้" actionLabel="เพิ่มคนกรีด" onAction={onAddMember} /> : <div className="member-list">{members.map((member) => <article className="member-row" key={member.id}><div className="member-avatar">{member.role === "owner" ? "O" : "T"}</div><div><strong>{member.name || (member.role === "owner" ? "เจ้าของสวน" : "คนกรีด")}</strong><span>{member.email || "ไม่ระบุอีเมล"}</span><small>{member.role === "owner" ? "เจ้าของสวน" : "คนกรีด · ใช้งานอยู่"}</small></div>{member.role === "tapper" && <button className="danger-button" onClick={() => onDeactivate(member)}><UserMinus size={15} />ปิดสิทธิ์</button>}</article>)}</div>}</section>}</section>;
}

function AgreementsScreen({ agreements, garden, role, onCreate }: { agreements: Agreement[]; garden?: Garden; role: Role; onCreate: () => void }) { return <section className="panel"><div className="panel-head"><div><h2>ข้อตกลงแบ่งรายได้</h2><p>{garden?.name || "เลือกสวนก่อนสร้างข้อตกลง"} · ทุกเวอร์ชันไม่กระทบรายการย้อนหลัง</p></div>{role === "owner" && <button className="secondary" onClick={onCreate}>สร้างเวอร์ชันใหม่</button>}</div>{agreements.length === 0 ? <PageState title="ยังไม่มีข้อตกลงแบ่งรายได้" detail={role === "owner" ? "สร้างข้อตกลงเพื่อกำหนดส่วนแบ่งก่อนบันทึกรายการขาย" : "เจ้าของสวนต้องสร้างข้อตกลงก่อน คุณจึงจะบันทึกรายการขายได้"} actionLabel={role === "owner" ? "สร้างข้อตกลง" : undefined} onAction={role === "owner" ? onCreate : undefined} /> : <div className="data-list">{agreements.map((agreement) => <article className="data-row" key={agreement.id}><div><strong>เวอร์ชัน {agreement.version}</strong><span>มีผล {formatThaiDateTime(agreement.effectiveFrom)} · {labelStatus(agreement.status)}</span></div><div><strong>{agreement.ownerPercentage}/{agreement.tapperPercentage}</strong><span>เจ้าของสวน / คนกรีด</span></div></article>)}</div>}</section>; }

function SettlementsScreen({ settlements, wallet, role, focusedSettlementId, onFocusHandled, onCreate, onRefresh, onCompleted }: { settlements: Settlement[]; wallet: WalletData | null; role: Role; focusedSettlementId?: string; onFocusHandled: () => void; onCreate: () => void; onRefresh: () => void; onCompleted: (receipt: CompletionReceiptData) => void }) {
  const [reviewSettlement, setReviewSettlement] = useState<Settlement | null>(null);
  const [cancelBusyId, setCancelBusyId] = useState("");
  const [error, setError] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Settlement | null>(null);
  useEffect(() => {
    if (!focusedSettlementId) return;
    const target = settlements.find((item) => item.id === focusedSettlementId);
    if (target) setReviewSettlement(target);
    onFocusHandled();
  }, [focusedSettlementId, settlements, onFocusHandled]);
  const cancelSettlement = async (item: Settlement) => {
    if (cancelBusyId) return;
    setCancelBusyId(item.id); setError("");
    try {
      await api.settlements.cancel(item.id);
      setCancelTarget(null);
      onCompleted({ title: "ยกเลิกรายการส่งเงินแล้ว", detail: "รายการยังอยู่ในประวัติ และยอดคงค้างของเจ้าของสวนไม่เปลี่ยน", statusLabel: "ยกเลิกแล้ว", rows: [{ label: "จำนวนเงิน", value: money(item.amount) }, { label: "ยอดคงค้าง", value: "ไม่เปลี่ยน" }], nextScreen: "settlements", entityType: "settlement", entityId: item.id });
      onRefresh();
    }
    catch (caught) { setError(userMessageForApiError(caught)); }
    finally { setCancelBusyId(""); }
  };
  return <>
    <section className="panel">
      <div className="panel-head">
        <div><h2>การส่งเงินและยอดคงค้าง</h2><p>เงินของเจ้าของที่ยังอยู่กับคนกรีด: {money(wallet?.owner.outstanding || 0)}</p></div>
        <div className="panel-actions"><button className="secondary" onClick={onRefresh}>รีเฟรช</button>{role === "tapper" && <button className="primary" onClick={onCreate}><Plus size={16} />บันทึกการส่งเงิน</button>}</div>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {settlements.length === 0 ? <PageState title="ยังไม่มีประวัติการส่งเงิน" detail={role === "tapper" ? "เมื่อส่งเงินให้เจ้าของสวนแล้ว ให้บันทึกยอดและแนบหลักฐานที่นี่" : "เมื่อคนกรีดบันทึกการส่งเงิน รายการจะปรากฏให้คุณตรวจและยืนยันที่นี่"} actionLabel={role === "tapper" ? "บันทึกการส่งเงิน" : undefined} onAction={role === "tapper" ? onCreate : undefined} /> : <div className="data-list">{settlements.map((item) =>
        <article className="data-row settlement-row" key={item.id}>
          <div className="settlement-row-copy">
            <strong>{money(item.amount)}</strong>
            <span>{item.method === "cash" ? `เงินสด · ${item.location || "ไม่ระบุสถานที่"}` : `โอนธนาคาร${item.bank ? ` · ${item.bank}` : ""}`} · {formatThaiDateTime(item.transferDate)}</span>
            <small className="evidence-label">{item.method === "bank_transfer" ? <><FileText size={13} />{item.slipFileId ? "มีสลิปแนบ" : "ไม่พบสลิป"}</> : <><Banknote size={13} />รอเจ้าของสวน ยืนยันการรับเงินสด</>}</small>
          </div>
          <span className={`status ${item.status}`}>{labelStatus(item.status)}</span>
          <div className="panel-actions settlement-confirm-actions settlement-row-actions">
            <button className={role === "owner" && item.status === "pending_owner_confirmation" ? "primary" : "link-button"} onClick={() => setReviewSettlement(item)}>{role === "owner" && item.status === "pending_owner_confirmation" ? <><ShieldCheck size={15} />ตรวจและยืนยัน</> : <><Eye size={15} />ดูรายละเอียด</>}</button>
            {role === "tapper" && item.status === "pending_owner_confirmation" && <button className="link-button" disabled={Boolean(cancelBusyId)} onClick={() => setCancelTarget(item)}>{cancelBusyId === item.id ? "กำลังยกเลิก..." : "ยกเลิก"}</button>}
          </div>
        </article>
      )}</div>}
    </section>
    {reviewSettlement && <SettlementReviewModal settlement={reviewSettlement} outstandingBefore={wallet?.owner.outstanding} role={role} onClose={() => setReviewSettlement(null)} onChanged={(receipt) => { setReviewSettlement(null); onCompleted(receipt); onRefresh(); }} />}
    {cancelTarget && <ConfirmDialog title="ยกเลิกรายการส่งเงิน" detail={`ยกเลิกรายการจำนวน ${money(cancelTarget.amount)} หรือไม่ รายการที่ยกเลิกจะยังคงอยู่ในประวัติ`} busy={Boolean(cancelBusyId)} onCancel={() => setCancelTarget(null)} onConfirm={() => void cancelSettlement(cancelTarget)} />}
  </>;
}

function SettlementReviewModal({ settlement, outstandingBefore, role, onClose, onChanged }: { settlement: Settlement; outstandingBefore?: number; role: Role; onClose: () => void; onChanged: (receipt: CompletionReceiptData) => void }) {
  const [evidence, setEvidence] = useState<SettlementEvidence | null>(null);
  const [loadingEvidence, setLoadingEvidence] = useState(settlement.method === "bank_transfer" && Boolean(settlement.slipFileId));
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");
  useEffect(() => {
    let active = true;
    if (settlement.method !== "bank_transfer" || !settlement.slipFileId) { setLoadingEvidence(false); return () => { active = false; }; }
    void api.settlements.evidence(settlement.id).then((result) => { if (active) setEvidence(result); }).catch((caught) => { if (active) setError(userMessageForApiError(caught)); }).finally(() => { if (active) setLoadingEvidence(false); });
    return () => { active = false; };
  }, [settlement.id, settlement.method, settlement.slipFileId]);
  const confirmSettlement = async () => {
    if (!reviewed || busy) return;
    setBusy(true); setError("");
    try {
      await api.settlements.confirm(settlement.id);
      const rows = [{ label: "ยอดที่ได้รับ", value: money(settlement.amount) }];
      if (outstandingBefore !== undefined) {
        rows.push({ label: "ยอดคงค้างก่อนยืนยัน", value: money(outstandingBefore) });
        rows.push({ label: "ยอดคงค้างใหม่", value: money(Math.max(0, outstandingBefore - settlement.amount)) });
      } else rows.push({ label: "ผลต่อยอดคงค้าง", value: `ลดลง ${money(settlement.amount)}` });
      onChanged({ title: "ยืนยันการรับเงินสำเร็จ", detail: "บันทึกการรับเงินจริงแล้ว และตัดยอดคงค้างของเจ้าของสวนตามจำนวนที่ยืนยัน", statusLabel: "ยืนยันรับเงินแล้ว", rows, nextScreen: "settlements", entityType: "settlement", entityId: settlement.id });
    }
    catch (caught) { setError(userMessageForApiError(caught)); }
    finally { setBusy(false); }
  };
  const rejectSettlement = async () => {
    if (!reason.trim() || busy) return;
    setBusy(true); setError("");
    try {
      await api.settlements.reject({ settlementId: settlement.id, reason: reason.trim() });
      setReasonOpen(false);
      onChanged({ title: "ปฏิเสธรายการส่งเงินแล้ว", detail: "แจ้งเหตุผลให้คนกรีดแล้ว รายการนี้ไม่ถูกนำไปตัดยอดคงค้าง", statusLabel: "ปฏิเสธแล้ว", rows: [{ label: "จำนวนเงิน", value: money(settlement.amount) }, { label: "ยอดคงค้าง", value: outstandingBefore === undefined ? "ไม่เปลี่ยน" : `${money(outstandingBefore)} (ไม่เปลี่ยน)` }], nextScreen: "settlements", entityType: "settlement", entityId: settlement.id });
    }
    catch (caught) { setError(userMessageForApiError(caught)); }
    finally { setBusy(false); }
  };
  const isPendingOwnerReview = role === "owner" && settlement.status === "pending_owner_confirmation";
  const evidenceReady = settlement.method === "cash" || Boolean(evidence);
  return <Modal title="ตรวจรายละเอียดการส่งเงิน" onClose={onClose}><div className="sale-review settlement-review"><div className="sale-review-summary"><div><small>ยอดที่คนกรีดส่งให้เจ้าของสวน</small><strong>{money(settlement.amount)}</strong><span>{formatThaiDateTime(settlement.transferDate)} · {settlement.method === "cash" ? "เงินสด" : "โอนธนาคาร"}</span></div><span className={`status ${settlement.status}`}>{labelStatus(settlement.status)}</span></div><section className="receipt-evidence settlement-evidence"><div className="receipt-evidence-head"><div>{settlement.method === "cash" ? <Banknote size={18} /> : <Image size={18} />}<span><strong>{settlement.method === "cash" ? "หลักฐานการรับเงินสด" : "สลิปการโอนเงิน"}</strong><small>{settlement.method === "cash" ? "ยืนยันต่อหน้าบนมือถือของเจ้าของสวน" : "ไฟล์ส่วนตัวจาก Google Drive"}</small></span></div></div>{settlement.method === "cash" ? <div className="receipt-placeholder manual cash-evidence"><Banknote size={28} /><strong>โปรดตรวจนับเงินสดก่อนยืนยัน</strong><span>สถานที่ส่งมอบ: {settlement.location || "ไม่ระบุ"}</span></div> : loadingEvidence ? <div className="receipt-placeholder loading-evidence"><LoadingAnimation compact label="กำลังโหลดสลิป" /></div> : evidence?.mimeType === "application/pdf" ? <div className="pdf-evidence"><FileText size={28} /><strong>{evidence.name}</strong><a className="secondary" href={evidence.dataUrl} download={evidence.name}><FileDown size={15} />เปิดไฟล์ PDF</a></div> : evidence ? <img src={evidence.dataUrl} alt="สลิปการส่งเงินที่กำลังตรวจ" /> : <div className="receipt-placeholder manual"><FileText size={25} /><strong>ไม่พบสลิป</strong><span>ห้ามยืนยันรายการโอนจนกว่าจะตรวจสอบหลักฐานได้</span></div>}</section><section className="sale-calculation"><h3>รายละเอียดการส่งมอบ</h3><div className="sale-detail-grid"><Detail label="วิธีส่งเงิน" value={settlement.method === "cash" ? "เงินสด" : "โอนธนาคาร"} /><Detail label="วันที่ส่งเงิน" value={formatThaiDateTime(settlement.transferDate)} /><Detail label="ธนาคาร" value={settlement.bank || "—"} /><Detail label="เลขอ้างอิง" value={settlement.referenceNo || "—"} /><Detail label="สถานที่" value={settlement.location || "—"} /><Detail label="หมายเหตุ" value={settlement.note || "—"} /></div></section>{isPendingOwnerReview && <label className="review-confirmation"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /><span><strong>{settlement.method === "cash" ? "ฉันตรวจนับและได้รับเงินสดจริงแล้ว" : "ฉันตรวจสลิปและพบยอดเงินเข้าจริงแล้ว"}</strong><small>เมื่อยืนยัน ระบบจะตัดยอดคงค้างและบันทึกประวัติของทั้งสองฝ่าย</small></span></label>}{error && <div className="form-error" role="alert">{error}</div>}<div className="sale-review-actions">{isPendingOwnerReview && <button className="danger-button" disabled={busy} onClick={() => { setReason(""); setReasonOpen(true); }}>ปฏิเสธรายการ</button>}{isPendingOwnerReview && <button className="primary" disabled={busy || !reviewed || loadingEvidence || !evidenceReady} onClick={() => void confirmSettlement()}><CheckCircle2 size={17} />{busy ? "กำลังยืนยัน..." : settlement.method === "cash" ? "ยืนยันว่าได้รับเงินสดแล้ว" : "ยืนยันยอดโอนแล้ว"}</button>}{reasonOpen && <ReasonDialog title="ปฏิเสธรายการส่งเงิน" prompt="เหตุผลที่ปฏิเสธ" impact="รายการจะถูกปฏิเสธและยอดคงค้างจะไม่ถูกตัด" value={reason} busy={busy} onChange={setReason} onCancel={() => setReasonOpen(false)} onConfirm={() => void rejectSettlement()} confirmLabel="ส่งเหตุผลและปฏิเสธ" />}</div></div></Modal>;
}

function ReportsScreen({ garden }: { garden?: Garden }) {
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(dateToday());
  const [report, setReport] = useState<{ summary: Record<string, number | string>; rows: Sale[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    if (!garden || busy) return;
    setBusy(true); setError("");
    try { setReport(await api.reports.summary({ gardenId: garden.id, from, to })); }
    catch (caught) { setError(userMessageForApiError(caught)); }
    finally { setBusy(false); }
  };
  const exportCsv = () => { if (!report) return; const lines = [["saleDate","buyerName","grossSale","ownerShare","tapperShare","status"], ...report.rows.map((row) => [row.saleDate, row.buyerName || "", row.grossSale || 0, row.ownerShare || 0, row.tapperShare || 0, row.status])]; const blob = new Blob([lines.map((line) => line.join(",")).join("\n")], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "parawallet-report.csv"; anchor.click(); URL.revokeObjectURL(url); };
  return <section className="panel"><div className="panel-head"><div><h2>รายงานตามช่วงเวลา</h2><p>คำนวณจากรายการขายและการส่งเงินในระบบ</p></div><div className="report-download"><button className="secondary" disabled={!report || report.rows.length === 0 || busy} onClick={exportCsv}>ดาวน์โหลดตาราง</button>{(!report || report.rows.length === 0) && <small>โหลดรายงานที่มีรายการก่อน จึงจะดาวน์โหลดตารางได้</small>}</div></div><div className="filters"><label>ตั้งแต่<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>ถึง<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label><button className="primary" disabled={busy || !garden} onClick={() => void load()}>{busy ? "กำลังโหลดรายงาน..." : "ดูรายงาน"}</button></div>{error && <div className="form-error report-error" role="alert"><strong>โหลดรายงานไม่สำเร็จ</strong><span>{error}</span><button className="secondary" type="button" onClick={() => void load()} disabled={busy}>ลองใหม่</button></div>}{report && report.rows.length > 0 ? <div className="report-grid">{[["ยอดขายรวม", money(Number(report.summary.grossSales))], ["ส่วนเจ้าของ", money(Number(report.summary.ownerShare))], ["ส่วนคนกรีด", money(Number(report.summary.tapperShare))], ["ยอดคงค้าง", money(Number(report.summary.outstanding))]].map(([label, value]) => <div className="metric" key={label}><small>{label}</small><strong>{value}</strong></div>)}</div> : report ? <PageState title="ไม่พบรายการในช่วงนี้" detail="ลองขยายช่วงวันที่ แล้วกดดูรายงานอีกครั้ง" actionLabel="โหลดรายงานอีกครั้ง" onAction={() => void load()} /> : !error && <PageState title="เลือกระยะเวลาของรายงาน" detail="กำหนดวันที่เริ่มและสิ้นสุด แล้วกดดูรายงาน" tone="info" />}</section>;
}

function NotificationsScreen({ notifications, onOpen }: { notifications: Notification[]; onOpen: (item: Notification) => void }) {
  const unread = notifications.filter((item) => !item.readAt).length;
  return <section className="panel"><div className="panel-head"><div><h2>การแจ้งเตือน</h2><p>{unread > 0 ? `ยังไม่อ่าน ${unread} รายการ · แตะเพื่อเปิดงานที่เกี่ยวข้อง` : "อ่านครบแล้ว · รายการใหม่จะปรากฏที่นี่"}</p></div></div>{notifications.length === 0 ? <PageState title="ยังไม่มีการแจ้งเตือน" detail="เมื่อมีรายการใหม่ งานรอตรวจ หรือการเปลี่ยนสถานะ ระบบจะแจ้งที่หน้านี้" /> : <div className="data-list">{notifications.map((item) => <button type="button" className={`data-row notification-row ${item.readAt ? "read" : "unread"}`} key={item.id} onClick={() => onOpen(item)}><span className="notification-state" aria-hidden="true" /><span className="notification-copy"><strong>{item.title}</strong><span>{item.body}</span><small>{new Date(item.createdAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}</small></span><span className="notification-action">เปิดรายการ</span></button>)}</div>}</section>;
}

function GardenForm({ onClose, onSaved }: { onClose: () => void; onSaved: (receipt: CompletionReceiptData) => void }) {
  const [form, setForm] = useState({ name: "", province: "", district: "", areaRai: "", treeCount: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      await api.gardens.create({ name: form.name, province: form.province, district: form.district, areaRai: Number(form.areaRai), treeCount: Number(form.treeCount) });
      onSaved({ title: "เพิ่มสวนสำเร็จ", detail: "สวนใหม่พร้อมใช้และจะแสดงในหน้าสวนและสมาชิก", statusLabel: "พร้อมใช้งาน", rows: [{ label: "ชื่อสวน", value: form.name }, { label: "พื้นที่", value: `${Number(form.areaRai || 0).toLocaleString("th-TH")} ไร่` }], nextScreen: "gardens", openLabel: "ดูสวนใหม่" });
    }
    catch (caught) { setError(userMessageForApiError(caught)); }
    finally { setBusy(false); }
  };
  return <Modal title="เพิ่มสวนใหม่" onClose={onClose}><form className="form-grid" onSubmit={submit}><label>ชื่อสวน<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>จังหวัด<input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} /></label><label>อำเภอ<input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></label><label>พื้นที่ (ไร่)<input type="number" min="0" value={form.areaRai} onChange={(e) => setForm({ ...form, areaRai: e.target.value })} /></label><label>จำนวนต้นยาง<input type="number" min="0" value={form.treeCount} onChange={(e) => setForm({ ...form, treeCount: e.target.value })} /></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="primary" disabled={busy}>{busy ? "กำลังบันทึกสวน..." : "บันทึกสวน"}</button></form></Modal>;
}

function MemberForm({ garden, onClose, onSaved }: { garden?: Garden; onClose: () => void; onSaved: (receipt: CompletionReceiptData) => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!garden || busy) return;
    setBusy(true); setError("");
    try {
      const normalizedEmail = email.trim().toLowerCase();
      await api.members.add({ gardenId: garden.id, email: normalizedEmail });
      onSaved({ title: "เพิ่มคนกรีดสำเร็จ", detail: "บัญชีนี้เข้าใช้ข้อมูลของสวนได้แล้ว", statusLabel: "ใช้งานอยู่", rows: [{ label: "คนกรีด", value: normalizedEmail }, { label: "สวน", value: garden.name }], nextScreen: "gardens", openLabel: "ดูสมาชิกสวน" });
    }
    catch (caught) { setError(userMessageForApiError(caught)); }
    finally { setBusy(false); }
  };
  return <Modal title="เพิ่มคนกรีดเข้าสวน" onClose={onClose}><form className="form-grid member-form" onSubmit={submit}><div className="transparency-note"><ShieldCheck size={19} /><div><strong>เพิ่มได้เฉพาะบัญชีคนกรีดที่ลงทะเบียนแล้ว</strong><span>อีเมลต้องตรงกับบัญชี Google และมีสถานะใช้งานอยู่ในรายชื่อผู้ใช้</span></div></div><label>อีเมล Google ของคนกรีด<input required type="email" inputMode="email" autoCapitalize="none" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@gmail.com" /></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="primary" disabled={busy || !garden || !email.trim()}>{busy ? "กำลังตรวจสอบบัญชี..." : "เพิ่มคนกรีดเข้าสวน"}</button></form></Modal>;
}

function SaleForm({ garden, agreement, role, onClose, onSaved }: { garden?: Garden; agreement?: Agreement; role: Role; onClose: () => void; onSaved: (receipt: CompletionReceiptData) => void }) {
  const [form, setForm] = useState({ saleDate: dateToday(), buyerName: "", productType: "ยางก้อนถ้วย", weightKg: "", unitPrice: "", buyerDeductions: "0", sharedExpenses: "0" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const total = Number(form.weightKg || 0) * Number(form.unitPrice || 0);
  const splitBase = Math.max(0, total - Number(form.buyerDeductions || 0) - Number(form.sharedExpenses || 0));
  const owner = splitBase * Number(agreement?.ownerPercentage || 60) / 100;
  const tapper = splitBase - owner;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!garden || !agreement || busy) return;
    setBusy(true); setError("");
    try {
      const created = await api.sales.create({ gardenId: garden.id, agreementId: agreement.id, saleDate: form.saleDate, buyerName: form.buyerName, productType: form.productType, weightKg: Number(form.weightKg), unitPrice: Number(form.unitPrice), buyerDeductions: Number(form.buyerDeductions), sharedExpenses: Number(form.sharedExpenses), manualEntry: true }) as { id: string; calculation?: { grossSale?: number }; status: string };
      onSaved({ title: "บันทึกรายการขายสำเร็จ", detail: "ส่งรายการให้เจ้าของสวนตรวจแล้ว ยอดนี้ยังไม่เข้ากระเป๋ายืนยัน", statusLabel: "รอเจ้าของตรวจ", rows: [{ label: "ยอดขาย", value: money(created.calculation?.grossSale ?? total) }, { label: "ประเภทสินค้า", value: form.productType }, { label: "วันที่ขาย", value: formatThaiDateTime(form.saleDate) }], nextScreen: "sales", entityType: "sale", entityId: created.id });
    }
    catch (caught) { setError(userMessageForApiError(caught)); }
    finally { setBusy(false); }
  };
  return <Modal title={role === "tapper" ? "บันทึกรายการขาย" : "ทบทวนรายการขาย"} onClose={onClose}><form className="form-grid" onSubmit={submit}><label>วันที่ขาย<input type="date" required value={form.saleDate} onChange={(e) => setForm({ ...form, saleDate: e.target.value })} /></label><label>ร้านรับซื้อ<input value={form.buyerName} onChange={(e) => setForm({ ...form, buyerName: e.target.value })} /></label><label>ประเภทสินค้า<select value={form.productType} onChange={(e) => setForm({ ...form, productType: e.target.value })}><option>น้ำยางสด</option><option>ยางก้อนถ้วย</option><option>ยางแผ่น</option><option>อื่น ๆ</option></select></label><label>น้ำหนัก (กก.)<input type="number" min="0" step="0.01" required value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} /></label><label>ราคา/กก.<input type="number" min="0" step="0.01" required value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} /></label><label>หักหน้าร้าน<input type="number" min="0" step="0.01" value={form.buyerDeductions} onChange={(e) => setForm({ ...form, buyerDeductions: e.target.value })} /></label><label>ค่าใช้จ่ายร่วม<input type="number" min="0" step="0.01" value={form.sharedExpenses} onChange={(e) => setForm({ ...form, sharedExpenses: e.target.value })} /></label><div className="calculation-preview"><span>ฐานแบ่ง {money(splitBase)}</span><strong>เจ้าของสวน {money(owner)} · คนกรีด {money(tapper)}</strong></div>{error && <div className="form-error" role="alert">{error}</div>}<button className="primary" disabled={busy || !garden || !agreement}>{busy ? "กำลังบันทึกรายการขาย..." : "ยืนยันรายการ"}</button>{!agreement && <small className="form-hint">ต้องมี ข้อตกลงที่ใช้งานอยู่ ก่อนสร้างรายการขาย</small>}</form></Modal>;
}

function SettlementForm({ garden, role, onClose, onSaved }: { garden?: Garden; role: Role; onClose: () => void; onSaved: (receipt: CompletionReceiptData) => void }) {
  const [form, setForm] = useState({ amount: "", method: "bank_transfer", transferDate: dateToday(), referenceNo: "", bank: "", location: "", note: "" });
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectSlip = (selected: File | null) => {
    setError("");
    if (selected && !selected.type.startsWith("image/") && selected.type !== "application/pdf") { setSlipFile(null); setError("สลิปต้องเป็นรูปภาพหรือไฟล์ PDF เท่านั้น"); return; }
    if (selected && selected.size > MAX_EVIDENCE_BYTES) { setSlipFile(null); setError("ไฟล์สลิปต้องมีขนาดไม่เกิน 4 MB"); return; }
    setSlipFile(selected);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!garden || busy) return;
    if (form.method === "bank_transfer" && !slipFile) { setError("กรุณาแนบสลิปการโอนเงิน"); return; }
    if (form.method === "cash" && !form.location.trim()) { setError("กรุณาระบุสถานที่ส่งมอบเงินสด"); return; }
    setBusy(true); setError("");
    try {
      const slipData = slipFile ? await readFileAsDataUrl_(slipFile) : "";
      const created = await api.settlements.create({ gardenId: garden.id, amount: Number(form.amount), method: form.method, transferDate: form.transferDate, referenceNo: form.referenceNo, bank: form.bank, location: form.location, note: form.note, slipData, slipMimeType: slipFile?.type || "", slipFilename: slipFile?.name || "" });
      onSaved({ title: "ส่งข้อมูลการส่งเงินสำเร็จ", detail: "เจ้าของสวนได้รับงานตรวจแล้ว ยอดคงค้างจะยังไม่ลดจนกว่าเจ้าของยืนยันรับเงินจริง", statusLabel: "รอเจ้าของยืนยันรับเงิน", rows: [{ label: "จำนวนเงิน", value: money(created.amount) }, { label: "วิธีส่ง", value: created.method === "cash" ? "ส่งมอบเงินสด" : "โอนธนาคาร" }, { label: "หลักฐาน", value: created.method === "cash" ? "รอยืนยันการรับเงินสด" : created.slipFileId ? "แนบสลิปแล้ว" : "ยังไม่พบสลิป" }], nextScreen: "settlements", entityType: "settlement", entityId: created.id });
    } catch (caught) { setError(userMessageForApiError(caught)); }
    finally { setBusy(false); }
  };
  return <Modal title={role === "owner" ? "บันทึกการรับเงิน" : "บันทึกการส่งเงิน"} onClose={onClose}><form className="form-grid settlement-form" onSubmit={submit}><label>จำนวนเงิน<input required type="number" min="0.01" step="0.01" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label><label>วิธีส่งเงิน<select value={form.method} onChange={(e) => { setForm({ ...form, method: e.target.value }); setError(""); }}><option value="bank_transfer">โอนธนาคาร</option><option value="cash">ส่งมอบเงินสด</option></select></label><label>วันที่ส่งเงิน<input required type="date" value={form.transferDate} onChange={(e) => setForm({ ...form, transferDate: e.target.value })} /></label>{form.method === "bank_transfer" ? <><label>ธนาคาร<input required value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} placeholder="ชื่อธนาคาร" /></label><label>เลขอ้างอิง<input value={form.referenceNo} onChange={(e) => setForm({ ...form, referenceNo: e.target.value })} placeholder="เลขอ้างอิงในสลิป" /></label><label className="slip-upload"><span><Upload size={17} />แนบสลิปการโอน</span><input required type="file" accept="image/*,application/pdf" onChange={(event) => selectSlip(event.target.files?.[0] || null)} /><small>รองรับรูปภาพหรือ PDF ไม่เกิน 4 MB</small></label>{slipFile && <div className="evidence-selected"><ShieldCheck size={17} /><span>แนบแล้ว: {slipFile.name}</span></div>}<div className="transparency-note"><ShieldCheck size={19} /><div><strong>เจ้าของสวนต้องตรวจสอบและยืนยันยอดโอน</strong><span>รายการจะยังไม่หักยอดคงค้างจนกว่าเจ้าของสวน จะกดยืนยัน</span></div></div></> : <><label>สถานที่ส่งมอบเงินสด<input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="เช่น ที่สวนป่าพะยอม" /></label><div className="transparency-note cash"><Banknote size={19} /><div><strong>เจ้าของสวนต้องกดยืนยันว่าได้รับเงินสดแล้ว</strong><span>ทั้งสองฝ่ายจะเห็นสถานะรอยืนยันและประวัติเดียวกัน</span></div></div></>}<label>หมายเหตุ<textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" /></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="primary settlement-submit" disabled={busy || !garden || (form.method === "bank_transfer" && !slipFile)}>{busy ? "กำลังบันทึกหลักฐาน..." : form.method === "cash" ? "ส่งให้เจ้าของยืนยันรับเงินสด" : "ส่งยอดโอนพร้อมสลิปให้เจ้าของยืนยัน"}</button></form></Modal>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="modal-backdrop" role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label={`ปิดหน้าต่าง ${title}`}><X size={18} /></button></div>{children}</div></div>; }
function PageState({ title, detail, tone = "empty", actionLabel, onAction, secondaryLabel, onSecondary }: { title: string; detail: string; tone?: "empty" | "info" | "permission" | "error"; actionLabel?: string; onAction?: () => void; secondaryLabel?: string; onSecondary?: () => void }) { const Icon = tone === "error" ? AlertTriangle : tone === "permission" ? ShieldCheck : Leaf; return <section className={`page-state ${tone}`} role={tone === "error" ? "alert" : "status"}><Icon size={30} aria-hidden="true" /><strong>{title}</strong><span>{detail}</span>{(actionLabel || secondaryLabel) && <div className="page-state-actions">{actionLabel && onAction && <button className="primary" type="button" onClick={onAction}>{actionLabel}</button>}{secondaryLabel && onSecondary && <button className="secondary" type="button" onClick={onSecondary}>{secondaryLabel}</button>}</div>}</section>; }
function NoGardenState({ role, onCreate, onSwitchAccount }: { role: Role; onCreate: () => void; onSwitchAccount: () => void }) { return <PageState tone="permission" title={role === "owner" ? "บัญชีนี้ยังไม่มีสวน" : "บัญชีนี้ยังไม่ได้รับสิทธิ์เข้าสวน"} detail={role === "owner" ? "เพิ่มสวนแรกเพื่อเริ่มจัดการสมาชิก ข้อตกลง และรายการขาย" : "ติดต่อเจ้าของสวนให้เพิ่มบัญชี Google นี้เป็นคนกรีด แล้วกลับเข้าระบบอีกครั้ง"} actionLabel={role === "owner" ? "เพิ่มสวน" : undefined} onAction={role === "owner" ? onCreate : undefined} secondaryLabel="เปลี่ยนบัญชี Google" onSecondary={onSwitchAccount} />; }
function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <div className="metric"><div><small>{label}</small><strong>{value}</strong><span>ข้อมูลล่าสุด</span></div><i>{icon}</i></div>; }
function WalletLine({ label, amount, percent, color }: { label: string; amount: string; percent: number; color: string }) { return <div className="wallet-line"><div><span><b className={color} />{label}</span><strong>{amount}</strong></div><div className="progress"><i className={color} style={{ width: `${percent}%` }} /></div></div>; }
function labelStatus(status: string) { return ({ pending_owner_review: "รอเจ้าของตรวจ", ocr_review: "รอตรวจข้อมูลจากภาพ", confirmed: "ยืนยันแล้ว", disputed: "อยู่ระหว่างโต้แย้ง", pending_owner_confirmation: "รอเจ้าของยืนยัน", rejected: "ปฏิเสธแล้ว", cancelled: "ยกเลิกแล้ว", partially_confirmed: "ยืนยันบางส่วน", pending: "รอดำเนินการ", created: "สร้างแล้ว", active: "ใช้งานอยู่", inactive: "หยุดใช้งาน", superseded: "มีเวอร์ชันใหม่แทนแล้ว", open: "กำลังตรวจสอบ", under_review: "อยู่ระหว่างตรวจสอบ", resolved: "ดำเนินการแล้ว", ready: "พร้อมใช้งาน", failed: "ไม่สำเร็จ" } as Record<string, string>)[status] || "กำลังตรวจสอบสถานะ"; }


function ReceiptForm({ garden, agreement, initialFile, onClose, onUseManual, onSaved }: { garden?: Garden; agreement?: Agreement; initialFile?: File | null; onClose: () => void; onUseManual: () => void; onSaved: (receipt: CompletionReceiptData) => void }) {
  const [file, setFile] = useState<File | null>(initialFile || null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({ saleDate: dateToday(), buyerName: "", ticketNumber: "", productType: "", weightEntriesText: "", grossWeightKg: "", tareWeightKg: "", netWeightKg: "", weightKg: "", freshWeightKg: "", drc: "", dryWeightKg: "", unitPrice: "", grossSale: "", buyerDeductions: "0" });
  const [ocrMeta, setOcrMeta] = useState<{ documentClass: string; provider: string; warnings: string[]; uncertainFields: string[]; weightEntriesKg: number[] }>({ documentClass: "unreadable", provider: "", warnings: [], uncertainFields: [], weightEntriesKg: [] });
  const [scanPhase, setScanPhase] = useState<ReceiptScanPhase>(initialFile ? "preparing" : "idle");
  const [scanFeedback, setScanFeedback] = useState<ReturnType<typeof receiptScanFeedback> | null>(null);
  const [receiptId, setReceiptId] = useState("");
  const [receiptFileId, setReceiptFileId] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [receiptType, setReceiptType] = useState<"weigh_ticket" | "rubber_form" | "unknown">("unknown");
  const [humanReviewed, setHumanReviewed] = useState(false);
  const [status, setStatus] = useState("upload");
  const [duplicate, setDuplicate] = useState<{ possibleDuplicate: boolean; matches?: Sale[] }>({ possibleDuplicate: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const initialFileProcessed = useRef(false);

  const handleFile = async (selected: File | null) => {
    if (!selected || !garden) return;
    setHumanReviewed(false);
    setDuplicate({ possibleDuplicate: false });
    setScanPhase("preparing"); setScanFeedback(null); setBusy(true); setError(""); setReceiptId(""); setReceiptFileId("");
    try {
      const prepared = await prepareReceiptImage_(selected);
      if (prepared.size > MAX_EVIDENCE_BYTES) { setScanFeedback({ kind: "error", title: "ภาพมีขนาดใหญ่เกินไป", detail: "อุปกรณ์นี้ย่อภาพให้อัตโนมัติไม่สำเร็จ", nextAction: "ถ่ายภาพใหม่โดยเข้าใกล้บิลมากขึ้น หรือเลือกภาพขนาดไม่เกิน 4 MB", providerLabel: "ยังไม่ได้ส่งภาพ", allowReview: false, retryable: false }); setScanPhase("failed"); setStatus("error"); return; }
      setFile(prepared);
      const data = await readFileAsDataUrl_(prepared);
      setPreviewUrl(data);
      setScanPhase("reading");
      const result = await api.receipts.extract({ gardenId: garden.id, data, mimeType: prepared.type, filename: prepared.name });
      const extracted = (result as { ocr?: { provider?: string; systemState?: string; warnings?: string[]; fields?: Record<string, unknown>; confidence?: number; score?: number }; file?: { fileId?: string } }).ocr;
      const next = normalizeOcrFields(extracted?.fields || {});
      const warnings = [...new Set([...next.warnings, ...(extracted?.warnings || [])])];
      const score = extracted?.score !== undefined ? Number(extracted.score) : Number(extracted?.confidence || 0) * 100;
      const feedback = receiptScanFeedback({ provider: extracted?.provider, systemState: extracted?.systemState, documentClass: next.documentClass, warnings, uncertainFields: next.uncertainFields, score });
      setFields({
        saleDate: next.saleDate,
        buyerName: next.buyerName,
        ticketNumber: next.ticketNumber,
        productType: next.productType,
        weightEntriesText: next.weightEntriesKg.join(", "),
        grossWeightKg: next.grossWeightKg,
        tareWeightKg: next.tareWeightKg,
        netWeightKg: next.netWeightKg,
        weightKg: next.weightKg,
        freshWeightKg: next.freshWeightKg,
        drc: next.drc,
        dryWeightKg: next.dryWeightKg,
        unitPrice: next.unitPrice,
        grossSale: next.grossSale,
        buyerDeductions: next.buyerDeductions
      });
      setOcrMeta({ documentClass: next.documentClass, provider: String(extracted?.provider || ""), warnings, uncertainFields: next.uncertainFields, weightEntriesKg: next.weightEntriesKg });
      setReceiptType(next.receiptType);
      setReceiptId(String((result as { receiptId?: string }).receiptId || ""));
      setReceiptFileId(String((result as { file?: { fileId?: string } }).file?.fileId || ""));
      setConfidence(score / 100); setScanFeedback(feedback); setScanPhase(feedback.kind === "success" ? "complete" : feedback.allowReview ? "attention" : "failed"); setStatus(feedback.kind);
    } catch (caught) {
      const detail = userMessageForApiError(caught), notConfigured = caught instanceof ApiError && caught.code === "OCR_NOT_CONFIGURED";
      setScanFeedback(notConfigured ? { kind: "unavailable", title: "ระบบอ่านบิลยังไม่ได้เปิดใช้งาน", detail, nextAction: "แจ้งผู้ดูแลระบบให้เปิดบริการอ่านบิล หรือเลือกกรอกตัวเลขเอง", providerLabel: "ยังไม่เชื่อมต่อระบบอ่านภาพ", allowReview: false, retryable: false } : { kind: "error", title: "ส่งภาพไปอ่านไม่สำเร็จ", detail, nextAction: "ตรวจสัญญาณอินเทอร์เน็ตแล้วกดลองอ่านภาพนี้อีกครั้ง", providerLabel: "ยังตรวจสอบไม่ได้", allowReview: false, retryable: true });
      setScanPhase("failed"); setStatus("error");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (initialFile && !initialFileProcessed.current) {
      initialFileProcessed.current = true;
      void handleFile(initialFile);
    }
  }, [initialFile]);

  const checkDuplicate = async () => {
    if (!garden) return;
    const result = await api.sales.duplicateCheck({ gardenId: garden.id, saleDate: fields.saleDate, buyerName: fields.buyerName, grossSale: Number(fields.grossSale || 0), weightKg: Number(fields.weightKg || 0) });
    setDuplicate(result as { possibleDuplicate: boolean; matches?: Sale[] });
    return result as { possibleDuplicate: boolean; matches?: Sale[] };
  };

  const editedWeightEntries = parseWeightEntries_(fields.weightEntriesText);
  const normalizedPreview = normalizeOcrFields({ ...fields, receiptType, documentClass: ocrMeta.documentClass, weightEntriesKg: editedWeightEntries, uncertainFields: ocrMeta.uncertainFields, warnings: ocrMeta.warnings });
  const mathCheck = validateReceiptMath(normalizedPreview);
  const reviewGate = receiptReviewGate(normalizedPreview, humanReviewed);

  const submit = async () => {
    if (!garden || !agreement || busy) return;
    if (!reviewGate.canSubmit) { setError(reviewGate.reasons[0]); return; }
    setBusy(true); setError("");
    try {
      const duplicateResult = await checkDuplicate();
      if (duplicateResult?.possibleDuplicate && status !== "duplicate") { setStatus("duplicate"); return; }
      const created = await api.sales.create({ gardenId: garden.id, agreementId: agreement.id, receiptId, receiptType, saleDate: fields.saleDate, ticketNumber: fields.ticketNumber, buyerName: fields.buyerName, productType: fields.productType, weightEntriesKg: editedWeightEntries, grossWeight: Number(fields.grossWeightKg || fields.weightKg || 0), tareWeight: Number(fields.tareWeightKg || 0), netWeight: Number(fields.weightKg || 0), freshWeightKg: Number(fields.freshWeightKg || 0), drc: Number(fields.drc || 0), dryWeightKg: Number(fields.dryWeightKg || 0), weightKg: Number(fields.weightKg || 0), unitPrice: Number(fields.unitPrice || 0), grossSale: Number(fields.grossSale || 0), buyerDeductions: Number(fields.buyerDeductions || 0), receiptFileId, humanVerified: true, manualEntry: false }) as { id: string; calculation?: { grossSale?: number }; status: string };
      onSaved({ title: "บันทึกรายการขายพร้อมภาพบิลสำเร็จ", detail: "ส่งตัวเลขและภาพบิลให้เจ้าของสวนตรวจแล้ว ยอดนี้ยังไม่เข้ากระเป๋ายืนยัน", statusLabel: "รอเจ้าของตรวจ", rows: [{ label: "ยอดขาย", value: money(created.calculation?.grossSale ?? Number(fields.grossSale || 0)) }, { label: "ประเภทสินค้า", value: fields.productType || "ไม่ระบุ" }, { label: "วันที่ขาย", value: formatThaiDateTime(fields.saleDate) }], nextScreen: "sales", entityType: "sale", entityId: created.id });
    } catch (caught) { setError(userMessageForApiError(caught)); }
    finally { setBusy(false); }
  };
  const setField = (key: string, value: string) => {
    setFields((current) => {
      const next = { ...current, [key]: value };
      if (receiptType === "weigh_ticket") {
        if (key === "weightEntriesText") {
          const entries = parseWeightEntries_(value);
          if (entries.length) next.grossWeightKg = String(Math.round((entries.reduce((sum, item) => sum + item, 0) + Number.EPSILON) * 100) / 100);
        }
        if (["weightEntriesText", "grossWeightKg", "tareWeightKg"].includes(key)) {
          const net = Number(next.grossWeightKg || 0) - Number(next.tareWeightKg || 0);
          next.netWeightKg = net > 0 ? String(Math.round((net + Number.EPSILON) * 100) / 100) : "";
          next.weightKg = next.netWeightKg;
        } else if (key === "weightKg") next.netWeightKg = value;
      } else if (receiptType === "rubber_form" && key === "dryWeightKg") next.weightKg = value;
      return next;
    });
    setHumanReviewed(false); setDuplicate({ possibleDuplicate: false }); setError("");
  };
  const setReceiptTypeFromUser = (value: string) => { setReceiptType(value as "weigh_ticket" | "rubber_form" | "unknown"); setHumanReviewed(false); };
  const mathFailed = Object.values(mathCheck).some((value) => value === false);
  const scanWorking = scanPhase === "preparing" || scanPhase === "reading";
  const showReviewFields = Boolean(scanFeedback?.allowReview && receiptId && receiptFileId && !scanWorking);
  const currentStep = scanPhase === "idle" ? 1 : scanWorking ? 2 : 3;
  const uncertainLabels = [...new Set(ocrMeta.uncertainFields.filter((field) => field !== "all").map(receiptFieldLabel))];
  const scanTitle = scanPhase === "preparing" ? "กำลังจัดเตรียมภาพ..." : scanPhase === "reading" ? "กำลังอ่านข้อมูลในบิล..." : scanFeedback?.title || "เลือกวิธีนำเข้าภาพบิล";
  const scanDetail = scanPhase === "preparing" ? "ระบบกำลังหมุน ย่อ และปรับภาพให้เหมาะกับการอ่าน" : scanPhase === "reading" ? "กำลังตรวจวันที่ น้ำหนัก ราคา และยอดเงิน กรุณารอสักครู่" : scanFeedback?.detail || "ถ่ายภาพใหม่หรือเลือกภาพบิลจากเครื่องได้เลย";
  const scanTone = scanWorking ? "working" : scanFeedback?.kind || "idle";

  return <Modal title="เพิ่มรายการขาย" onClose={onClose}><div className="form-grid receipt-scan-form">
    <div className="transparency-note"><Camera size={19} /><div><strong>ถ่ายบิลจริงเพียง 1 ใบให้เต็มกรอบ</strong><span>ให้เห็นวันที่ น้ำหนัก ราคา และยอดเงินชัดเจน หลีกเลี่ยงเงา นิ้วบัง และภาพตัวอย่างหลายใบรวมกัน</span></div></div>
    <div className="receipt-scan-steps" aria-label={`ขั้นตอนที่ ${currentStep} จาก 3`}><span className="done"><b>1</b><small>เลือกภาพ</small></span><i /><span className={currentStep >= 2 ? scanPhase === "failed" ? "failed" : "done" : ""}><b>2</b><small>ระบบอ่านบิล</small></span><i /><span className={currentStep >= 3 ? scanPhase === "failed" ? "failed" : "done" : ""}><b>3</b><small>ตรวจและบันทึก</small></span></div>
    <div className="receipt-upload-actions"><label className="file-action secondary" aria-disabled={scanWorking}><Camera size={18} />ถ่ายภาพบิล<input disabled={scanWorking} type="file" accept="image/*" capture="environment" onChange={(event) => { const selected = event.currentTarget.files?.[0] || null; event.currentTarget.value = ""; void handleFile(selected); }} /></label><label className="file-action secondary" aria-disabled={scanWorking}><Upload size={18} />เลือกภาพจากเครื่อง<input disabled={scanWorking} type="file" accept="image/*" onChange={(event) => { const selected = event.currentTarget.files?.[0] || null; event.currentTarget.value = ""; void handleFile(selected); }} /></label><button className="file-action secondary" type="button" disabled={scanWorking} onClick={onUseManual}><Plus size={18} />กรอกตัวเลขเอง</button></div>
    {(scanPhase !== "idle" || file) && <div className={`receipt-scan-status ${scanTone}`} role={scanPhase === "failed" ? "alert" : "status"} aria-live="polite">{scanWorking ? <LoaderCircle className="receipt-scan-spinner" size={26} /> : scanFeedback?.kind === "success" ? <CheckCircle2 size={26} /> : <AlertTriangle size={26} />}<div><strong>{scanTitle}</strong><span>{scanDetail}</span>{scanFeedback && <small>{scanFeedback.nextAction}</small>}</div></div>}
    {previewUrl && <img className="receipt-scan-preview" src={previewUrl} alt="ภาพบิลที่กำลังตรวจสอบ" />}
    {file && scanFeedback && !scanWorking && <details className="receipt-technical-details"><summary>ข้อมูลสำหรับผู้ดูแลระบบ</summary><span>ระบบอ่านภาพ: {scanFeedback.providerLabel}</span>{ocrMeta.warnings.length > 0 && <code>{ocrMeta.warnings.join(" · ")}</code>}</details>}
    {scanPhase === "failed" && scanFeedback?.retryable && file && <div className="receipt-recovery-actions"><button className="secondary" type="button" onClick={() => void handleFile(file)}><RefreshCw size={17} />ลองอ่านภาพนี้อีกครั้ง</button></div>}
    {showReviewFields && <><div className="receipt-review-heading"><CheckCircle2 size={21} /><div><strong>ขั้นตอนสุดท้าย: ตรวจตัวเลขกับภาพ</strong><small>แก้ไขช่องที่อ่านไม่ชัดได้ ก่อนส่งให้เจ้าของสวนตรวจอีกครั้ง</small></div></div>
    <label>วิธีคิดเงินในบิล<select value={receiptType} onChange={(event) => setReceiptTypeFromUser(event.target.value)}><option value="unknown">ระบบยังแยกไม่ได้ — กรุณาเลือก</option><option value="weigh_ticket">ชั่งน้ำหนัก × ราคาต่อกิโล</option><option value="rubber_form">น้ำหนักสด × เปอร์เซ็นต์เนื้อยาง</option></select></label>
    <label>วันที่ขาย<input type="date" value={fields.saleDate} onChange={(e) => setField("saleDate", e.target.value)} /></label>
    <label>ชื่อร้านรับซื้อ<input value={fields.buyerName} onChange={(e) => setField("buyerName", e.target.value)} /></label>
    <label>เลขที่บิล (ถ้ามี)<input value={fields.ticketNumber} onChange={(e) => setField("ticketNumber", e.target.value)} /></label>
    <label>ประเภทสินค้า<select value={fields.productType} onChange={(e) => setField("productType", e.target.value)}><option value="">เลือกประเภทสินค้า</option><option value="น้ำยางสด">น้ำยางสด</option><option value="ขี้ยาง">ขี้ยาง / ยางก้อนถ้วย</option><option value="ยางแผ่น">ยางแผ่น</option><option value="อื่น ๆ">อื่น ๆ</option></select></label>
    {receiptType === "weigh_ticket" && <><label>น้ำหนักแต่ละเที่ยว/แต่ละตะกร้า<textarea value={fields.weightEntriesText} onChange={(e) => setField("weightEntriesText", e.target.value)} placeholder="เช่น 36, 41, 42, 35.5" /></label><label>น้ำหนักรวมก่อนหัก (กก.)<input type="number" min="0" step="0.01" value={fields.grossWeightKg} onChange={(e) => setField("grossWeightKg", e.target.value)} /></label><label>น้ำหนักตะกร้าหรือภาชนะที่หักออก (กก.)<input type="number" min="0" step="0.01" value={fields.tareWeightKg} onChange={(e) => setField("tareWeightKg", e.target.value)} /></label></>}
    <label>น้ำหนักที่ร้านใช้คำนวณเงิน (กก.)<input type="number" min="0" step="0.01" value={fields.weightKg} onChange={(e) => setField("weightKg", e.target.value)} /></label>
    {receiptType === "rubber_form" && <><label>น้ำหนักยางสด (กก.)<input type="number" min="0" step="0.01" value={fields.freshWeightKg} onChange={(e) => setField("freshWeightKg", e.target.value)} /></label><label>เปอร์เซ็นต์เนื้อยาง (%)<input type="number" min="0" step="0.01" value={fields.drc} onChange={(e) => setField("drc", e.target.value)} /></label><label>น้ำหนักยางแห้ง (กก.)<input type="number" min="0" step="0.01" value={fields.dryWeightKg} onChange={(e) => setField("dryWeightKg", e.target.value)} /></label></>}
    <label>ราคาต่อกิโลกรัม<input type="number" min="0" step="0.01" value={fields.unitPrice} onChange={(e) => setField("unitPrice", e.target.value)} /></label>
    <label>ยอดเงินที่เขียนในบิล<input type="number" min="0" step="0.01" value={fields.grossSale} onChange={(e) => setField("grossSale", e.target.value)} /></label>
    <label>เงินที่ร้านหักออก (ถ้ามี)<input type="number" min="0" step="0.01" value={fields.buyerDeductions} onChange={(e) => setField("buyerDeductions", e.target.value)} /></label>
    {confidence !== null && <div className={`calculation-preview ${confidence < 0.9 || mathFailed ? "low-confidence" : ""}`}><span>คะแนนตรวจความครบถ้วน: {(confidence * 100).toFixed(0)}%</span><strong>{mathCheck.entrySumConsistent === false ? "ผลรวมน้ำหนักรายแถวไม่ตรงกับยอดรวม" : mathCheck.netWeightConsistent === false ? "น้ำหนักรวม หักตะกร้า และสุทธิไม่ตรงกัน" : mathCheck.weightConsistent === false ? "น้ำหนักยางสดและเปอร์เซ็นต์ไม่ตรงกับน้ำหนักยางแห้ง" : mathCheck.amountConsistent === false ? "น้ำหนักและราคาไม่ตรงกับยอดเงิน" : confidence < 0.9 ? "ต้องตรวจตัวเลขกับภาพก่อนบันทึก" : "สมการถูกต้อง — ยังต้องตรวจภาพจริงหนึ่งครั้ง"}</strong></div>}
    {uncertainLabels.length > 0 && <div className="calculation-preview low-confidence"><span>ช่องที่ต้องตรวจเป็นพิเศษ</span><strong>{uncertainLabels.join(", ")}</strong></div>}
    {duplicate.possibleDuplicate && <div className="calculation-preview low-confidence"><span>พบรายการที่อาจซ้ำ {duplicate.matches?.length || 0} รายการ</span><strong>ตรวจสอบก่อนกดยืนยันอีกครั้ง</strong></div>}
    <label className="review-confirmation"><input type="checkbox" checked={humanReviewed} onChange={(event) => setHumanReviewed(event.target.checked)} /><span><strong>ฉันเทียบวันที่ น้ำหนัก ราคา และยอดเงินกับภาพแล้ว</strong><small>ระบบจะยังไม่สร้างยอดเงินจนกว่าคุณทำเครื่องหมายยืนยัน</small></span></label>
    {!reviewGate.canSubmit && receiptId && <div className="calculation-preview low-confidence"><span>ยังบันทึกไม่ได้</span><strong>{reviewGate.reasons[0]}</strong></div>}
    {error && <div className="form-error" role="alert">{error}</div>}
    <button className="secondary" onClick={() => void checkDuplicate().catch((caught) => setError(userMessageForApiError(caught)))} disabled={!garden || busy || !fields.saleDate}>ตรวจรายการซ้ำ</button>
    <button className="primary" onClick={() => void submit()} disabled={!garden || !agreement || !receiptId || !receiptFileId || busy || !reviewGate.canSubmit}>{status === "duplicate" ? "ยืนยันว่าเป็นบิลคนละรายการ" : busy ? "กำลังบันทึกและส่งให้เจ้าของตรวจ..." : "บันทึกรายการและส่งให้เจ้าของตรวจ"}</button>
    {!agreement && <small className="form-hint">ต้องมี ข้อตกลงที่ใช้งานอยู่ ก่อนสร้างรายการขาย</small>}
    </>}
  </div></Modal>;
}

function readFileAsDataUrl_(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "")); reader.onerror = reject; reader.readAsDataURL(file); }); }

function parseWeightEntries_(value: string): number[] { return String(value || "").split(/[\s,;]+/).map(Number).filter((item) => Number.isFinite(item) && item > 0); }

async function prepareReceiptImage_(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function") return file;
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const render = async (maxSide: number, quality: number) => {
      const scale = Math.min(1, maxSide / Math.max(bitmap!.width, bitmap!.height));
      const width = Math.max(1, Math.round(bitmap!.width * scale));
      const height = Math.max(1, Math.round(bitmap!.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap!, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      return blob ? new File([blob], file.name.replace(/\.[^.]+$/, "") + "-ocr.jpg", { type: "image/jpeg", lastModified: file.lastModified }) : null;
    };
    const first = await render(2200, 0.9);
    if (first && first.size <= MAX_EVIDENCE_BYTES) return first;
    const second = await render(1600, 0.78);
    return second || file;
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}


function AgreementForm({ garden, members, onClose, onSaved }: { garden?: Garden; members: GardenMember[]; onClose: () => void; onSaved: (receipt: CompletionReceiptData) => void }) {
  const tappers = members.filter((member) => member.role === "tapper" && member.status === "active");
  const [form, setForm] = useState({ tapperId: tappers[0]?.userId || "", ownerPercentage: "60", tapperPercentage: "40", effectiveFrom: dateToday() });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const total = Number(form.ownerPercentage || 0) + Number(form.tapperPercentage || 0);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!garden || total !== 100 || busy) return; setBusy(true); setError(""); try { await api.agreements.create({ gardenId: garden.id, tapperId: form.tapperId, ownerPercentage: Number(form.ownerPercentage), tapperPercentage: Number(form.tapperPercentage), effectiveFrom: form.effectiveFrom }); onSaved({ title: "สร้างข้อตกลงสำเร็จ", detail: "ข้อตกลงเวอร์ชันใหม่พร้อมใช้กับรายการขายหลังวันที่มีผล", statusLabel: "พร้อมใช้งาน", rows: [{ label: "วันที่เริ่มมีผล", value: formatThaiDateTime(form.effectiveFrom) }, { label: "ส่วนเจ้าของ / คนกรีด", value: `${form.ownerPercentage}% / ${form.tapperPercentage}%` }], nextScreen: "agreements", openLabel: "ดูข้อตกลง" }); } catch (caught) { setError(userMessageForApiError(caught)); } finally { setBusy(false); } };
  return <Modal title="สร้างข้อตกลงแบ่งรายได้" onClose={onClose}><form className="form-grid" onSubmit={submit}><label>คนกรีด<select required value={form.tapperId} onChange={(e) => setForm({ ...form, tapperId: e.target.value })}><option value="">เลือกคนกรีดในสวน</option>{tappers.map((member) => <option key={member.id} value={member.userId}>{member.name || member.email || "ไม่ระบุอีเมล"}</option>)}</select></label><label>เริ่มมีผลวันที่<input required type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} /></label><label>สัดส่วนเจ้าของสวน (%)<input type="number" min="0" max="100" value={form.ownerPercentage} onChange={(e) => setForm({ ...form, ownerPercentage: e.target.value })} /></label><label>สัดส่วนคนกรีด (%)<input type="number" min="0" max="100" value={form.tapperPercentage} onChange={(e) => setForm({ ...form, tapperPercentage: e.target.value })} /></label><div className="calculation-preview"><span>รวมสัดส่วน</span><strong className={total === 100 ? "" : "form-hint"}>{total}% {total === 100 ? "พร้อมบันทึก" : "ต้องรวมให้ได้ 100%"}</strong></div>{error && <div className="form-error" role="alert">{error}</div>}<button className="primary" disabled={busy || !garden || !form.tapperId || total !== 100}>{busy ? "กำลังบันทึกข้อตกลง..." : "สร้างข้อตกลงเวอร์ชัน"}</button>{tappers.length === 0 && <small className="form-hint">ต้องเพิ่มคนกรีดในหน้า “สวนและแปลง” ก่อนสร้างข้อตกลง</small>}</form></Modal>;
}
