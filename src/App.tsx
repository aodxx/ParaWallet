import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, Agreement, ApiError, DashboardData, Garden, GardenMember, Notification, Role, Sale, SaleReceiptEvidence, Settlement, SettlementEvidence, WalletData, onAuthFailure, setAuthToken, userMessageForApiError } from "./api";
import GoogleSignIn from "./GoogleSignIn";
import LoadingAnimation from "./LoadingAnimation";
import { Banknote, Bell, Camera, CheckCircle2, CircleDollarSign, Eye, FileDown, FileText, House, Image, Leaf, Menu, Plus, Settings2, ShieldCheck, Sprout, Upload, UserMinus, UserPlus, Users, WalletCards, X } from "lucide-react";

type Screen = "overview" | "sales" | "gardens" | "agreements" | "settlements" | "reports" | "notifications";
type ConnectionState = "connecting" | "connected" | "degraded" | "disconnected";

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
const MAX_EVIDENCE_BYTES = 4 * 1024 * 1024;

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
  const [message, setMessage] = useState("");
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [showGardenForm, setShowGardenForm] = useState(false);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [reviewSale, setReviewSale] = useState<Sale | null>(null);
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [receiptInitialFile, setReceiptInitialFile] = useState<File | null>(null);
  const [showAgreementForm, setShowAgreementForm] = useState(false);
  const [showSettlementForm, setShowSettlementForm] = useState(false);
  const [showMobileMore, setShowMobileMore] = useState(false);
  const receiptCameraRef = useRef<HTMLInputElement>(null);
  const refreshSequenceRef = useRef(0);
  const hasSuccessfulSyncRef = useRef(false);
  const activeGarden = data.garden || gardens[0];
  const connected = connectionState === "connected" || connectionState === "degraded";
  const pendingSales = data.pendingSales || 0;
  const pendingSettlements = data.pendingSettlements || 0;
  const unreadNotifications = data.unreadNotifications ?? notifications.filter((item) => !item.readAt).length;

  const handleSignOut = useCallback((reason = "") => {
    refreshSequenceRef.current += 1;
    hasSuccessfulSyncRef.current = false;
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthToken("");
    setAuthTokenState("");
    setConnectionState("disconnected");
    if (reason) setMessage(reason);
    window.google?.accounts?.id?.disableAutoSelect?.();
  }, []);

  const refresh = async (target: Screen = screen) => {
    const refreshSequence = ++refreshSequenceRef.current;
    const isCurrent = () => refreshSequence === refreshSequenceRef.current;
    setLoading(true);
    setMessage("");
    setConnectionState((current) => hasSuccessfulSyncRef.current ? current : "connecting");
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
        setConnectionState("connected");
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
      if (partialFailure) {
        setConnectionState("degraded");
        setMessage("ข้อมูลหลักเชื่อมต่อแล้ว แต่ข้อมูลบางส่วนยังไม่อัปเดต กด “ลองใหม่” เพื่อซิงก์อีกครั้ง");
      } else {
        setConnectionState("connected");
        setMessage("");
      }
    } catch (error) {
      if (!isCurrent()) return;
      if (error instanceof ApiError && ["AUTH_REQUIRED", "INVALID_GOOGLE_ID_TOKEN", "GOOGLE_TOKEN_EXPIRED", "USER_NOT_REGISTERED"].includes(error.code)) {
        handleSignOut("เซสชัน Google หมดอายุหรือไม่มีสิทธิ์ โปรดเข้าสู่ระบบใหม่");
      } else {
        if (hasSuccessfulSyncRef.current) {
          setConnectionState("degraded");
          setMessage(`ยังใช้ข้อมูลที่โหลดล่าสุดได้ · ${userMessageForApiError(error)}`);
        } else {
          setConnectionState("disconnected");
          setMessage(userMessageForApiError(error));
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
    else { setConnectionState("disconnected"); setMessage("กรุณาเข้าสู่ระบบด้วย Google ก่อนเชื่อมต่อฐานข้อมูล"); }
  }, [authToken]);

  const handleCredential = useCallback((token: string) => {
    localStorage.setItem(AUTH_STORAGE_KEY, token);
    setAuthTokenState(token);
    setMessage("กำลังตรวจสอบบัญชี Google กับระบบ...");
  }, []);
  const nav = useMemo(() => [
    ["overview", "ภาพรวม", <Leaf size={18} />],
    ["sales", "รายการขาย", <FileText size={18} />],
    ["gardens", "สวนและแปลง", <Sprout size={18} />],
    ["agreements", "ข้อตกลง", <CircleDollarSign size={18} />],
    ["settlements", "การส่งเงิน", <WalletCards size={18} />],
    ["reports", "รายงาน", <CircleDollarSign size={18} />],
    ["notifications", "แจ้งเตือน", <Bell size={18} />],
  ] as const, []);

  const openScreen = (next: Screen) => { setScreen(next); void refresh(next); };
  const openMobileScreen = (next: Screen) => { setShowMobileMore(false); openScreen(next); };
  const mobileNavIndex = screen === "overview" ? 0 : screen === "sales" ? 1 : screen === "settlements" ? 2 : 3;

  const openNotification = async (item: Notification) => {
    const wasUnread = !item.readAt;
    const target = item.targetScreen || notificationTargetScreen(item.type);
    if (wasUnread) {
      const readAt = new Date().toISOString();
      setNotifications((items) => items.map((row) => row.id === item.id ? { ...row, readAt } : row));
      setData((current) => ({ ...current, unreadNotifications: Math.max(0, (current.unreadNotifications || 0) - 1) }));
    }
    if (target !== "notifications") setScreen(target);
    try {
      if (wasUnread) await api.notifications.read(item.id);
      if (target !== "notifications") await refresh(target);
    } catch (caught) {
      setMessage(userMessageForApiError(caught));
    }
  };

  if (!authToken) return <AuthScreen clientId={googleClientId} message={message} onCredential={handleCredential} onError={setMessage} />;
  if (!hasSuccessfulSyncRef.current) return <InitialSyncScreen loading={loading || connectionState === "connecting"} message={message} onRetry={() => void refresh("overview")} onSignOut={() => handleSignOut()} />;

  return <div className="app-shell">
    <header className="topbar">
      <button className="icon-button mobile-only" aria-label="เปิดเมนู"><Menu size={21} /></button>
      <div className="brand"><span className="brand-mark"><Leaf size={22} /></span><span><b>ParaWallet</b><small>DUAL WALLET SYSTEM</small></span></div>
      <div className="top-actions"><button className="secondary signout-button" onClick={() => handleSignOut()}>ออกจากระบบ</button><span className="role-badge">{role === "owner" ? "Owner" : "Tapper"}</span><button className="icon-button notification-button" onClick={() => openScreen("notifications")} aria-label={`การแจ้งเตือนที่ยังไม่อ่าน ${unreadNotifications} รายการ`}><Bell size={20} />{unreadNotifications > 0 && <em>{unreadNotifications}</em>}</button></div>
      <div className="mobile-header-context"><div><small>สวนที่กำลังใช้งาน</small><strong>{activeGarden?.name || "ยังไม่มีสวน"}</strong></div><span className={`header-connection ${connectionState}`}>{connectionState === "connected" ? "เชื่อมต่อแล้ว" : connectionState === "degraded" ? "ข้อมูลบางส่วน" : "ยังไม่เชื่อมต่อ"}</span></div>
      <svg className="topbar-wave" viewBox="0 0 390 52" preserveAspectRatio="none" aria-hidden="true"><path d="M0 15 C76 15 93 48 184 48 C278 48 298 7 390 7 L390 52 L0 52 Z" /></svg>
    </header>
    {message && <div className={`sync-banner ${connectionState}`} role="status"><strong>{connectionState === "connected" ? "เชื่อมต่อแล้ว" : connectionState === "degraded" ? "ข้อมูลยังไม่ครบ" : "ยังไม่เชื่อมต่อ"}</strong><span>{message}</span><button onClick={() => void refresh()} disabled={loading}>{loading ? "กำลังตรวจสอบ..." : "ลองใหม่"}</button></div>}
    <div className="mobile-context"><div><small>กำลังดูข้อมูล</small><strong>{activeGarden?.name || "ยังไม่มีสวน"}</strong></div><button onClick={() => openScreen("gardens")} aria-label="เปลี่ยนสวน"><Sprout size={18} /></button></div>
    <div className="layout">
      <aside className="sidebar">
        <div className="garden-selector"><small>กำลังดูข้อมูล</small><strong>{activeGarden?.name || "ยังไม่มีสวน"}</strong><span>{activeGarden ? `${activeGarden.areaRai || 0} ไร่ · ${(activeGarden.treeCount || 0).toLocaleString()} ต้น` : "เชื่อมต่อ Apps Script เพื่อเริ่มต้น"}</span></div>
        <nav>{nav.map(([key, label, icon]) => { const badge = key === "sales" ? pendingSales : key === "settlements" ? pendingSettlements : key === "notifications" ? unreadNotifications : 0; return <button key={key} className={screen === key ? "active" : ""} onClick={() => openScreen(key)}>{icon}{label}{badge > 0 && <em>{badge}</em>}</button>; })}</nav>
        <button className="settings"><Settings2 size={18} />ตั้งค่า</button>
      </aside>
      <main className={`content ${loading ? "is-loading" : ""}`}>
        <div className="page-heading"><div><p>{new Date().toLocaleDateString("th-TH", { dateStyle: "full" })}</p><h1>{screenTitle(screen)}</h1><span>{screenDescription(screen, role)}</span></div><button className="period">เดือนนี้⌄</button></div>
        {message && <div className="notice">{message}</div>}
        <div className="screen-stage" aria-busy={loading}>
          <div className="screen-content" key={screen}>
        {screen === "overview" && <Overview data={data} wallet={wallet} role={role} connected={connected} onSale={() => setShowSaleForm(true)} onReceipt={() => receiptCameraRef.current?.click()} onSettlement={() => setShowSettlementForm(true)} onReviewSales={() => openScreen("sales")} onReviewSettlements={() => openScreen("settlements")} onReports={() => openScreen("reports")} />}
        {screen === "sales" && (!loading || sales.length > 0) && <SalesScreen sales={sales} role={role} onSale={() => setShowSaleForm(true)} onReview={setReviewSale} onRefresh={() => refresh("sales")} />}
        {screen === "gardens" && <GardensScreen garden={activeGarden} gardens={gardens.length ? gardens : activeGarden ? [activeGarden] : []} members={members} role={role} onCreate={() => setShowGardenForm(true)} onAddMember={() => setShowMemberForm(true)} onDeactivate={async (member) => { if (!activeGarden || !window.confirm(`ถอด ${member.name || member.email || "Tapper"} ออกจากสวนนี้หรือไม่\n\nระบบจะอนุญาตเมื่อไม่มีข้อตกลง รายการค้าง หรือยอดเงินคงค้างเท่านั้น`)) return; try { await api.members.deactivate({ gardenId: activeGarden.id, memberId: member.id }); await refresh("gardens"); setMessage("ปิดสิทธิ์ Tapper ในสวนแล้ว โดยยังเก็บประวัติเดิมไว้ครบถ้วน"); } catch (caught) { setMessage(userMessageForApiError(caught)); } }} />}
        {screen === "agreements" && (!loading || agreements.length > 0) && <AgreementsScreen agreements={agreements} garden={activeGarden} role={role} onCreate={() => setShowAgreementForm(true)} />}
        {screen === "settlements" && (!loading || settlements.length > 0) && <SettlementsScreen settlements={settlements} wallet={wallet} role={role} onCreate={() => setShowSettlementForm(true)} onRefresh={() => refresh("settlements")} />}
        {screen === "reports" && <ReportsScreen garden={activeGarden} />}
        {screen === "notifications" && (!loading || notifications.length > 0) && <NotificationsScreen notifications={notifications} onOpen={openNotification} />}
          </div>
          {loading && <div className="loading-overlay"><LoadingAnimation label="กำลังอัปเดตข้อมูล" detail="ตรวจสอบข้อมูลล่าสุดจาก ParaWallet" /></div>}
        </div>
      </main>
    </div>
    <DeveloperCredit />
    <input ref={receiptCameraRef} className="camera-input" type="file" accept="image/*" capture="environment" aria-label="เปิดกล้องสแกนใบเสร็จ" onChange={(event) => { const selected = event.target.files?.[0] || null; event.target.value = ""; if (selected) { setReceiptInitialFile(selected); setShowReceiptForm(true); } }} />
    <nav className="mobile-bottom-nav" aria-label="เมนูหลักบนมือถือ" data-active={mobileNavIndex}>
      <span className="mobile-dock-indicator" aria-hidden="true" />
      <button className={screen === "overview" ? "active" : ""} onClick={() => openScreen("overview")}><span className="mobile-nav-icon"><House size={22} /></span><span>ภาพรวม</span></button>
      <button className={screen === "sales" ? "active" : ""} onClick={() => openScreen("sales")}><span className="mobile-nav-icon"><FileText size={22} /></span><span>รายการ</span>{pendingSales > 0 && <em>{pendingSales}</em>}</button>
      <button className={screen === "settlements" ? "active" : ""} onClick={() => openScreen("settlements")}><span className="mobile-nav-icon"><WalletCards size={22} /></span><span>กระเป๋า</span>{pendingSettlements > 0 && <em>{pendingSettlements}</em>}</button>
      <button className={mobileNavIndex === 3 ? "active" : ""} onClick={() => setShowMobileMore(true)}><span className="mobile-nav-icon"><Menu size={22} /></span><span>เพิ่มเติม</span>{unreadNotifications > 0 && <em>{unreadNotifications}</em>}</button>
    </nav>
    {showMobileMore && <div className="mobile-more-backdrop" role="presentation" onClick={() => setShowMobileMore(false)}><section className="mobile-more-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-more-title" onClick={(event) => event.stopPropagation()}><div className="mobile-more-head"><div><small>เมนู ParaWallet</small><h2 id="mobile-more-title">เพิ่มเติม</h2></div><button className="icon-button" onClick={() => setShowMobileMore(false)} aria-label="ปิดเมนูเพิ่มเติม"><X size={22} /></button></div><div className="mobile-more-grid"><button onClick={() => openMobileScreen("gardens")}><Sprout size={22} /><span><strong>สวนและสมาชิก</strong><small>ข้อมูลสวนและสิทธิ์ Tapper</small></span></button><button onClick={() => openMobileScreen("agreements")}><CircleDollarSign size={22} /><span><strong>ข้อตกลง</strong><small>สัดส่วนและ version</small></span></button><button onClick={() => openMobileScreen("reports")}><FileDown size={22} /><span><strong>รายงาน/ส่งออก</strong><small>เลือกช่วงวันที่และ CSV</small></span></button><button onClick={() => openMobileScreen("notifications")}><Bell size={22} /><span><strong>การแจ้งเตือน</strong><small>{unreadNotifications > 0 ? `ยังไม่อ่าน ${unreadNotifications} รายการ` : "อ่านครบแล้ว"}</small></span></button></div></section></div>}
    {showGardenForm && role === "owner" && <GardenForm onClose={() => setShowGardenForm(false)} onSaved={() => { setShowGardenForm(false); void refresh("gardens"); }} />}
    {showMemberForm && role === "owner" && <MemberForm garden={activeGarden} onClose={() => setShowMemberForm(false)} onSaved={() => { setShowMemberForm(false); void refresh("gardens"); }} />}
    {showSaleForm && role === "tapper" && <SaleForm garden={activeGarden} agreement={agreements[0]} role={role} onClose={() => setShowSaleForm(false)} onSaved={() => { setShowSaleForm(false); void refresh("sales"); }} />}
    {reviewSale && <SaleReviewModal sale={reviewSale} role={role} onClose={() => setReviewSale(null)} onChanged={() => { setReviewSale(null); void refresh("sales"); }} />}
    {showReceiptForm && role === "tapper" && <ReceiptForm garden={activeGarden} agreement={agreements[0]} initialFile={receiptInitialFile} onClose={() => { setShowReceiptForm(false); setReceiptInitialFile(null); }} onSaved={() => { setShowReceiptForm(false); setReceiptInitialFile(null); void refresh("sales"); }} />}
    {showAgreementForm && role === "owner" && <AgreementForm garden={activeGarden} members={members} onClose={() => setShowAgreementForm(false)} onSaved={() => { setShowAgreementForm(false); void refresh("agreements"); }} />}
    {showSettlementForm && role === "tapper" && <SettlementForm garden={activeGarden} role={role} onClose={() => setShowSettlementForm(false)} onSaved={() => { setShowSettlementForm(false); void refresh("settlements"); }} />}
  </div>;
}

