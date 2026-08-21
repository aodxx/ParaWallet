import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api, Agreement, ApiError, DashboardData, Garden, Notification, Role, Sale, Settlement, WalletData, onAuthFailure, setAuthToken } from "./api";
import GoogleSignIn from "./GoogleSignIn";
import { Bell, CircleDollarSign, FileText, Leaf, Menu, Plus, ScanLine, Settings2, Sprout, WalletCards, X } from "lucide-react";

type Screen = "overview" | "sales" | "gardens" | "agreements" | "settlements" | "reports" | "notifications";

const fallback: DashboardData = { role: "owner", garden: undefined, wallet: { owner: 0, tapper: 0, outstanding: 0, currency: "THB" }, pendingReviews: 0, monthlySales: 0 };
const money = (value: number) => `฿${Number(value || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;
const dateToday = () => new Date().toISOString().slice(0, 10);
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const AUTH_STORAGE_KEY = "parawallet.googleIdToken";

export default function App() {
  const [role, setRole] = useState<Role>("owner");
  const [screen, setScreen] = useState<Screen>("overview");
  const [authToken, setAuthTokenState] = useState(() => localStorage.getItem(AUTH_STORAGE_KEY) || "");
  const [data, setData] = useState<DashboardData>(fallback);
  const [gardens, setGardens] = useState<Garden[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [connected, setConnected] = useState(false);
  const [showGardenForm, setShowGardenForm] = useState(false);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [showAgreementForm, setShowAgreementForm] = useState(false);
  const [showSettlementForm, setShowSettlementForm] = useState(false);
  const activeGarden = data.garden || gardens[0];

  const handleSignOut = useCallback((reason = "") => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthToken("");
    setAuthTokenState("");
    setConnected(false);
    if (reason) setMessage(reason);
    window.google?.accounts?.id?.disableAutoSelect?.();
  }, []);

  const refresh = async (target: Screen = screen) => {
    setLoading(true);
    setMessage("");
    try {
      const dashboard = await api.dashboard();
      setData(dashboard);
      setRole(dashboard.role);
      setConnected(true);
      const garden = dashboard.garden || gardens[0];
      if (garden?.id) {
        const [gardenRows, saleRows, agreementRows, walletRow, settlementRows] = await Promise.all([
          api.gardens.list(),
          api.sales.list({ gardenId: garden.id }),
          api.agreements.list(garden.id),
          api.wallets.me(garden.id),
          api.settlements.list(garden.id),
        ]);
        setGardens(gardenRows);
        setSales(saleRows);
        setAgreements(agreementRows);
        setWallet(walletRow);
        setSettlements(settlementRows);
      }
      if (target === "notifications") setNotifications(await api.notifications.list());
    } catch (error) {
      setConnected(false);
      if (error instanceof ApiError && ["AUTH_REQUIRED", "INVALID_GOOGLE_ID_TOKEN", "GOOGLE_TOKEN_EXPIRED", "USER_NOT_REGISTERED"].includes(error.code)) {
        handleSignOut("เซสชัน Google หมดอายุหรือไม่มีสิทธิ์ โปรดเข้าสู่ระบบใหม่");
      } else {
        setMessage(error instanceof Error ? error.message : "ยังเชื่อมต่อ Google Sheets ไม่ได้");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    onAuthFailure(() => handleSignOut("เซสชัน Google หมดอายุหรือไม่มีสิทธิ์ โปรดเข้าสู่ระบบใหม่"));
    setAuthToken(authToken);
    if (authToken) void refresh("overview");
    else { setConnected(false); setMessage("กรุณาเข้าสู่ระบบด้วย Google ก่อนเชื่อมต่อฐานข้อมูล"); }
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

  if (!authToken) return <AuthScreen clientId={googleClientId} message={message} onCredential={handleCredential} onError={setMessage} />;

  return <div className="app-shell">
    <header className="topbar">
      <button className="icon-button mobile-only" aria-label="เปิดเมนู"><Menu size={21} /></button>
      <div className="brand"><span className="brand-mark"><Leaf size={22} /></span><span><b>ParaWallet</b><small>DUAL WALLET SYSTEM</small></span></div>
      <div className="top-actions"><button className="secondary signout-button" onClick={() => handleSignOut()}>ออกจากระบบ</button><span className="role-badge">{role === "owner" ? "Owner" : "Tapper"}</span><button className="icon-button" onClick={() => openScreen("notifications")} aria-label="การแจ้งเตือน"><Bell size={20} /></button></div>
    </header>
    {message && <div className={`sync-banner ${connected ? "connected" : "disconnected"}`} role="status"><strong>{connected ? "เชื่อมต่อแล้ว" : "ยังไม่เชื่อมต่อ"}</strong><span>{message}</span><button onClick={() => void refresh()} disabled={loading}>{loading ? "กำลังตรวจสอบ..." : "ลองใหม่"}</button></div>}
    <div className="mobile-context"><div><small>กำลังดูข้อมูล</small><strong>{activeGarden?.name || "ยังไม่มีสวน"}</strong></div><button onClick={() => openScreen("gardens")} aria-label="เปลี่ยนสวน"><Sprout size={18} /></button></div>
    <div className="layout">
      <aside className="sidebar">
        <div className="garden-selector"><small>กำลังดูข้อมูล</small><strong>{activeGarden?.name || "ยังไม่มีสวน"}</strong><span>{activeGarden ? `${activeGarden.areaRai || 0} ไร่ · ${(activeGarden.treeCount || 0).toLocaleString()} ต้น` : "เชื่อมต่อ Apps Script เพื่อเริ่มต้น"}</span></div>
        <nav>{nav.map(([key, label, icon]) => <button key={key} className={screen === key ? "active" : ""} onClick={() => openScreen(key)}>{icon}{label}{key === "sales" && data.pendingReviews > 0 && <em>{data.pendingReviews}</em>}</button>)}</nav>
        <button className="settings"><Settings2 size={18} />ตั้งค่า</button>
      </aside>
      <main className="content">
        <div className="page-heading"><div><p>{new Date().toLocaleDateString("th-TH", { dateStyle: "full" })}</p><h1>{screenTitle(screen)}</h1><span>{role === "owner" ? "ภาพรวมสิทธิในเงิน รายการตรวจสอบ และยอดคงค้าง" : "รายได้ของคุณ เงินเจ้าของที่ถืออยู่ และรายการส่งเงิน"}</span></div><button className="period">เดือนนี้⌄</button></div>
        {message && <div className="notice">{message}</div>}
        {loading && <div className="notice">กำลังโหลดข้อมูลจาก Google Apps Script...</div>}
        {screen === "overview" && <Overview data={data} wallet={wallet} role={role} connected={connected} onSale={() => setShowSaleForm(true)} onReceipt={() => setShowReceiptForm(true)} onSettlement={() => setShowSettlementForm(true)} />}
        {screen === "sales" && <SalesScreen sales={sales} role={role} onSale={() => setShowSaleForm(true)} onRefresh={() => refresh("sales")} />}
        {screen === "gardens" && <GardensScreen gardens={gardens.length ? gardens : activeGarden ? [activeGarden] : []} onCreate={() => setShowGardenForm(true)} />}
        {screen === "agreements" && <AgreementsScreen agreements={agreements} garden={activeGarden} role={role} onCreate={() => setShowAgreementForm(true)} />}
        {screen === "settlements" && <SettlementsScreen settlements={settlements} wallet={wallet} role={role} onCreate={() => setShowSettlementForm(true)} onRefresh={() => refresh("settlements")} />}
        {screen === "reports" && <ReportsScreen garden={activeGarden} />}
        {screen === "notifications" && <NotificationsScreen notifications={notifications} onRead={async (id) => { await api.notifications.read(id); setNotifications((items) => items.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item)); }} />}
      </main>
    </div>
    <DeveloperCredit />
    <nav className="mobile-bottom-nav" aria-label="เมนูหลักบนมือถือ"><button className={screen === "overview" ? "active" : ""} onClick={() => openScreen("overview")}><Leaf size={19} /><span>ภาพรวม</span></button><button className={screen === "sales" ? "active" : ""} onClick={() => openScreen("sales")}><FileText size={19} /><span>รายการ</span>{data.pendingReviews > 0 && <em>{data.pendingReviews}</em>}</button><button className={screen === "settlements" ? "active" : ""} onClick={() => openScreen("settlements")}><WalletCards size={19} /><span>กระเป๋า</span></button><button className={screen === "notifications" ? "active" : ""} onClick={() => openScreen("notifications")}><Bell size={19} /><span>แจ้งเตือน</span></button><button className={screen === "gardens" || screen === "agreements" || screen === "reports" ? "active" : ""} onClick={() => openScreen("gardens")}><Menu size={19} /><span>เพิ่มเติม</span></button></nav>
    {showGardenForm && <GardenForm onClose={() => setShowGardenForm(false)} onSaved={() => { setShowGardenForm(false); void refresh("gardens"); }} />}
    {showSaleForm && <SaleForm garden={activeGarden} agreement={agreements[0]} role={role} onClose={() => setShowSaleForm(false)} onSaved={() => { setShowSaleForm(false); void refresh("sales"); }} />}
    {showReceiptForm && <ReceiptForm garden={activeGarden} agreement={agreements[0]} onClose={() => setShowReceiptForm(false)} onSaved={() => { setShowReceiptForm(false); void refresh("sales"); }} />}
    {showAgreementForm && <AgreementForm garden={activeGarden} onClose={() => setShowAgreementForm(false)} onSaved={() => { setShowAgreementForm(false); void refresh("agreements"); }} />}
    {showSettlementForm && <SettlementForm garden={activeGarden} role={role} onClose={() => setShowSettlementForm(false)} onSaved={() => { setShowSettlementForm(false); void refresh("settlements"); }} />}
  </div>;
}

function screenTitle(screen: Screen) { return ({ overview: "ภาพรวมการแบ่งรายได้", sales: "รายการขายยาง", gardens: "สวนและแปลง", agreements: "ข้อตกลงแบ่งรายได้", settlements: "การส่งเงิน", reports: "รายงาน", notifications: "การแจ้งเตือน" } as Record<Screen, string>)[screen]; }

function DeveloperCredit() {
  return <footer className="developer-credit" aria-label="เครดิตผู้พัฒนา"><span className="developer-credit__label">Developed by <strong>aod</strong></span><a className="developer-credit__link" href="https://www.facebook.com/share/1AWvhjdr44/" target="_blank" rel="noreferrer" aria-label="เปิด Facebook ของ aod"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.6 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.6-1.5h1.7V4a21 21 0 0 0-2.5-.1c-2.5 0-4.2 1.5-4.2 4.2V10H7.5v3h2.7v8h3.4Z" /></svg><span>Facebook</span></a></footer>;
}

function AuthScreen({ clientId, message, onCredential, onError }: { clientId: string; message: string; onCredential: (token: string) => void; onError: (message: string) => void }) {
  return <main className="auth-screen"><section className="auth-card"><div className="brand-mark"><Leaf size={24} /></div><p className="eyebrow">PARAWALLET SECURE ACCESS</p><h1>เข้าสู่ระบบ ParaWallet</h1><p>ใช้บัญชี Google เพื่อยืนยันตัวตน แล้วระบบจะโหลดข้อมูลเฉพาะสวนและสิทธิ์ของคุณจาก Google Sheets</p><GoogleSignIn clientId={clientId} onCredential={onCredential} onError={onError} />{message && <div className="notice">{message}</div>}<small>ระบบจะไม่เรียกใช้ Session.getEffectiveUser และจะไม่เก็บรหัสผ่าน Google</small></section></main>;
}

function Overview({ data, wallet, role, connected, onSale, onReceipt, onSettlement }: { data: DashboardData; wallet: WalletData | null; role: Role; connected: boolean; onSale: () => void; onReceipt: () => void; onSettlement: () => void }) {
  const owner = wallet?.owner.totalEntitlement ?? data.wallet.owner;
  const tapper = wallet?.tapper.totalIncome ?? data.wallet.tapper;
  const outstanding = wallet?.owner.outstanding ?? data.wallet.outstanding;
  const showMoney = (value: number) => connected ? money(value) : "—";
  return <><section className="metrics"><Metric label={role === "owner" ? "สิทธิของเจ้าของสวน" : "รายได้ของฉัน"} value={showMoney(role === "owner" ? owner : tapper)} icon={<WalletCards />} /><Metric label="เงินเจ้าของที่ยังอยู่กับคนกรีด" value={showMoney(outstanding)} icon={<CircleDollarSign />} /><Metric label="ยอดรอตรวจสอบ" value={showMoney(data.wallet.outstanding)} icon={<FileText />} /><Metric label="ขายยางสะสม" value={showMoney(data.monthlySales)} icon={<Sprout />} /></section><section className="hero-grid"><div className="sales-card"><div><small>ยอดขายรวมเดือนนี้</small><strong>{showMoney(data.monthlySales)}</strong><span className="growth">{connected ? "ข้อมูลจาก Apps Script" : "รอเชื่อมต่อฐานข้อมูล"}</span></div><div className="bars">{connected ? [42,58,48,70,62,83,76,94].map((height, i) => <div key={i} style={{ height: `${height}%` }}><span>ส.{i + 1}</span></div>) : <p className="empty-chart">กราฟจะแสดงเมื่อโหลดข้อมูลจริงสำเร็จ</p>}</div></div><div className="wallet-card"><div className="card-title"><span><WalletCards size={20} />กระเป๋าคู่</span><small>สิทธิในเงิน ไม่ใช่เงินฝาก</small></div><WalletLine label="เจ้าของสวน" amount={showMoney(owner)} percent={60} color="green" /><WalletLine label="คนกรีดยาง" amount={showMoney(tapper)} percent={40} color="gold" /><p className="balance">เจ้าของยังรอรับ {showMoney(outstanding)}</p></div></section><section className="quick-actions"><button onClick={onReceipt}><ScanLine size={18} />สแกนใบเสร็จ OCR</button><button onClick={onSale}><FileText size={18} />บันทึกรายการขายเอง</button>{role === "tapper" && <button onClick={onSettlement}><WalletCards size={18} />บันทึกการส่งเงิน</button>}<button onClick={() => window.alert("ใช้เมนูรายงานเพื่อเลือกช่วงวันที่และ export CSV")}>รายงานและส่งออก</button></section></>;
}

function SalesScreen({ sales, role, onSale, onRefresh }: { sales: Sale[]; role: Role; onSale: () => void; onRefresh: () => void }) { return <section className="panel"><div className="panel-head"><div><h2>รายการขายล่าสุด</h2><p>รายการที่อ้างอิงกลับไปยังบิลและ Agreement snapshot</p></div><div className="panel-actions"><button className="secondary" onClick={onRefresh}>รีเฟรช</button><button className="primary" onClick={onSale}><Plus size={16} />เพิ่มรายการ</button></div></div>{sales.length === 0 ? <Empty text="ยังไม่มีรายการขายจากสวนที่เลือก" /> : <div className="data-list">{sales.map((sale) => <article className="data-row" key={sale.id}><div><strong>{sale.buyerName || "ร้านรับซื้อไม่ระบุ"}</strong><span>{sale.saleDate} · {sale.productType || "ยางพารา"} · {sale.netWeight || sale.weightKg || 0} กก.</span></div><div><strong>{money(sale.grossSale || 0)}</strong><span className={`status ${sale.status}`}>{labelStatus(sale.status)}</span></div>{role === "owner" && sale.status === "pending_owner_review" && <div className="panel-actions"><button className="link-button" onClick={async () => { await api.sales.confirm(sale.id); onRefresh(); }}>ยืนยัน</button><button className="link-button" onClick={async () => { const reason = window.prompt("เหตุผลที่คัดค้านรายการ"); if (reason) { await api.sales.dispute({ saleId: sale.id, reason }); onRefresh(); } }}>คัดค้าน</button></div>}{(role === "owner" || role === "tapper") && sale.status === "confirmed" && <div className="panel-actions"><button className="link-button" onClick={async () => { const reason = window.prompt("เหตุผลที่คัดค้านรายการ"); if (reason) { await api.sales.dispute({ saleId: sale.id, reason }); onRefresh(); } }}>คัดค้าน</button>{role === "owner" && <button className="link-button" onClick={async () => { const reason = window.prompt("เหตุผลการปรับยอด"); const amount = Number(window.prompt("จำนวนเงินที่ปรับ", "0") || 0); const type = window.prompt("ประเภท: owner_credit / owner_debit / tapper_credit / tapper_debit", "owner_debit") || "owner_debit"; if (reason && amount > 0) { await api.adjustments.create({ saleId: sale.id, adjustmentType: type, amount, reason }); onRefresh(); } }}>ปรับยอด</button>}</div>}{role === "owner" && sale.status === "disputed" && <div className="panel-actions"><button className="link-button" onClick={async () => { const resolution = window.prompt("ผลการตรวจสอบข้อพิพาท"); if (resolution) { await api.disputes.resolve({ decision: "resolved", resolution, saleId: sale.id }); onRefresh(); } }}>แก้ไขข้อพิพาท</button><button className="link-button" onClick={async () => { const reason = window.prompt("เหตุผลที่ยกข้อพิพาท"); if (reason) { await api.disputes.resolve({ decision: "rejected", resolution: reason, saleId: sale.id }); onRefresh(); } }}>ยกข้อพิพาท</button></div>}</article>)}</div>}</section>; }

function GardensScreen({ gardens, onCreate }: { gardens: Garden[]; onCreate: () => void }) { return <section className="panel"><div className="panel-head"><div><h2>สวนและแปลง</h2><p>จัดการพื้นที่ จำนวนต้นยาง และข้อมูลสวน</p></div><button className="primary" onClick={onCreate}><Plus size={16} />เพิ่มสวน</button></div>{gardens.length === 0 ? <Empty text="ยังไม่มีสวนที่เชื่อมต่อกับบัญชี" /> : <div className="card-grid">{gardens.map((garden) => <div className="info-card" key={garden.id}><span className="eyebrow">ACTIVE GARDEN</span><h3>{garden.name}</h3><p>{garden.province || "ไม่ระบุจังหวัด"} · {garden.district || "ไม่ระบุอำเภอ"}</p><strong>{garden.areaRai || 0} ไร่ · {(garden.treeCount || 0).toLocaleString()} ต้น</strong></div>)}</div>}</section>; }

function AgreementsScreen({ agreements, garden, role, onCreate }: { agreements: Agreement[]; garden?: Garden; role: Role; onCreate: () => void }) { return <section className="panel"><div className="panel-head"><div><h2>ข้อตกลงแบ่งรายได้</h2><p>{garden?.name || "เลือกสวนก่อนสร้างข้อตกลง"} · ทุก version ไม่กระทบรายการย้อนหลัง</p></div>{role === "owner" && <button className="secondary" onClick={onCreate}>สร้าง version ใหม่</button>}</div>{agreements.length === 0 ? <Empty text="ยังไม่มี Agreement ที่ active" /> : <div className="data-list">{agreements.map((agreement) => <article className="data-row" key={agreement.id}><div><strong>Version {agreement.version}</strong><span>มีผล {agreement.effectiveFrom} · {agreement.status}</span></div><div><strong>{agreement.ownerPercentage}/{agreement.tapperPercentage}</strong><span>Owner / Tapper</span></div></article>)}</div>}</section>; }

function SettlementsScreen({ settlements, wallet, role, onCreate, onRefresh }: { settlements: Settlement[]; wallet: WalletData | null; role: Role; onCreate: () => void; onRefresh: () => void }) { return <section className="panel"><div className="panel-head"><div><h2>การส่งเงินและยอดคงค้าง</h2><p>เงินของเจ้าของที่ยังอยู่กับคนกรีด: {money(wallet?.owner.outstanding || 0)}</p></div><div className="panel-actions"><button className="secondary" onClick={onRefresh}>รีเฟรช</button>{role === "tapper" && <button className="primary" onClick={onCreate}><Plus size={16} />บันทึกการส่งเงิน</button>}</div></div>{settlements.length === 0 ? <Empty text="ยังไม่มี settlement ในช่วงนี้" /> : <div className="data-list">{settlements.map((item) => <article className="data-row" key={item.id}><div><strong>{money(item.amount)}</strong><span>{item.method} · {item.transferDate || "ไม่ระบุวันที่"}</span></div><div><span className={`status ${item.status}`}>{labelStatus(item.status)}</span>{role === "owner" && item.status === "pending_owner_confirmation" && <div className="panel-actions"><button className="link-button" onClick={async () => { await api.settlements.confirm(item.id); onRefresh(); }}>ยืนยันรับเงิน</button><button className="link-button" onClick={async () => { const reason = window.prompt("เหตุผลที่ปฏิเสธ"); if (reason) { await api.settlements.reject({ settlementId: item.id, reason }); onRefresh(); } }}>ปฏิเสธ</button></div>}{role === "tapper" && item.status === "pending_owner_confirmation" && <div className="panel-actions"><button className="link-button" onClick={async () => { if (window.confirm("ยกเลิกรายการส่งเงินนี้หรือไม่")) { await api.settlements.cancel(item.id); onRefresh(); } }}>ยกเลิก</button></div>}</div></article>)}</div>}</section>; }

function ReportsScreen({ garden }: { garden?: Garden }) { const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)); const [to, setTo] = useState(dateToday()); const [report, setReport] = useState<{ summary: Record<string, number | string>; rows: Sale[] } | null>(null); const [busy, setBusy] = useState(false); const load = async () => { if (!garden) return; setBusy(true); try { setReport(await api.reports.summary({ gardenId: garden.id, from, to })); } catch { setReport(null); } finally { setBusy(false); } }; const exportCsv = () => { if (!report) return; const lines = [["saleDate","buyerName","grossSale","ownerShare","tapperShare","status"], ...report.rows.map((row) => [row.saleDate, row.buyerName || "", row.grossSale || 0, row.ownerShare || 0, row.tapperShare || 0, row.status])]; const blob = new Blob([lines.map((line) => line.join(",")).join("\n")], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "parawallet-report.csv"; anchor.click(); URL.revokeObjectURL(url); }; return <section className="panel"><div className="panel-head"><div><h2>รายงานตามช่วงเวลา</h2><p>คำนวณจาก Sales และ Settlements บน Apps Script</p></div><button className="secondary" disabled={!report} onClick={exportCsv}>Export CSV</button></div><div className="filters"><label>ตั้งแต่<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>ถึง<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label><button className="primary" onClick={load}>{busy ? "กำลังโหลด..." : "ดูรายงาน"}</button></div>{report ? <div className="report-grid">{[["ยอดขายรวม", money(Number(report.summary.grossSales))], ["ส่วนเจ้าของ", money(Number(report.summary.ownerShare))], ["ส่วนคนกรีด", money(Number(report.summary.tapperShare))], ["ยอดคงค้าง", money(Number(report.summary.outstanding))]].map(([label, value]) => <div className="metric" key={label}><small>{label}</small><strong>{value}</strong></div>)}</div> : <Empty text="เลือกช่วงวันที่เพื่อโหลดรายงาน" />}</section>; }

function NotificationsScreen({ notifications, onRead }: { notifications: Notification[]; onRead: (id: string) => void }) { return <section className="panel"><div className="panel-head"><div><h2>การแจ้งเตือน</h2><p>รายการใหม่ การตรวจสอบ การโต้แย้ง และการรับเงิน</p></div></div>{notifications.length === 0 ? <Empty text="ยังไม่มีการแจ้งเตือน" /> : <div className="data-list">{notifications.map((item) => <article className={`data-row ${item.readAt ? "read" : "unread"}`} key={item.id} onClick={() => onRead(item.id)}><div><strong>{item.title}</strong><span>{item.body}</span></div><span>{new Date(item.createdAt).toLocaleDateString("th-TH")}</span></article>)}</div>}</section>; }

function GardenForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) { const [form, setForm] = useState({ name: "", province: "", district: "", areaRai: "", treeCount: "" }); const [busy, setBusy] = useState(false); const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); try { await api.gardens.create({ name: form.name, province: form.province, district: form.district, areaRai: Number(form.areaRai), treeCount: Number(form.treeCount) }); onSaved(); } finally { setBusy(false); } }; return <Modal title="เพิ่มสวนใหม่" onClose={onClose}><form className="form-grid" onSubmit={submit}><label>ชื่อสวน<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>จังหวัด<input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} /></label><label>อำเภอ<input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></label><label>พื้นที่ (ไร่)<input type="number" min="0" value={form.areaRai} onChange={(e) => setForm({ ...form, areaRai: e.target.value })} /></label><label>จำนวนต้นยาง<input type="number" min="0" value={form.treeCount} onChange={(e) => setForm({ ...form, treeCount: e.target.value })} /></label><button className="primary" disabled={busy}>{busy ? "กำลังบันทึก..." : "บันทึกสวน"}</button></form></Modal>; }

function SaleForm({ garden, agreement, role, onClose, onSaved }: { garden?: Garden; agreement?: Agreement; role: Role; onClose: () => void; onSaved: () => void }) { const [form, setForm] = useState({ saleDate: dateToday(), buyerName: "", productType: "ยางก้อนถ้วย", weightKg: "", unitPrice: "", buyerDeductions: "0", sharedExpenses: "0" }); const [busy, setBusy] = useState(false); const total = Number(form.weightKg || 0) * Number(form.unitPrice || 0); const splitBase = Math.max(0, total - Number(form.buyerDeductions || 0) - Number(form.sharedExpenses || 0)); const owner = splitBase * Number(agreement?.ownerPercentage || 60) / 100; const tapper = splitBase - owner; const submit = async (event: FormEvent) => { event.preventDefault(); if (!garden || !agreement) return; setBusy(true); try { await api.sales.create({ gardenId: garden.id, agreementId: agreement.id, saleDate: form.saleDate, buyerName: form.buyerName, productType: form.productType, weightKg: Number(form.weightKg), unitPrice: Number(form.unitPrice), buyerDeductions: Number(form.buyerDeductions), sharedExpenses: Number(form.sharedExpenses), manualEntry: true }); onSaved(); } finally { setBusy(false); } }; return <Modal title={role === "tapper" ? "บันทึกรายการขาย" : "ทบทวนรายการขาย"} onClose={onClose}><form className="form-grid" onSubmit={submit}><label>วันที่ขาย<input type="date" required value={form.saleDate} onChange={(e) => setForm({ ...form, saleDate: e.target.value })} /></label><label>ร้านรับซื้อ<input value={form.buyerName} onChange={(e) => setForm({ ...form, buyerName: e.target.value })} /></label><label>ประเภทสินค้า<select value={form.productType} onChange={(e) => setForm({ ...form, productType: e.target.value })}><option>น้ำยางสด</option><option>ยางก้อนถ้วย</option><option>ยางแผ่น</option><option>อื่น ๆ</option></select></label><label>น้ำหนัก (กก.)<input type="number" min="0" step="0.01" required value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} /></label><label>ราคา/กก.<input type="number" min="0" step="0.01" required value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} /></label><label>หักหน้าร้าน<input type="number" min="0" step="0.01" value={form.buyerDeductions} onChange={(e) => setForm({ ...form, buyerDeductions: e.target.value })} /></label><label>ค่าใช้จ่ายร่วม<input type="number" min="0" step="0.01" value={form.sharedExpenses} onChange={(e) => setForm({ ...form, sharedExpenses: e.target.value })} /></label><div className="calculation-preview"><span>ฐานแบ่ง {money(splitBase)}</span><strong>Owner {money(owner)} · Tapper {money(tapper)}</strong></div><button className="primary" disabled={busy || !garden || !agreement}>{busy ? "กำลังบันทึก..." : "ยืนยันรายการ"}</button>{!agreement && <small className="form-hint">ต้องมี Agreement ที่ active ก่อนสร้างรายการขาย</small>}</form></Modal>; }

function SettlementForm({ garden, role, onClose, onSaved }: { garden?: Garden; role: Role; onClose: () => void; onSaved: () => void }) { const [form, setForm] = useState({ amount: "", method: "bank_transfer", transferDate: dateToday(), referenceNo: "", bank: "", location: "", note: "" }); const [busy, setBusy] = useState(false); const submit = async (event: FormEvent) => { event.preventDefault(); if (!garden) return; setBusy(true); try { await api.settlements.create({ gardenId: garden.id, amount: Number(form.amount), method: form.method, transferDate: form.transferDate, referenceNo: form.referenceNo, bank: form.bank, location: form.location, note: form.note }); onSaved(); } finally { setBusy(false); } }; return <Modal title={role === "owner" ? "บันทึกการรับเงิน" : "บันทึกการส่งเงิน"} onClose={onClose}><form className="form-grid" onSubmit={submit}><label>จำนวนเงิน<input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label><label>วิธีการ<select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}><option value="bank_transfer">โอนธนาคาร</option><option value="cash">เงินสด</option></select></label><label>วันที่<input type="date" value={form.transferDate} onChange={(e) => setForm({ ...form, transferDate: e.target.value })} /></label>{form.method === "bank_transfer" ? <><label>ธนาคาร<input value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} /></label><label>เลขอ้างอิง<input value={form.referenceNo} onChange={(e) => setForm({ ...form, referenceNo: e.target.value })} /></label></> : <label>สถานที่ส่งมอบ<input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>}<label>หมายเหตุ<textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label><button className="primary" disabled={busy || !garden}>{busy ? "กำลังบันทึก..." : "ส่งรายการรอยืนยัน"}</button></form></Modal>; }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="modal-backdrop" role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="ปิด"><X size={18} /></button></div>{children}</div></div>; }
function Empty({ text }: { text: string }) { return <div className="empty-state"><Leaf size={28} /><strong>{text}</strong><span>เมื่อเชื่อมต่อข้อมูลจริง รายการจะแสดงที่หน้านี้</span></div>; }
function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <div className="metric"><div><small>{label}</small><strong>{value}</strong><span>ข้อมูลล่าสุด</span></div><i>{icon}</i></div>; }
function WalletLine({ label, amount, percent, color }: { label: string; amount: string; percent: number; color: string }) { return <div className="wallet-line"><div><span><b className={color} />{label}</span><strong>{amount}</strong></div><div className="progress"><i className={color} style={{ width: `${percent}%` }} /></div></div>; }
function labelStatus(status: string) { return ({ pending_owner_review: "รอตรวจ", confirmed: "ยืนยันแล้ว", disputed: "โต้แย้ง", pending_owner_confirmation: "รอเจ้าของยืนยัน", rejected: "ปฏิเสธ", cancelled: "ยกเลิก", partially_confirmed: "ยืนยันบางส่วน" } as Record<string, string>)[status] || status; }


function ReceiptForm({ garden, agreement, onClose, onSaved }: { garden?: Garden; agreement?: Agreement; onClose: () => void; onSaved: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({ saleDate: dateToday(), buyerName: "", productType: "", weightKg: "", unitPrice: "", grossSale: "", buyerDeductions: "0" });
  const [receiptFileId, setReceiptFileId] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [status, setStatus] = useState("upload");
  const [duplicate, setDuplicate] = useState<{ possibleDuplicate: boolean; matches?: Sale[] }>({ possibleDuplicate: false });
  const [busy, setBusy] = useState(false);
  const handleFile = async (selected: File | null) => {
    if (!selected) return;
    setFile(selected);
    setBusy(true);
    try {
      const data = await readFileAsDataUrl_(selected);
      const result = await api.receipts.extract({ data, mimeType: selected.type, filename: selected.name });
      const extracted = (result as { ocr?: { fields?: Record<string, unknown>; confidence?: number; score?: number; needsReview?: boolean; reviewLevel?: string }; file?: { fileId?: string } }).ocr;
      const next = extracted?.fields || {};
      setFields((current) => ({ ...current, ...Object.fromEntries(Object.entries(next).map(([key, value]) => [key, String(value ?? "")])) }));
      setReceiptFileId(String((result as { file?: { fileId?: string } }).file?.fileId || ""));
      setConfidence(Number(extracted?.score !== undefined ? Number(extracted.score) / 100 : extracted?.confidence || 0));
      setStatus(extracted?.reviewLevel === "mandatory" || extracted?.needsReview ? "needs_review" : "ready");
    } catch (error) {
      setStatus("error");
    } finally {
      setBusy(false);
    }
  };
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
      if (duplicateResult?.possibleDuplicate && status !== "confirmed_duplicate") { setStatus("duplicate"); return; }
      await api.sales.create({ gardenId: garden.id, agreementId: agreement.id, saleDate: fields.saleDate, buyerName: fields.buyerName, productType: fields.productType, weightKg: Number(fields.weightKg || 0), unitPrice: Number(fields.unitPrice || 0), buyerDeductions: Number(fields.buyerDeductions || 0), receiptFileId: receiptFileId, ocrConfidence: confidence || 0, manualEntry: false });
      onSaved();
    } finally { setBusy(false); }
  };
  const setField = (key: string, value: string) => setFields((current) => ({ ...current, [key]: value }));
  return <Modal title="สแกนบิลและตรวจสอบ OCR" onClose={onClose}><div className="form-grid"><label>รูปบิล<input type="file" accept="image/*" capture="environment" onChange={(event) => void handleFile(event.target.files?.[0] || null)} /></label>{file && <div className="calculation-preview"><span>ไฟล์: {file.name}</span><strong>{busy ? "กำลังอ่าน OCR..." : `สถานะ ${status}`}</strong></div>}<label>วันที่ขาย<input type="date" value={fields.saleDate} onChange={(e) => setField("saleDate", e.target.value)} /></label><label>ร้านรับซื้อ<input value={fields.buyerName} onChange={(e) => setField("buyerName", e.target.value)} /></label><label>ประเภทสินค้า<input value={fields.productType} onChange={(e) => setField("productType", e.target.value)} /></label><label>น้ำหนักสุทธิ (กก.)<input type="number" step="0.01" value={fields.weightKg} onChange={(e) => setField("weightKg", e.target.value)} /></label><label>ราคา/กก.<input type="number" step="0.01" value={fields.unitPrice} onChange={(e) => setField("unitPrice", e.target.value)} /></label><label>ยอดก่อนหัก<input type="number" step="0.01" value={fields.grossSale} onChange={(e) => setField("grossSale", e.target.value)} /></label><label>รายการหัก<input type="number" step="0.01" value={fields.buyerDeductions} onChange={(e) => setField("buyerDeductions", e.target.value)} /></label>{confidence !== null && <div className={`calculation-preview ${confidence < 0.9 ? "low-confidence" : ""}`}><span>OCR validation score: {(confidence * 100).toFixed(0)}%</span><strong>{confidence < 0.8 ? "ต้องตรวจสอบข้อมูลก่อนสร้างรายการ" : confidence < 0.9 ? "แนะนำให้ตรวจสอบข้อมูลที่อ่านได้" : "คะแนนสูง แต่ควรตรวจสอบก่อนยืนยัน"}</strong></div>}{duplicate.possibleDuplicate && <div className="calculation-preview low-confidence"><span>พบรายการที่อาจซ้ำ {duplicate.matches?.length || 0} รายการ</span><strong>ตรวจสอบก่อนกดยืนยันอีกครั้ง</strong></div>}<button className="secondary" onClick={() => void checkDuplicate()} disabled={!garden || busy}>ตรวจรายการซ้ำ</button><button className="primary" onClick={() => void submit()} disabled={!garden || !agreement || busy || !fields.saleDate}>{status === "duplicate" ? "ยืนยันว่าเป็นบิลคนละรายการ" : busy ? "กำลังบันทึก..." : "ยืนยันข้อมูลและสร้างรายการ"}</button>{!agreement && <small className="form-hint">ต้องมี Agreement ที่ active ก่อนสร้างรายการขาย</small>}</div></Modal>;
}

function readFileAsDataUrl_(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "")); reader.onerror = reject; reader.readAsDataURL(file); }); }


function AgreementForm({ garden, onClose, onSaved }: { garden?: Garden; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ tapperId: "", ownerPercentage: "60", tapperPercentage: "40", effectiveFrom: dateToday() });
  const [busy, setBusy] = useState(false);
  const total = Number(form.ownerPercentage || 0) + Number(form.tapperPercentage || 0);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!garden || total !== 100) return; setBusy(true); try { await api.agreements.create({ gardenId: garden.id, tapperId: form.tapperId, ownerPercentage: Number(form.ownerPercentage), tapperPercentage: Number(form.tapperPercentage), effectiveFrom: form.effectiveFrom }); onSaved(); } finally { setBusy(false); } };
  return <Modal title="สร้างข้อตกลงแบ่งรายได้" onClose={onClose}><form className="form-grid" onSubmit={submit}><label>Tapper ID<input required value={form.tapperId} onChange={(e) => setForm({ ...form, tapperId: e.target.value })} placeholder="รหัสผู้กรีดจาก Users" /></label><label>เริ่มมีผลวันที่<input required type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} /></label><label>สัดส่วน Owner (%)<input type="number" min="0" max="100" value={form.ownerPercentage} onChange={(e) => setForm({ ...form, ownerPercentage: e.target.value })} /></label><label>สัดส่วน Tapper (%)<input type="number" min="0" max="100" value={form.tapperPercentage} onChange={(e) => setForm({ ...form, tapperPercentage: e.target.value })} /></label><div className="calculation-preview"><span>รวมสัดส่วน</span><strong className={total === 100 ? "" : "form-hint"}>{total}% {total === 100 ? "พร้อมบันทึก" : "ต้องรวมให้ได้ 100%"}</strong></div><button className="primary" disabled={busy || !garden || total !== 100}>{busy ? "กำลังบันทึก..." : "สร้าง Agreement version"}</button></form></Modal>;
}