function notificationTargetScreen(type: string): Screen {
  if (type.startsWith("settlement_")) return "settlements";
  if (type.startsWith("sale_") || type.startsWith("dispute_")) return "sales";
  if (type.startsWith("garden_member_")) return "gardens";
  if (type.startsWith("agreement_")) return "agreements";
  return "notifications";
}

function screenTitle(screen: Screen) { return ({ overview: "ภาพรวมการแบ่งรายได้", sales: "รายการขายยาง", gardens: "สวนและแปลง", agreements: "ข้อตกลงแบ่งรายได้", settlements: "การส่งเงิน", reports: "รายงาน", notifications: "การแจ้งเตือน" } as Record<Screen, string>)[screen]; }

function screenDescription(screen: Screen, role: Role) {
  if (screen === "overview") return role === "owner" ? "ภาพรวมสิทธิในเงิน งานรอตรวจ และยอดคงค้าง" : "รายได้ของคุณ เงินเจ้าของที่ถืออยู่ และงานสำคัญวันนี้";
  return ({
    sales: "ตรวจสอบรายการขาย หลักฐาน และสถานะการยืนยัน",
    gardens: "ดูข้อมูลสวน สมาชิก และสิทธิ์การเข้าถึง",
    agreements: "ตรวจสัดส่วนและข้อตกลงที่ใช้คำนวณการแบ่งเงิน",
    settlements: "ติดตามยอดคงค้างและประวัติการส่งเงิน",
    reports: "เลือกช่วงเวลาเพื่อดูยอดรวมและส่งออกข้อมูล",
    notifications: "ติดตามงานใหม่และเปิดรายการที่เกี่ยวข้อง",
  } as Record<Exclude<Screen, "overview">, string>)[screen];
}

function DeveloperCredit() {
  return <footer className="developer-credit" aria-label="เครดิตผู้พัฒนา"><span className="developer-credit__label">Developed by <strong>aod</strong></span><a className="developer-credit__link" href="https://www.facebook.com/share/1AWvhjdr44/" target="_blank" rel="noreferrer" aria-label="เปิด Facebook ของ aod"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.6 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.6-1.5h1.7V4a21 21 0 0 0-2.5-.1c-2.5 0-4.2 1.5-4.2 4.2V10H7.5v3h2.7v8h3.4Z" /></svg><span>Facebook</span></a></footer>;
}

function AuthScreen({ clientId, message, onCredential, onError }: { clientId: string; message: string; onCredential: (token: string) => void; onError: (message: string) => void }) {
  return <main className="auth-screen"><section className="auth-card"><div className="brand-mark"><Leaf size={24} /></div><p className="eyebrow">PARAWALLET SECURE ACCESS</p><h1>เข้าสู่ระบบ ParaWallet</h1><p>ใช้บัญชี Google เพื่อยืนยันตัวตน แล้วระบบจะโหลดข้อมูลเฉพาะสวนและสิทธิ์ของคุณจาก Google Sheets</p><GoogleSignIn clientId={clientId} onCredential={onCredential} onError={onError} />{message && <div className="notice">{message}</div>}<small>ระบบจะไม่เรียกใช้ Session.getEffectiveUser และจะไม่เก็บรหัสผ่าน Google</small></section></main>;
}

function InitialSyncScreen({ loading, message, onRetry, onSignOut }: { loading: boolean; message: string; onRetry: () => void; onSignOut: () => void }) {
  if (loading) return <main className="auth-screen loading-gate"><section className="auth-card loading-card"><LoadingAnimation label="กำลังเตรียม ParaWallet" detail="ตรวจสอบบัญชีและโหลดข้อมูลล่าสุด" /></section></main>;
  return <main className="auth-screen"><section className="auth-card"><div className="brand-mark"><Leaf size={24} /></div><p className="eyebrow">PARAWALLET SECURE SYNC</p><h1>ยังเชื่อมต่อข้อมูลไม่ได้</h1><p>ระบบยังไม่แสดงหน้าของ Owner หรือ Tapper จนกว่าจะตรวจสอบสิทธิ์สำเร็จ</p>{message && <div className="notice">{message}</div>}<div className="quick-actions"><button className="primary" onClick={onRetry}>ลองใหม่</button><button className="secondary" onClick={onSignOut}>เปลี่ยนบัญชี Google</button></div></section></main>;
}

function Overview({ data, wallet, role, connected, onSale, onReceipt, onSettlement, onReviewSales, onReviewSettlements, onReports }: { data: DashboardData; wallet: WalletData | null; role: Role; connected: boolean; onSale: () => void; onReceipt: () => void; onSettlement: () => void; onReviewSales: () => void; onReviewSettlements: () => void; onReports: () => void }) {
  const owner = wallet?.owner.totalEntitlement ?? data.wallet.owner;
  const tapper = wallet?.tapper.totalIncome ?? data.wallet.tapper;
  const outstanding = wallet?.owner.outstanding ?? data.wallet.outstanding;
  const salesSeries = data.monthlySalesSeries || [];
  const salesSeriesMax = Math.max(1, ...salesSeries);
  const showMoney = (value: number) => connected ? money(value) : "—";
  if (role === "tapper") return <TapperOverview data={data} wallet={wallet} connected={connected} salesSeries={salesSeries} salesSeriesMax={salesSeriesMax} onReceipt={onReceipt} onSale={onSale} onSettlement={onSettlement} onReports={onReports} />;
  return <div className="owner-overview"><section className="pending-work" aria-label="งานที่เจ้าของต้องตรวจสอบ"><div><strong>งานที่ต้องทำ</strong><span>ตรวจหลักฐานก่อนยืนยันรายการขายและการส่งเงิน</span></div><div className="pending-work-actions"><button onClick={onReviewSales}><FileText size={18} /><span>รายการขายรอตรวจ</span><strong>{data.pendingSales || 0}</strong></button><button onClick={onReviewSettlements}><WalletCards size={18} /><span>การส่งเงินรอยืนยัน</span><strong>{data.pendingSettlements || 0}</strong></button></div></section><section className="owner-wallet-pair" aria-label="กระเป๋าคู่ของเจ้าของ"><article><span><small>สิทธิของฉัน</small><WalletCards size={21} /></span><strong>{showMoney(owner)}</strong><p>ส่วนแบ่ง Owner ที่ยืนยันแล้ว</p></article><article><span><small>รับเงินแล้ว</small><ShieldCheck size={21} /></span><strong>{showMoney(wallet?.owner.totalReceived || 0)}</strong><p>ยอดคงเหลือ {showMoney(outstanding)}</p></article></section><section className="owner-summary-grid"><Metric label="งานรอตรวจสอบ" value={connected ? `${data.pendingReviews} รายการ` : "—"} icon={<FileText />} /><Metric label="ยอดขายเดือนนี้" value={showMoney(data.monthlySales)} icon={<Sprout />} /></section><section className="owner-sales-card sales-card"><div><small>ยอดขายรวมเดือนนี้</small><strong>{showMoney(data.monthlySales)}</strong><span className="growth">{connected ? "ข้อมูลจาก Apps Script" : "รอเชื่อมต่อฐานข้อมูล"}</span></div><div className="bars">{connected && salesSeries.some((value) => value > 0) ? salesSeries.map((value, i) => <div key={i} style={{ height: `${Math.max(8, value / salesSeriesMax * 100)}%` }}><span>ส.{i + 1}</span></div>) : <p className="empty-chart">{connected ? "ยังไม่มียอดขายที่ยืนยันในเดือนนี้" : "กราฟจะแสดงเมื่อโหลดข้อมูลจริงสำเร็จ"}</p>}</div></section><section className="quick-actions"><button onClick={onReports}><FileDown size={18} />รายงานและส่งออก</button></section></div>;
}

function TapperOverview({ data, wallet, connected, salesSeries, salesSeriesMax, onReceipt, onSale, onSettlement, onReports }: { data: DashboardData; wallet: WalletData | null; connected: boolean; salesSeries: number[]; salesSeriesMax: number; onReceipt: () => void; onSale: () => void; onSettlement: () => void; onReports: () => void }) {
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
      <button className="scan-receipt-cta" onClick={onReceipt}><Camera size={31} /><span><strong>สแกนใบเสร็จ</strong><small>แตะเพื่อเปิดกล้องทันที แล้วตรวจข้อมูล OCR</small></span></button>
      <div className="tapper-secondary-actions">
        <button onClick={onSale}><FileText size={21} /><span>บันทึกรายการขาย</span></button>
        <button onClick={onSettlement}><Banknote size={21} /><span>บันทึกส่งเงิน</span></button>
        <button onClick={onReports}><FileDown size={21} /><span>รายงาน/ส่งออก</span></button>
      </div>
    </section>
    <section className="tapper-summary-grid"><Metric label="รายการกำลังรอ Owner ยืนยัน" value={connected ? `${data.pendingReviews} รายการ` : "—"} icon={<FileText />} /><Metric label="ยอดขายเดือนนี้" value={showMoney(data.monthlySales)} icon={<Sprout />} /></section>
    <section className="tapper-sales-card sales-card"><div><small>ยอดขายที่ยืนยันแล้วรายสัปดาห์</small><strong>{showMoney(data.monthlySales)}</strong><span className="growth">{connected ? "ข้อมูลจาก Apps Script" : "รอเชื่อมต่อฐานข้อมูล"}</span></div><div className="bars">{connected && salesSeries.some((value) => value > 0) ? salesSeries.map((value, i) => <div key={i} style={{ height: `${Math.max(8, value / salesSeriesMax * 100)}%` }}><span>ส.{i + 1}</span></div>) : <p className="empty-chart">{connected ? "ยังไม่มียอดขายที่ยืนยันในเดือนนี้" : "กราฟจะแสดงเมื่อโหลดข้อมูลจริงสำเร็จ"}</p>}</div></section>
  </div>;
}

function SalesScreen({ sales, role, onSale, onReview, onRefresh }: { sales: Sale[]; role: Role; onSale: () => void; onReview: (sale: Sale) => void; onRefresh: () => void }) {
  return <section className="panel"><div className="panel-head"><div><h2>รายการขายล่าสุด</h2><p>เปิดดูบิลและรายละเอียดการคำนวณก่อนยืนยันทุกครั้ง</p></div><div className="panel-actions"><button className="secondary" onClick={onRefresh}>รีเฟรช</button>{role === "tapper" && <button className="primary" onClick={onSale}><Plus size={16} />เพิ่มรายการ</button>}</div></div>{sales.length === 0 ? <Empty text="ยังไม่มีรายการขายจากสวนที่เลือก" /> : <div className="data-list">{sales.map((sale) => <article className="data-row sale-row" key={sale.id}><div><strong>{sale.buyerName || "ร้านรับซื้อไม่ระบุ"}</strong><span>{formatThaiDateTime(sale.saleDate)} · {sale.productType || "ยางพารา"} · {sale.netWeight || sale.weightKg || 0} กก.</span><small className="evidence-label">{sale.receiptFileId ? <><Image size={13} />มีภาพใบเสร็จ · OCR {Math.round(Number(sale.ocrConfidence || 0) * 100)}%</> : <><FileText size={13} />บันทึกด้วยมือ</>}</small></div><div><strong>{money(sale.grossSale || 0)}</strong><span className={`status ${sale.status}`}>{labelStatus(sale.status)}</span></div><div className="panel-actions sale-row-actions"><button className={role === "owner" && sale.status === "pending_owner_review" ? "primary" : "link-button"} onClick={() => onReview(sale)}>{role === "owner" && sale.status === "pending_owner_review" ? <><ShieldCheck size={15} />ตรวจและยืนยัน</> : <><Eye size={15} />ดูรายละเอียด</>}</button>{role === "owner" && sale.status === "confirmed" && <button className="link-button" onClick={async () => { const reason = window.prompt("เหตุผลการปรับยอด"); const amount = Number(window.prompt("จำนวนเงินที่ปรับ", "0") || 0); const type = window.prompt("ประเภท: owner_credit / owner_debit / tapper_credit / tapper_debit", "owner_debit") || "owner_debit"; if (reason && amount > 0) { await api.adjustments.create({ saleId: sale.id, adjustmentType: type, amount, reason }); onRefresh(); } }}>ปรับยอด</button>}{role === "owner" && sale.status === "disputed" && <button className="link-button" onClick={async () => { const resolution = window.prompt("ผลการตรวจสอบข้อพิพาท"); if (resolution) { await api.disputes.resolve({ decision: "resolved", resolution, saleId: sale.id }); onRefresh(); } }}>แก้ไขข้อพิพาท</button>}</div></article>)}</div>}</section>;
}

function SaleReviewModal({ sale, role, onClose, onChanged }: { sale: Sale; role: Role; onClose: () => void; onChanged: () => void }) {
  const [evidence, setEvidence] = useState<SaleReceiptEvidence | null>(null);
  const [loadingEvidence, setLoadingEvidence] = useState(Boolean(sale.receiptFileId));
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (!sale.receiptFileId) { setLoadingEvidence(false); return () => { active = false; }; }
    void api.sales.receipt(sale.id).then((result) => { if (active) setEvidence(result); }).catch((caught) => { if (active) setError(userMessageForApiError(caught)); }).finally(() => { if (active) setLoadingEvidence(false); });
    return () => { active = false; };
  }, [sale.id, sale.receiptFileId]);
  const confirmSale = async () => {
    if (!reviewed) return;
    setBusy(true); setError("");
    try { await api.sales.confirm(sale.id); onChanged(); }
    catch (caught) { setError(userMessageForApiError(caught)); }
    finally { setBusy(false); }
  };
  const disputeSale = async () => {
    const reason = window.prompt("เหตุผลที่คัดค้านรายการ");
    if (!reason) return;
    setBusy(true); setError("");
    try { await api.sales.dispute({ saleId: sale.id, reason }); onChanged(); }
    catch (caught) { setError(userMessageForApiError(caught)); }
    finally { setBusy(false); }
  };
  const canDispute = ["pending_owner_review", "confirmed"].includes(sale.status);
  return <Modal title="ตรวจรายละเอียดรายการขาย" onClose={onClose}><div className="sale-review"><div className="sale-review-summary"><div><small>ยอดขายก่อนหัก</small><strong>{money(sale.grossSale || 0)}</strong><span>{formatThaiDateTime(sale.saleDate)} · {sale.buyerName || "ไม่ระบุร้านรับซื้อ"}</span></div><span className={`status ${sale.status}`}>{labelStatus(sale.status)}</span></div><section className="receipt-evidence"><div className="receipt-evidence-head"><div><Image size={18} /><span><strong>หลักฐานใบเสร็จ</strong><small>{sale.receiptFileId ? `OCR ${Math.round(Number(sale.ocrConfidence || 0) * 100)}%` : "รายการบันทึกด้วยมือ"}</small></span></div></div>{loadingEvidence ? <div className="receipt-placeholder loading-evidence"><LoadingAnimation compact label="กำลังโหลดใบเสร็จ" /></div> : evidence ? <img src={evidence.dataUrl} alt={`ใบเสร็จรายการขาย ${sale.id}`} /> : <div className="receipt-placeholder manual"><FileText size={25} /><strong>ไม่มีภาพใบเสร็จ</strong><span>รายการนี้ถูกบันทึกด้วยมือ โปรดตรวจตัวเลขกับหลักฐานภายนอกก่อนยืนยัน</span></div>}</section><section className="sale-calculation"><h3>รายละเอียดและการแบ่งเงิน</h3><div className="sale-detail-grid"><Detail label="ประเภทสินค้า" value={sale.productType || "ไม่ระบุ"} /><Detail label="น้ำหนักสุทธิ" value={`${sale.netWeight || sale.weightKg || 0} กก.`} /><Detail label="ราคาต่อหน่วย" value={money(sale.unitPrice || 0)} /><Detail label="หักหน้าร้าน" value={money(sale.buyerDeductions || 0)} /><Detail label="ค่าใช้จ่ายร่วม" value={money(sale.sharedExpenses || 0)} /><Detail label="ฐานแบ่งเงิน" value={money(sale.splitBase || 0)} /></div><div className="split-review"><div><small>สิทธิ Owner</small><strong>{money(sale.ownerShare || 0)}</strong></div><div><small>สิทธิ Tapper</small><strong>{money(sale.tapperShare || 0)}</strong></div></div><small className="agreement-reference">Agreement: {sale.agreementId}</small></section>{role === "owner" && sale.status === "pending_owner_review" && <label className="review-confirmation"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /><span><strong>ฉันตรวจหลักฐานและตัวเลขแล้ว</strong><small>เมื่อยืนยัน ระบบจะเปลี่ยน WalletEntries จาก pending เป็น confirmed</small></span></label>}{error && <div className="form-error" role="alert">{error}</div>}<div className="sale-review-actions">{canDispute && <button className="danger-button" disabled={busy} onClick={() => void disputeSale()}>คัดค้านรายการ</button>}{role === "owner" && sale.status === "pending_owner_review" && <button className="primary" disabled={busy || !reviewed || loadingEvidence || Boolean(sale.receiptFileId && !evidence)} onClick={() => void confirmSale()}><CheckCircle2 size={17} />{busy ? "กำลังยืนยัน..." : "ยืนยันรายการขาย"}</button>}</div></div></Modal>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div><small>{label}</small><strong>{value}</strong></div>; }

function GardensScreen({ garden, gardens, members, role, onCreate, onAddMember, onDeactivate }: { garden?: Garden; gardens: Garden[]; members: GardenMember[]; role: Role; onCreate: () => void; onAddMember: () => void; onDeactivate: (member: GardenMember) => void }) {
  return <section className="panel"><div className="panel-head"><div><h2>สวนและแปลง</h2><p>จัดการพื้นที่ จำนวนต้นยาง และสมาชิกที่เข้าถึงข้อมูลสวน</p></div>{role === "owner" && <button className="primary" onClick={onCreate}><Plus size={16} />เพิ่มสวน</button>}</div>{gardens.length === 0 ? <Empty text="ยังไม่มีสวนที่เชื่อมต่อกับบัญชี" /> : <div className="card-grid">{gardens.map((item) => <div className="info-card" key={item.id}><span className="eyebrow">ACTIVE GARDEN</span><h3>{item.name}</h3><p>{item.province || "ไม่ระบุจังหวัด"} · {item.district || "ไม่ระบุอำเภอ"}</p><strong>{item.areaRai || 0} ไร่ · {(item.treeCount || 0).toLocaleString()} ต้น</strong></div>)}</div>}{role === "owner" && garden && <section className="member-management" aria-label="จัดการสมาชิกสวน"><div className="member-management-head"><div><span><Users size={19} />สมาชิกสวน</span><small>เฉพาะ Owner เท่านั้นที่เพิ่มหรือปิดสิทธิ์ Tapper ได้</small></div><button className="secondary" onClick={onAddMember}><UserPlus size={16} />เพิ่ม Tapper</button></div>{members.length === 0 ? <Empty text="ยังไม่มีสมาชิกที่ active ในสวนนี้" /> : <div className="member-list">{members.map((member) => <article className="member-row" key={member.id}><div className="member-avatar">{member.role === "owner" ? "O" : "T"}</div><div><strong>{member.name || (member.role === "owner" ? "Owner" : "Tapper")}</strong><span>{member.email || member.userId}</span><small>{member.role === "owner" ? "เจ้าของสวน" : "คนกรีดยาง · ใช้งานอยู่"}</small></div>{member.role === "tapper" && <button className="danger-button" onClick={() => onDeactivate(member)}><UserMinus size={15} />ปิดสิทธิ์</button>}</article>)}</div>}</section>}</section>;
}

function AgreementsScreen({ agreements, garden, role, onCreate }: { agreements: Agreement[]; garden?: Garden; role: Role; onCreate: () => void }) { return <section className="panel"><div className="panel-head"><div><h2>ข้อตกลงแบ่งรายได้</h2><p>{garden?.name || "เลือกสวนก่อนสร้างข้อตกลง"} · ทุก version ไม่กระทบรายการย้อนหลัง</p></div>{role === "owner" && <button className="secondary" onClick={onCreate}>สร้าง version ใหม่</button>}</div>{agreements.length === 0 ? <Empty text="ยังไม่มี Agreement ที่ active" /> : <div className="data-list">{agreements.map((agreement) => <article className="data-row" key={agreement.id}><div><strong>Version {agreement.version}</strong><span>มีผล {agreement.effectiveFrom} · {agreement.status}</span></div><div><strong>{agreement.ownerPercentage}/{agreement.tapperPercentage}</strong><span>Owner / Tapper</span></div></article>)}</div>}</section>; }

function SettlementsScreen({ settlements, wallet, role, onCreate, onRefresh }: { settlements: Settlement[]; wallet: WalletData | null; role: Role; onCreate: () => void; onRefresh: () => void }) {
  const [reviewSettlement, setReviewSettlement] = useState<Settlement | null>(null);
  return <>
    <section className="panel">
      <div className="panel-head">
        <div><h2>การส่งเงินและยอดคงค้าง</h2><p>เงินของเจ้าของที่ยังอยู่กับคนกรีด: {money(wallet?.owner.outstanding || 0)}</p></div>
        <div className="panel-actions"><button className="secondary" onClick={onRefresh}>รีเฟรช</button>{role === "tapper" && <button className="primary" onClick={onCreate}><Plus size={16} />บันทึกการส่งเงิน</button>}</div>
      </div>
      {settlements.length === 0 ? <Empty text="ยังไม่มี settlement ในช่วงนี้" /> : <div className="data-list">{settlements.map((item) =>
        <article className="data-row settlement-row" key={item.id}>
          <div className="settlement-row-copy">
            <strong>{money(item.amount)}</strong>
            <span>{item.method === "cash" ? `เงินสด · ${item.location || "ไม่ระบุสถานที่"}` : `โอนธนาคาร${item.bank ? ` · ${item.bank}` : ""}`} · {formatThaiDateTime(item.transferDate)}</span>
            <small className="evidence-label">{item.method === "bank_transfer" ? <><FileText size={13} />{item.slipFileId ? "มีสลิปแนบ" : "ไม่พบสลิป"}</> : <><Banknote size={13} />รอ Owner ยืนยันการรับเงินสด</>}</small>
          </div>
          <span className={`status ${item.status}`}>{labelStatus(item.status)}</span>
          <div className="panel-actions settlement-confirm-actions settlement-row-actions">
            <button className={role === "owner" && item.status === "pending_owner_confirmation" ? "primary" : "link-button"} onClick={() => setReviewSettlement(item)}>{role === "owner" && item.status === "pending_owner_confirmation" ? <><ShieldCheck size={15} />ตรวจและยืนยัน</> : <><Eye size={15} />ดูรายละเอียด</>}</button>
            {role === "tapper" && item.status === "pending_owner_confirmation" && <button className="link-button" onClick={async () => { if (window.confirm("ยกเลิกรายการส่งเงินนี้หรือไม่")) { await api.settlements.cancel(item.id); onRefresh(); } }}>ยกเลิก</button>}
          </div>
        </article>
      )}</div>}
    </section>
    {reviewSettlement && <SettlementReviewModal settlement={reviewSettlement} role={role} onClose={() => setReviewSettlement(null)} onChanged={() => { setReviewSettlement(null); onRefresh(); }} />}
  </>;
}

function SettlementReviewModal({ settlement, role, onClose, onChanged }: { settlement: Settlement; role: Role; onClose: () => void; onChanged: () => void }) {
  const [evidence, setEvidence] = useState<SettlementEvidence | null>(null);
  const [loadingEvidence, setLoadingEvidence] = useState(settlement.method === "bank_transfer" && Boolean(settlement.slipFileId));
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (settlement.method !== "bank_transfer" || !settlement.slipFileId) { setLoadingEvidence(false); return () => { active = false; }; }
    void api.settlements.evidence(settlement.id).then((result) => { if (active) setEvidence(result); }).catch((caught) => { if (active) setError(userMessageForApiError(caught)); }).finally(() => { if (active) setLoadingEvidence(false); });
    return () => { active = false; };
  }, [settlement.id, settlement.method, settlement.slipFileId]);
  const confirmSettlement = async () => {
    if (!reviewed) return;
    setBusy(true); setError("");
    try { await api.settlements.confirm(settlement.id); onChanged(); }
    catch (caught) { setError(userMessageForApiError(caught)); }
    finally { setBusy(false); }
  };
  const rejectSettlement = async () => {
    const reason = window.prompt("เหตุผลที่ปฏิเสธรายการส่งเงิน");
    if (!reason) return;
    setBusy(true); setError("");
    try { await api.settlements.reject({ settlementId: settlement.id, reason }); onChanged(); }
    catch (caught) { setError(userMessageForApiError(caught)); }
    finally { setBusy(false); }
  };
  const isPendingOwnerReview = role === "owner" && settlement.status === "pending_owner_confirmation";
  const evidenceReady = settlement.method === "cash" || Boolean(evidence);
  return <Modal title="ตรวจรายละเอียดการส่งเงิน" onClose={onClose}><div className="sale-review settlement-review"><div className="sale-review-summary"><div><small>ยอดที่ Tapper ส่งให้ Owner</small><strong>{money(settlement.amount)}</strong><span>{formatThaiDateTime(settlement.transferDate)} · {settlement.method === "cash" ? "เงินสด" : "โอนธนาคาร"}</span></div><span className={`status ${settlement.status}`}>{labelStatus(settlement.status)}</span></div><section className="receipt-evidence settlement-evidence"><div className="receipt-evidence-head"><div>{settlement.method === "cash" ? <Banknote size={18} /> : <Image size={18} />}<span><strong>{settlement.method === "cash" ? "หลักฐานการรับเงินสด" : "สลิปการโอนเงิน"}</strong><small>{settlement.method === "cash" ? "ยืนยันต่อหน้าบนมือถือ Owner" : "ไฟล์ส่วนตัวจาก Google Drive"}</small></span></div></div>{settlement.method === "cash" ? <div className="receipt-placeholder manual cash-evidence"><Banknote size={28} /><strong>โปรดตรวจนับเงินสดก่อนยืนยัน</strong><span>สถานที่ส่งมอบ: {settlement.location || "ไม่ระบุ"}</span></div> : loadingEvidence ? <div className="receipt-placeholder loading-evidence"><LoadingAnimation compact label="กำลังโหลดสลิป" /></div> : evidence?.mimeType === "application/pdf" ? <div className="pdf-evidence"><FileText size={28} /><strong>{evidence.name}</strong><a className="secondary" href={evidence.dataUrl} download={evidence.name}><FileDown size={15} />เปิดไฟล์ PDF</a></div> : evidence ? <img src={evidence.dataUrl} alt={`สลิปการส่งเงิน ${settlement.id}`} /> : <div className="receipt-placeholder manual"><FileText size={25} /><strong>ไม่พบสลิป</strong><span>ห้ามยืนยันรายการโอนจนกว่าจะตรวจสอบหลักฐานได้</span></div>}</section><section className="sale-calculation"><h3>รายละเอียดการส่งมอบ</h3><div className="sale-detail-grid"><Detail label="วิธีส่งเงิน" value={settlement.method === "cash" ? "เงินสด" : "โอนธนาคาร"} /><Detail label="วันที่ส่งเงิน" value={formatThaiDateTime(settlement.transferDate)} /><Detail label="ธนาคาร" value={settlement.bank || "—"} /><Detail label="เลขอ้างอิง" value={settlement.referenceNo || "—"} /><Detail label="สถานที่" value={settlement.location || "—"} /><Detail label="หมายเหตุ" value={settlement.note || "—"} /></div></section>{isPendingOwnerReview && <label className="review-confirmation"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /><span><strong>{settlement.method === "cash" ? "ฉันตรวจนับและได้รับเงินสดจริงแล้ว" : "ฉันตรวจสลิปและพบยอดเงินเข้าจริงแล้ว"}</strong><small>เมื่อยืนยัน ระบบจะตัดยอดคงค้างและบันทึกประวัติของทั้งสองฝ่าย</small></span></label>}{error && <div className="form-error" role="alert">{error}</div>}<div className="sale-review-actions">{isPendingOwnerReview && <button className="danger-button" disabled={busy} onClick={() => void rejectSettlement()}>ปฏิเสธรายการ</button>}{isPendingOwnerReview && <button className="primary" disabled={busy || !reviewed || loadingEvidence || !evidenceReady} onClick={() => void confirmSettlement()}><CheckCircle2 size={17} />{busy ? "กำลังยืนยัน..." : settlement.method === "cash" ? "ยืนยันว่าได้รับเงินสดแล้ว" : "ยืนยันยอดโอนแล้ว"}</button>}</div></div></Modal>;
}

function ReportsScreen({ garden }: { garden?: Garden }) { const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)); const [to, setTo] = useState(dateToday()); const [report, setReport] = useState<{ summary: Record<string, number | string>; rows: Sale[] } | null>(null); const [busy, setBusy] = useState(false); const load = async () => { if (!garden) return; setBusy(true); try { setReport(await api.reports.summary({ gardenId: garden.id, from, to })); } catch { setReport(null); } finally { setBusy(false); } }; const exportCsv = () => { if (!report) return; const lines = [["saleDate","buyerName","grossSale","ownerShare","tapperShare","status"], ...report.rows.map((row) => [row.saleDate, row.buyerName || "", row.grossSale || 0, row.ownerShare || 0, row.tapperShare || 0, row.status])]; const blob = new Blob([lines.map((line) => line.join(",")).join("\n")], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "parawallet-report.csv"; anchor.click(); URL.revokeObjectURL(url); }; return <section className="panel"><div className="panel-head"><div><h2>รายงานตามช่วงเวลา</h2><p>คำนวณจาก Sales และ Settlements บน Apps Script</p></div><button className="secondary" disabled={!report} onClick={exportCsv}>Export CSV</button></div><div className="filters"><label>ตั้งแต่<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>ถึง<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label><button className="primary" onClick={load}>{busy ? "กำลังโหลด..." : "ดูรายงาน"}</button></div>{report ? <div className="report-grid">{[["ยอดขายรวม", money(Number(report.summary.grossSales))], ["ส่วนเจ้าของ", money(Number(report.summary.ownerShare))], ["ส่วนคนกรีด", money(Number(report.summary.tapperShare))], ["ยอดคงค้าง", money(Number(report.summary.outstanding))]].map(([label, value]) => <div className="metric" key={label}><small>{label}</small><strong>{value}</strong></div>)}</div> : <Empty text="เลือกช่วงวันที่เพื่อโหลดรายงาน" />}</section>; }

function NotificationsScreen({ notifications, onOpen }: { notifications: Notification[]; onOpen: (item: Notification) => void }) {
  const unread = notifications.filter((item) => !item.readAt).length;
  return <section className="panel"><div className="panel-head"><div><h2>การแจ้งเตือน</h2><p>{unread > 0 ? `ยังไม่อ่าน ${unread} รายการ · แตะเพื่อเปิดงานที่เกี่ยวข้อง` : "อ่านครบแล้ว · รายการใหม่จะปรากฏที่นี่"}</p></div></div>{notifications.length === 0 ? <Empty text="ยังไม่มีการแจ้งเตือน" /> : <div className="data-list">{notifications.map((item) => <button type="button" className={`data-row notification-row ${item.readAt ? "read" : "unread"}`} key={item.id} onClick={() => onOpen(item)}><span className="notification-state" aria-hidden="true" /><span className="notification-copy"><strong>{item.title}</strong><span>{item.body}</span><small>{new Date(item.createdAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}</small></span><span className="notification-action">เปิดรายการ</span></button>)}</div>}</section>;
}

function GardenForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) { const [form, setForm] = useState({ name: "", province: "", district: "", areaRai: "", treeCount: "" }); const [busy, setBusy] = useState(false); const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); try { await api.gardens.create({ name: form.name, province: form.province, district: form.district, areaRai: Number(form.areaRai), treeCount: Number(form.treeCount) }); onSaved(); } finally { setBusy(false); } }; return <Modal title="เพิ่มสวนใหม่" onClose={onClose}><form className="form-grid" onSubmit={submit}><label>ชื่อสวน<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>จังหวัด<input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} /></label><label>อำเภอ<input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></label><label>พื้นที่ (ไร่)<input type="number" min="0" value={form.areaRai} onChange={(e) => setForm({ ...form, areaRai: e.target.value })} /></label><label>จำนวนต้นยาง<input type="number" min="0" value={form.treeCount} onChange={(e) => setForm({ ...form, treeCount: e.target.value })} /></label><button className="primary" disabled={busy}>{busy ? "กำลังบันทึก..." : "บันทึกสวน"}</button></form></Modal>; }

function MemberForm({ garden, onClose, onSaved }: { garden?: Garden; onClose: () => void; onSaved: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!garden) return;
    setBusy(true); setError("");
    try { await api.members.add({ gardenId: garden.id, email: email.trim().toLowerCase() }); onSaved(); }
    catch (caught) { setError(userMessageForApiError(caught)); }
    finally { setBusy(false); }
  };
  return <Modal title="เพิ่ม Tapper เข้าสวน" onClose={onClose}><form className="form-grid member-form" onSubmit={submit}><div className="transparency-note"><ShieldCheck size={19} /><div><strong>เพิ่มได้เฉพาะบัญชี Tapper ที่ลงทะเบียนแล้ว</strong><span>อีเมลต้องตรงกับ Google Account และมีสถานะ active ในแท็บ Users</span></div></div><label>อีเมล Google ของ Tapper<input required type="email" inputMode="email" autoCapitalize="none" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@gmail.com" /></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="primary" disabled={busy || !garden || !email.trim()}>{busy ? "กำลังตรวจสอบบัญชี..." : "เพิ่ม Tapper เข้าสวน"}</button></form></Modal>;
}

function SaleForm({ garden, agreement, role, onClose, onSaved }: { garden?: Garden; agreement?: Agreement; role: Role; onClose: () => void; onSaved: () => void }) { const [form, setForm] = useState({ saleDate: dateToday(), buyerName: "", productType: "ยางก้อนถ้วย", weightKg: "", unitPrice: "", buyerDeductions: "0", sharedExpenses: "0" }); const [busy, setBusy] = useState(false); const total = Number(form.weightKg || 0) * Number(form.unitPrice || 0); const splitBase = Math.max(0, total - Number(form.buyerDeductions || 0) - Number(form.sharedExpenses || 0)); const owner = splitBase * Number(agreement?.ownerPercentage || 60) / 100; const tapper = splitBase - owner; const submit = async (event: FormEvent) => { event.preventDefault(); if (!garden || !agreement) return; setBusy(true); try { await api.sales.create({ gardenId: garden.id, agreementId: agreement.id, saleDate: form.saleDate, buyerName: form.buyerName, productType: form.productType, weightKg: Number(form.weightKg), unitPrice: Number(form.unitPrice), buyerDeductions: Number(form.buyerDeductions), sharedExpenses: Number(form.sharedExpenses), manualEntry: true }); onSaved(); } finally { setBusy(false); } }; return <Modal title={role === "tapper" ? "บันทึกรายการขาย" : "ทบทวนรายการขาย"} onClose={onClose}><form className="form-grid" onSubmit={submit}><label>วันที่ขาย<input type="date" required value={form.saleDate} onChange={(e) => setForm({ ...form, saleDate: e.target.value })} /></label><label>ร้านรับซื้อ<input value={form.buyerName} onChange={(e) => setForm({ ...form, buyerName: e.target.value })} /></label><label>ประเภทสินค้า<select value={form.productType} onChange={(e) => setForm({ ...form, productType: e.target.value })}><option>น้ำยางสด</option><option>ยางก้อนถ้วย</option><option>ยางแผ่น</option><option>อื่น ๆ</option></select></label><label>น้ำหนัก (กก.)<input type="number" min="0" step="0.01" required value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} /></label><label>ราคา/กก.<input type="number" min="0" step="0.01" required value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} /></label><label>หักหน้าร้าน<input type="number" min="0" step="0.01" value={form.buyerDeductions} onChange={(e) => setForm({ ...form, buyerDeductions: e.target.value })} /></label><label>ค่าใช้จ่ายร่วม<input type="number" min="0" step="0.01" value={form.sharedExpenses} onChange={(e) => setForm({ ...form, sharedExpenses: e.target.value })} /></label><div className="calculation-preview"><span>ฐานแบ่ง {money(splitBase)}</span><strong>Owner {money(owner)} · Tapper {money(tapper)}</strong></div><button className="primary" disabled={busy || !garden || !agreement}>{busy ? "กำลังบันทึก..." : "ยืนยันรายการ"}</button>{!agreement && <small className="form-hint">ต้องมี Agreement ที่ active ก่อนสร้างรายการขาย</small>}</form></Modal>; }

function SettlementForm({ garden, role, onClose, onSaved }: { garden?: Garden; role: Role; onClose: () => void; onSaved: () => void }) {
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
    if (!garden) return;
    if (form.method === "bank_transfer" && !slipFile) { setError("กรุณาแนบสลิปการโอนเงิน"); return; }
    if (form.method === "cash" && !form.location.trim()) { setError("กรุณาระบุสถานที่ส่งมอบเงินสด"); return; }
    setBusy(true); setError("");
    try {
      const slipData = slipFile ? await readFileAsDataUrl_(slipFile) : "";
      await api.settlements.create({ gardenId: garden.id, amount: Number(form.amount), method: form.method, transferDate: form.transferDate, referenceNo: form.referenceNo, bank: form.bank, location: form.location, note: form.note, slipData, slipMimeType: slipFile?.type || "", slipFilename: slipFile?.name || "" });
      onSaved();
    } catch (caught) { setError(userMessageForApiError(caught)); }
    finally { setBusy(false); }
  };
  return <Modal title={role === "owner" ? "บันทึกการรับเงิน" : "บันทึกการส่งเงิน"} onClose={onClose}><form className="form-grid settlement-form" onSubmit={submit}><label>จำนวนเงิน<input required type="number" min="0.01" step="0.01" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label><label>วิธีส่งเงิน<select value={form.method} onChange={(e) => { setForm({ ...form, method: e.target.value }); setError(""); }}><option value="bank_transfer">โอนธนาคาร</option><option value="cash">ส่งมอบเงินสด</option></select></label><label>วันที่ส่งเงิน<input required type="date" value={form.transferDate} onChange={(e) => setForm({ ...form, transferDate: e.target.value })} /></label>{form.method === "bank_transfer" ? <><label>ธนาคาร<input required value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} placeholder="ชื่อธนาคาร" /></label><label>เลขอ้างอิง<input value={form.referenceNo} onChange={(e) => setForm({ ...form, referenceNo: e.target.value })} placeholder="เลขอ้างอิงในสลิป" /></label><label className="slip-upload"><span><Upload size={17} />แนบสลิปการโอน</span><input required type="file" accept="image/*,application/pdf" onChange={(event) => selectSlip(event.target.files?.[0] || null)} /><small>รองรับรูปภาพหรือ PDF ไม่เกิน 4 MB</small></label>{slipFile && <div className="evidence-selected"><ShieldCheck size={17} /><span>แนบแล้ว: {slipFile.name}</span></div>}<div className="transparency-note"><ShieldCheck size={19} /><div><strong>เจ้าของสวนต้องตรวจสอบและยืนยันยอดโอน</strong><span>รายการจะยังไม่หักยอดคงค้างจนกว่า Owner จะกดยืนยัน</span></div></div></> : <><label>สถานที่ส่งมอบเงินสด<input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="เช่น ที่สวนป่าพะยอม" /></label><div className="transparency-note cash"><Banknote size={19} /><div><strong>Owner ต้องกดยืนยันว่าได้รับเงินสดแล้ว</strong><span>ทั้งสองฝ่ายจะเห็นสถานะรอยืนยันและประวัติเดียวกัน</span></div></div></>}<label>หมายเหตุ<textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" /></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="primary settlement-submit" disabled={busy || !garden || (form.method === "bank_transfer" && !slipFile)}>{busy ? "กำลังบันทึกหลักฐาน..." : form.method === "cash" ? "ส่งให้เจ้าของยืนยันรับเงินสด" : "ส่งยอดโอนพร้อมสลิปให้เจ้าของยืนยัน"}</button></form></Modal>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="modal-backdrop" role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="ปิด"><X size={18} /></button></div>{children}</div></div>; }
function Empty({ text }: { text: string }) { return <div className="empty-state"><Leaf size={28} /><strong>{text}</strong><span>เมื่อเชื่อมต่อข้อมูลจริง รายการจะแสดงที่หน้านี้</span></div>; }
function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <div className="metric"><div><small>{label}</small><strong>{value}</strong><span>ข้อมูลล่าสุด</span></div><i>{icon}</i></div>; }
function WalletLine({ label, amount, percent, color }: { label: string; amount: string; percent: number; color: string }) { return <div className="wallet-line"><div><span><b className={color} />{label}</span><strong>{amount}</strong></div><div className="progress"><i className={color} style={{ width: `${percent}%` }} /></div></div>; }
function labelStatus(status: string) { return ({ pending_owner_review: "รอตรวจ", confirmed: "ยืนยันแล้ว", disputed: "โต้แย้ง", pending_owner_confirmation: "รอเจ้าของยืนยัน", rejected: "ปฏิเสธ", cancelled: "ยกเลิก", partially_confirmed: "ยืนยันบางส่วน" } as Record<string, string>)[status] || status; }


function ReceiptForm({ garden, agreement, initialFile, onClose, onSaved }: { garden?: Garden; agreement?: Agreement; initialFile?: File | null; onClose: () => void; onSaved: () => void }) {
  const [file, setFile] = useState<File | null>(initialFile || null);
  const [fields, setFields] = useState<Record<string, string>>({ saleDate: dateToday(), buyerName: "", productType: "", weightKg: "", unitPrice: "", grossSale: "", buyerDeductions: "0" });
  const [receiptId, setReceiptId] = useState("");
  const [receiptFileId, setReceiptFileId] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [status, setStatus] = useState("upload");
  const [duplicate, setDuplicate] = useState<{ possibleDuplicate: boolean; matches?: Sale[] }>({ possibleDuplicate: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const initialFileProcessed = useRef(false);
  const handleFile = async (selected: File | null) => {
    if (!selected || !garden) return;
    if (selected.size > MAX_EVIDENCE_BYTES) { setError("ภาพใบเสร็จต้องมีขนาดไม่เกิน 4 MB"); return; }
    setFile(selected);
    setBusy(true); setError(""); setReceiptId(""); setReceiptFileId("");
    try {
      const data = await readFileAsDataUrl_(selected);
      const result = await api.receipts.extract({ gardenId: garden.id, data, mimeType: selected.type, filename: selected.name });
      const extracted = (result as { ocr?: { fields?: Record<string, unknown>; confidence?: number; score?: number; needsReview?: boolean; reviewLevel?: string }; file?: { fileId?: string } }).ocr;
      const next = extracted?.fields || {};
      setFields((current) => ({ ...current, ...Object.fromEntries(Object.entries(next).map(([key, value]) => [key, String(value ?? "")])) }));
      setReceiptId(String((result as { receiptId?: string }).receiptId || ""));
      setReceiptFileId(String((result as { file?: { fileId?: string } }).file?.fileId || ""));
      setConfidence(Number(extracted?.score !== undefined ? Number(extracted.score) / 100 : extracted?.confidence || 0));
      setStatus(extracted?.reviewLevel === "mandatory" || extracted?.needsReview ? "needs_review" : "ready");
    } catch (caught) {
      setStatus("error"); setError(userMessageForApiError(caught));
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
  const submit = async () => {
    if (!garden || !agreement) return;
    setBusy(true);
    try {
      const duplicateResult = await checkDuplicate();
      if (duplicateResult?.possibleDuplicate && status !== "duplicate") { setStatus("duplicate"); return; }
      await api.sales.create({ gardenId: garden.id, agreementId: agreement.id, receiptId, saleDate: fields.saleDate, buyerName: fields.buyerName, productType: fields.productType, weightKg: Number(fields.weightKg || 0), unitPrice: Number(fields.unitPrice || 0), buyerDeductions: Number(fields.buyerDeductions || 0), receiptFileId, manualEntry: false });
      onSaved();
    } catch (caught) { setError(userMessageForApiError(caught)); }
    finally { setBusy(false); }
  };
  const setField = (key: string, value: string) => setFields((current) => ({ ...current, [key]: value }));
  return <Modal title="สแกนบิลและตรวจสอบ OCR" onClose={onClose}><div className="form-grid"><label>ถ่ายใหม่หรือเลือกรูปอื่น<input type="file" accept="image/*" capture="environment" onChange={(event) => void handleFile(event.target.files?.[0] || null)} /></label>{file && <div className="calculation-preview"><span>ไฟล์: {file.name}</span><strong>{busy ? "กำลังอ่าน OCR..." : `สถานะ ${status}`}</strong></div>}<label>วันที่ขาย<input type="date" value={fields.saleDate} onChange={(e) => setField("saleDate", e.target.value)} /></label><label>ร้านรับซื้อ<input value={fields.buyerName} onChange={(e) => setField("buyerName", e.target.value)} /></label><label>ประเภทสินค้า<input value={fields.productType} onChange={(e) => setField("productType", e.target.value)} /></label><label>น้ำหนักสุทธิ (กก.)<input type="number" step="0.01" value={fields.weightKg} onChange={(e) => setField("weightKg", e.target.value)} /></label><label>ราคา/กก.<input type="number" step="0.01" value={fields.unitPrice} onChange={(e) => setField("unitPrice", e.target.value)} /></label><label>ยอดก่อนหัก<input type="number" step="0.01" value={fields.grossSale} onChange={(e) => setField("grossSale", e.target.value)} /></label><label>รายการหัก<input type="number" step="0.01" value={fields.buyerDeductions} onChange={(e) => setField("buyerDeductions", e.target.value)} /></label>{confidence !== null && <div className={`calculation-preview ${confidence < 0.9 ? "low-confidence" : ""}`}><span>OCR validation score: {(confidence * 100).toFixed(0)}%</span><strong>{confidence < 0.8 ? "ต้องตรวจสอบข้อมูลก่อนสร้างรายการ" : confidence < 0.9 ? "แนะนำให้ตรวจสอบข้อมูลที่อ่านได้" : "คะแนนสูง แต่ควรตรวจสอบก่อนยืนยัน"}</strong></div>}{duplicate.possibleDuplicate && <div className="calculation-preview low-confidence"><span>พบรายการที่อาจซ้ำ {duplicate.matches?.length || 0} รายการ</span><strong>ตรวจสอบก่อนกดยืนยันอีกครั้ง</strong></div>}{error && <div className="form-error" role="alert">{error}</div>}<button className="secondary" onClick={() => void checkDuplicate()} disabled={!garden || busy}>ตรวจรายการซ้ำ</button><button className="primary" onClick={() => void submit()} disabled={!garden || !agreement || !receiptId || !receiptFileId || busy || !fields.saleDate}>{status === "duplicate" ? "ยืนยันว่าเป็นบิลคนละรายการ" : busy ? "กำลังบันทึก..." : "ยืนยันข้อมูลและสร้างรายการ"}</button>{!agreement && <small className="form-hint">ต้องมี Agreement ที่ active ก่อนสร้างรายการขาย</small>}</div></Modal>;
}

function readFileAsDataUrl_(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "")); reader.onerror = reject; reader.readAsDataURL(file); }); }


function AgreementForm({ garden, members, onClose, onSaved }: { garden?: Garden; members: GardenMember[]; onClose: () => void; onSaved: () => void }) {
  const tappers = members.filter((member) => member.role === "tapper" && member.status === "active");
  const [form, setForm] = useState({ tapperId: tappers[0]?.userId || "", ownerPercentage: "60", tapperPercentage: "40", effectiveFrom: dateToday() });
  const [busy, setBusy] = useState(false);
  const total = Number(form.ownerPercentage || 0) + Number(form.tapperPercentage || 0);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!garden || total !== 100) return; setBusy(true); try { await api.agreements.create({ gardenId: garden.id, tapperId: form.tapperId, ownerPercentage: Number(form.ownerPercentage), tapperPercentage: Number(form.tapperPercentage), effectiveFrom: form.effectiveFrom }); onSaved(); } finally { setBusy(false); } };
  return <Modal title="สร้างข้อตกลงแบ่งรายได้" onClose={onClose}><form className="form-grid" onSubmit={submit}><label>Tapper<select required value={form.tapperId} onChange={(e) => setForm({ ...form, tapperId: e.target.value })}><option value="">เลือก Tapper ในสวน</option>{tappers.map((member) => <option key={member.id} value={member.userId}>{member.name || member.email || member.userId}</option>)}</select></label><label>เริ่มมีผลวันที่<input required type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} /></label><label>สัดส่วน Owner (%)<input type="number" min="0" max="100" value={form.ownerPercentage} onChange={(e) => setForm({ ...form, ownerPercentage: e.target.value })} /></label><label>สัดส่วน Tapper (%)<input type="number" min="0" max="100" value={form.tapperPercentage} onChange={(e) => setForm({ ...form, tapperPercentage: e.target.value })} /></label><div className="calculation-preview"><span>รวมสัดส่วน</span><strong className={total === 100 ? "" : "form-hint"}>{total}% {total === 100 ? "พร้อมบันทึก" : "ต้องรวมให้ได้ 100%"}</strong></div><button className="primary" disabled={busy || !garden || !form.tapperId || total !== 100}>{busy ? "กำลังบันทึก..." : "สร้าง Agreement version"}</button>{tappers.length === 0 && <small className="form-hint">ต้องเพิ่ม Tapper ในหน้า “สวนและแปลง” ก่อนสร้างข้อตกลง</small>}</form></Modal>;
}
