import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, Agreement, DashboardData, Garden, Notification, Role, Sale, Settlement, WalletData } from "./api";
import { Bell, CircleDollarSign, FileText, Leaf, Menu, Plus, ScanLine, Settings2, Sprout, WalletCards, X } from "lucide-react";

type Screen = "overview" | "sales" | "gardens" | "agreements" | "settlements" | "reports" | "notifications";

const fallback: DashboardData = { role: "owner", garden: { id: "demo-garden", name: "สวนเขาแก้ว", province: "สงขลา", district: "หาดใหญ่", areaRai: 18, treeCount: 2460, status: "active" }, wallet: { owner: 18420, tapper: 12280, outstanding: 5643, currency: "THB" }, pendingReviews: 3, monthlySales: 30420 };
const money = (value: number) => `฿${Number(value || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;
const dateToday = () => new Date().toISOString().slice(0, 10);

export default function App() {
  const [role, setRole] = useState<Role>("owner");
  const [screen, setScreen] = useState<Screen>("overview");
  const [data, setData] = useState<DashboardData>(fallback);
  const [gardens, setGardens] = useState<Garden[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showGardenForm, setShowGardenForm] = useState(false);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [showSettlementForm, setShowSettlementForm] = useState(false);
  const activeGarden = data.garden || gardens[0];

  const refresh = async (target: Screen = screen) => {
    setLoading(true);
    setMessage("");
    try {
      const dashboard = await api.dashboard();
      setData(dashboard);
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
      setMessage(error instanceof Error ? error.message : "ยังเชื่อมต่อ Apps Script ไม่ได้ จึงแสดงข้อมูลตัวอย่าง");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh("overview"); }, []);

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

  return <div className="app-shell">
    <header className="topbar">
      <button className="icon-button mobile-only" aria-label="เปิดเมนู"><Menu size={21} /></button>
      <div className="brand"><span className="brand-mark"><Leaf size={22} /></span><span><b>ParaWallet</b><small>DUAL WALLET SYSTEM</small></span></div>
      <div className="top-actions"><div className="role-switch"><button className={role === "owner" ? "selected" : ""} onClick={() => setRole("owner")}>Owner</button><button className={role === "tapper" ? "selected" : ""} onClick={() => setRole("tapper")}>Tapper</button></div><button className="icon-button" onClick={() => openScreen("notifications")} aria-label="การแจ้งเตือน"><Bell size={20} /></button></div>
    </header>
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
        {screen === "overview" && <Overview data={data} wallet={wallet} role={role} onSale={() => setShowSaleForm(true)} onSettlement={() => setShowSettlementForm(true)} />}
        {screen === "sales" && <SalesScreen sales={sales} role={role} onSale={() => setShowSaleForm(true)} onRefresh={() => refresh("sales")} />}
        {screen === "gardens" && <GardensScreen gardens={gardens.length ? gardens : activeGarden ? [activeGarden] : []} onCreate={() => setShowGardenForm(true)} />}
        {screen === "agreements" && <AgreementsScreen agreements={agreements} garden={activeGarden} role={role} />}
        {screen === "settlements" && <SettlementsScreen settlements={settlements} wallet={wallet} role={role} onCreate={() => setShowSettlementForm(true)} />}
        {screen === "reports" && <ReportsScreen garden={activeGarden} />}
        {screen === "notifications" && <NotificationsScreen notifications={notifications} onRead={async (id) => { await api.notifications.read(id); setNotifications((items) => items.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item)); }} />}
      </main>
    </div>
    {showGardenForm && <GardenForm onClose={() => setShowGardenForm(false)} onSaved={() => { setShowGardenForm(false); void refresh("gardens"); }} />}
    {showSaleForm && <SaleForm garden={activeGarden} agreement={agreements[0]} role={role} onClose={() => setShowSaleForm(false)} onSaved={() => { setShowSaleForm(false); void refresh("sales"); }} />}
    {showSettlementForm && <SettlementForm garden={activeGarden} role={role} onClose={() => setShowSettlementForm(false)} onSaved={() => { setShowSettlementForm(false); void refresh("settlements"); }} />}
  </div>;
}

function screenTitle(screen: Screen) { return ({ overview: "ภาพรวมการแบ่งรายได้", sales: "รายการขายยาง", gardens: "สวนและแปลง", agreements: "ข้อตกลงแบ่งรายได้", settlements: "การส่งเงิน", reports: "รายงาน", notifications: "การแจ้งเตือน" } as Record<Screen, string>)[screen]; }

function Overview({ data, wallet, role, onSale, onSettlement }: { data: DashboardData; wallet: WalletData | null; role: Role; onSale: () => void; onSettlement: () => void }) {
  const owner = wallet?.owner.totalEntitlement ?? data.wallet.owner;
  const tapper = wallet?.tapper.totalIncome ?? data.wallet.tapper;
  const outstanding = wallet?.owner.outstanding ?? data.wallet.outstanding;
  return <><section className="metrics"><Metric label={role === "owner" ? "สิทธิของเจ้าของสวน" : "รายได้ของฉัน"} value={money(role === "owner" ? owner : tapper)} icon={<WalletCards />} /><Metric label="เงินเจ้าของที่ยังอยู่กับคนกรีด" value={money(outstanding)} icon={<CircleDollarSign />} /><Metric label="ยอดรอตรวจสอบ" value={money(data.wallet.outstanding)} icon={<FileText />} /><Metric label="ขายยางสะสม" value={money(data.monthlySales)} icon={<Sprout />} /></section><section className="hero-grid"><div className="sales-card"><div><small>ยอดขายรวมเดือนนี้</small><strong>{money(data.monthlySales)}</strong><span className="growth">Dual ledger <i>ข้อมูลจาก Apps Script</i></span></div><div className="bars">{[42,58,48,70,62,83,76,94].map((height, i) => <div key={i} style={{ height: `${height}%` }}><span>ส.{i + 1}</span></div>)}</div></div><div className="wallet-card"><div className="card-title"><span><WalletCards size={20} />กระเป๋าคู่</span><small>สิทธิในเงิน ไม่ใช่เงินฝาก</small></div><WalletLine label="เจ้าของสวน" amount={money(owner)} percent={60} color="green" /><WalletLine label="คนกรีดยาง" amount={money(tapper)} percent={40} color="gold" /><p className="balance">เจ้าของยังรอรับ {money(outstanding)}</p></div></section><section className="quick-actions"><button onClick={onSale}><ScanLine size={18} />สแกน/บันทึกรายการขาย</button><button onClick={onSettlement}><WalletCards size={18} />บันทึกการส่งเงิน</button><button onClick={() => window.alert("ใช้เมนูรายงานเพื่อเลือกช่วงวันที่และ export CSV")}>รายงานและส่งออก</button></section></>;
}

function SalesScreen({ sales, role, onSale, onRefresh }: { sales: Sale[]; role: Role; onSale: () => void; onRefresh: () => void }) { return <section className="panel"><div className="panel-head"><div><h2>รายการขายล่าสุด</h2><p>รายการที่อ้างอิงกลับไปยังบิลและ Agreement snapshot</p></div><div className="panel-actions"><button className="secondary" onClick={onRefresh}>รีเฟรช</button><button className="primary" onClick={onSale}><Plus size={16} />เพิ่มรายการ</button></div></div>{sales.length === 0 ? <Empty text="ยังไม่มีรายการขายจากสวนที่เลือก" /> : <div className="data-list">{sales.map((sale) => <article className="data-row" key={sale.id}><div><strong>{sale.buyerName || "ร้านรับซื้อไม่ระบุ"}</strong><span>{sale.saleDate} · {sale.productType || "ยางพารา"} · {sale.netWeight || sale.weightKg || 0} กก.</span></div><div><strong>{money(sale.grossSale || 0)}</strong><span className={`status ${sale.status}`}>{labelStatus(sale.status)}</span></div>{role === "owner" && sale.status === "pending_owner_review" && <button className="link-button" onClick={() => window.alert("เปิดหน้ารายละเอียดเพื่อยืนยันหรือคัดค้านรายการ")}>ตรวจสอบ</button>}</article>)}</div>}</section>; }

function GardensScreen({ gardens, onCreate }: { gardens: Garden[]; onCreate: () => void }) { return <section className="panel"><div className="panel-head"><div><h2>สวนและแปลง</h2><p>จัดการพื้นที่ จำนวนต้นยาง และข้อมูลสวน</p></div><button className="primary" onClick={onCreate}><Plus size={16} />เพิ่มสวน</button></div>{gardens.length === 0 ? <Empty text="ยังไม่มีสวนที่เชื่อมต่อกับบัญชี" /> : <div className="card-grid">{gardens.map((garden) => <div className="info-card" key={garden.id}><span className="eyebrow">ACTIVE GARDEN</span><h3>{garden.name}</h3><p>{garden.province || "ไม่ระบุจังหวัด"} · {garden.district || "ไม่ระบุอำเภอ"}</p><strong>{garden.areaRai || 0} ไร่ · {(garden.treeCount || 0).toLocaleString()} ต้น</strong></div>)}</div>}</section>; }

function AgreementsScreen({ agreements, garden, role }: { agreements: Agreement[]; garden?: Garden; role: Role }) { return <section className="panel"><div className="panel-head"><div><h2>ข้อตกลงแบ่งรายได้</h2><p>{garden?.name || "เลือกสวนก่อนสร้างข้อตกลง"} · ทุก version ไม่กระทบรายการย้อนหลัง</p></div>{role === "owner" && <button className="secondary" onClick={() => window.alert("แบบฟอร์มสร้าง Agreement จะเชื่อมกับ Apps Script เมื่อมี Tapper ID")}>สร้าง version ใหม่</button>}</div>{agreements.length === 0 ? <Empty text="ยังไม่มี Agreement ที่ active" /> : <div className="data-list">{agreements.map((agreement) => <article className="data-row" key={agreement.id}><div><strong>Version {agreement.version}</strong><span>มีผล {agreement.effectiveFrom} · {agreement.status}</span></div><div><strong>{agreement.ownerPercentage}/{agreement.tapperPercentage}</strong><span>Owner / Tapper</span></div></article>)}</div>}</section>; }

function SettlementsScreen({ settlements, wallet, role, onCreate }: { settlements: Settlement[]; wallet: WalletData | null; role: Role; onCreate: () => void }) { return <section className="panel"><div className="panel-head"><div><h2>การส่งเงินและยอดคงค้าง</h2><p>เงินของเจ้าของที่ยังอยู่กับคนกรีด: {money(wallet?.owner.outstanding || 0)}</p></div><button className="primary" onClick={onCreate}><Plus size={16} />บันทึกการส่งเงิน</button></div>{settlements.length === 0 ? <Empty text="ยังไม่มี settlement ในช่วงนี้" /> : <div className="data-list">{settlements.map((item) => <article className="data-row" key={item.id}><div><strong>{money(item.amount)}</strong><span>{item.method} · {item.transferDate || "ไม่ระบุวันที่"}</span></div><span className={`status ${item.status}`}>{labelStatus(item.status)}</span></article>)}</div>}</section>; }

function ReportsScreen({ garden }: { garden?: Garden }) { const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)); const [to, setTo] = useState(dateToday()); const [report, setReport] = useState<{ summary: Record<string, number | string>; rows: Sale[] } | null>(null); const [busy, setBusy] = useState(false); const load = async () => { if (!garden) return; setBusy(true); try { setReport(await api.reports.summary({ gardenId: garden.id, from, to })); } catch { setReport(null); } finally { setBusy(false); } }; const exportCsv = () => { if (!report) return; const lines = [["saleDate","buyerName","grossSale","ownerShare","tapperShare","status"], ...report.rows.map((row) => [row.saleDate, row.buyerName || "", row.grossSale || 0, row.ownerShare || 0, row.tapperShare || 0, row.status])]; const blob = new Blob([lines.map((line) => line.join(",")).join("\n")], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "parawallet-report.csv"; anchor.click(); URL.revokeObjectURL(url); }; return <section className="panel"><div className="panel-head"><div><h2>รายงานตามช่วงเวลา</h2><p>คำนวณจาก Sales และ Settlements บน Apps Script</p></div><button className="secondary" disabled={!report} onClick={exportCsv}>Export CSV</button></div><div className="filters"><label>ตั้งแต่<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>ถึง<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label><button className="primary" onClick={load}>{busy ? "กำลังโหลด..." : "ดูรายงาน"}</button></div>{report ? <div className="report-grid">{[["ยอดขายรวม", money(Number(report.summary.grossSales))], ["ส่วนเจ้าของ", money(Number(report.summary.ownerShare))], ["ส่วนคนกรีด", money(Number(report.summary.tapperShare))], ["ยอดคงค้าง", money(Number(report.summary.outstanding))]].map(([label, value]) => <div className="metric" key={label}><small>{label}</small><strong>{value}</strong></div>)}</div> : <Empty text="เลือกช่วงวันที่เพื่อโหลดรายงาน" />}</section>; }

function NotificationsScreen({ notifications, onRead }: { notifications: Notification[]; onRead: (id: string) => void }) { return <section className="panel"><div className="panel-head"><div><h2>การแจ้งเตือน</h2><p>รายการใหม่ การตรวจสอบ การโต้แย้ง และการรับเงิน</p></div></div>{notifications.length === 0 ? <Empty text="ยังไม่มีการแจ้งเตือน" /> : <div className="data-list">{notifications.map((item) => <article className={`data-row ${item.readAt ? "read" : "unread"}`} key={item.id} onClick={() => onRead(item.id)}><div><strong>{item.title}</strong><span>{item.body}</span></div><span>{new Date(item.createdAt).toLocaleDateString("th-TH")}</span></article>)}</div>}</section>; }

function GardenForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) { const [form, setForm] = useState({ name: "", province: "", district: "", areaRai: "", treeCount: "" }); const [busy, setBusy] = useState(false); const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); try { await api.gardens.create({ name: form.name, province: form.province, district: form.district, areaRai: Number(form.areaRai), treeCount: Number(form.treeCount) }); onSaved(); } finally { setBusy(false); } }; return <Modal title="เพิ่มสวนใหม่" onClose={onClose}><form className="form-grid" onSubmit={submit}><label>ชื่อสวน<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>จังหวัด<input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} /></label><label>อำเภอ<input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></label><label>พื้นที่ (ไร่)<input type="number" min="0" value={form.areaRai} onChange={(e) => setForm({ ...form, areaRai: e.target.value })} /></label><label>จำนวนต้นยาง<input type="number" min="0" value={form.treeCount} onChange={(e) => setForm({ ...form, treeCount: e.target.value })} /></label><button className="primary" disabled={busy}>{busy ? "กำลังบันทึก..." : "บันทึกสวน"}</button></form></Modal>; }

function SaleForm({ garden, agreement, role, onClose, onSaved }: { garden?: Garden; agreement?: Agreement; role: Role; onClose: () => void; onSaved: () => void }) { const [form, setForm] = useState({ saleDate: dateToday(), buyerName: "", productType: "ยางก้อนถ้วย", weightKg: "", unitPrice: "", buyerDeductions: "0", sharedExpenses: "0" }); const [busy, setBusy] = useState(false); const total = Number(form.weightKg || 0) * Number(form.unitPrice || 0); const splitBase = Math.max(0, total - Number(form.buyerDeductions || 0) - Number(form.sharedExpenses || 0)); const owner = splitBase * Number(agreement?.ownerPercentage || 60) / 100; const tapper = splitBase - owner; const submit = async (event: FormEvent) => { event.preventDefault(); if (!garden || !agreement) return; setBusy(true); try { await api.sales.create({ gardenId: garden.id, agreementId: agreement.id, saleDate: form.saleDate, buyerName: form.buyerName, productType: form.productType, weightKg: Number(form.weightKg), unitPrice: Number(form.unitPrice), buyerDeductions: Number(form.buyerDeductions), sharedExpenses: Number(form.sharedExpenses), manualEntry: true }); onSaved(); } finally { setBusy(false); } }; return <Modal title={role === "tapper" ? "บันทึกรายการขาย" : "ทบทวนรายการขาย"} onClose={onClose}><form className="form-grid" onSubmit={submit}><label>วันที่ขาย<input type="date" required value={form.saleDate} onChange={(e) => setForm({ ...form, saleDate: e.target.value })} /></label><label>ร้านรับซื้อ<input value={form.buyerName} onChange={(e) => setForm({ ...form, buyerName: e.target.value })} /></label><label>ประเภทสินค้า<select value={form.productType} onChange={(e) => setForm({ ...form, productType: e.target.value })}><option>น้ำยางสด</option><option>ยางก้อนถ้วย</option><option>ยางแผ่น</option><option>อื่น ๆ</option></select></label><label>น้ำหนัก (กก.)<input type="number" min="0" step="0.01" required value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} /></label><label>ราคา/กก.<input type="number" min="0" step="0.01" required value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} /></label><label>หักหน้าร้าน<input type="number" min="0" step="0.01" value={form.buyerDeductions} onChange={(e) => setForm({ ...form, buyerDeductions: e.target.value })} /></label><label>ค่าใช้จ่ายร่วม<input type="number" min="0" step="0.01" value={form.sharedExpenses} onChange={(e) => setForm({ ...form, sharedExpenses: e.target.value })} /></label><div className="calculation-preview"><span>ฐานแบ่ง {money(splitBase)}</span><strong>Owner {money(owner)} · Tapper {money(tapper)}</strong></div><button className="primary" disabled={busy || !garden || !agreement}>{busy ? "กำลังบันทึก..." : "ยืนยันรายการ"}</button>{!agreement && <small className="form-hint">ต้องมี Agreement ที่ active ก่อนสร้างรายการขาย</small>}</form></Modal>; }

function SettlementForm({ garden, role, onClose, onSaved }: { garden?: Garden; role: Role; onClose: () => void; onSaved: () => void }) { const [form, setForm] = useState({ amount: "", method: "bank_transfer", transferDate: dateToday(), referenceNo: "", bank: "", location: "", note: "" }); const [busy, setBusy] = useState(false); const submit = async (event: FormEvent) => { event.preventDefault(); if (!garden) return; setBusy(true); try { await api.settlements.create({ gardenId: garden.id, amount: Number(form.amount), method: form.method, transferDate: form.transferDate, referenceNo: form.referenceNo, bank: form.bank, location: form.location, note: form.note }); onSaved(); } finally { setBusy(false); } }; return <Modal title={role === "owner" ? "บันทึกการรับเงิน" : "บันทึกการส่งเงิน"} onClose={onClose}><form className="form-grid" onSubmit={submit}><label>จำนวนเงิน<input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label><label>วิธีการ<select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}><option value="bank_transfer">โอนธนาคาร</option><option value="cash">เงินสด</option></select></label><label>วันที่<input type="date" value={form.transferDate} onChange={(e) => setForm({ ...form, transferDate: e.target.value })} /></label>{form.method === "bank_transfer" ? <><label>ธนาคาร<input value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} /></label><label>เลขอ้างอิง<input value={form.referenceNo} onChange={(e) => setForm({ ...form, referenceNo: e.target.value })} /></label></> : <label>สถานที่ส่งมอบ<input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>}<label>หมายเหตุ<textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label><button className="primary" disabled={busy || !garden}>{busy ? "กำลังบันทึก..." : "ส่งรายการรอยืนยัน"}</button></form></Modal>; }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="modal-backdrop" role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="ปิด"><X size={18} /></button></div>{children}</div></div>; }
function Empty({ text }: { text: string }) { return <div className="empty-state"><Leaf size={28} /><strong>{text}</strong><span>เมื่อเชื่อมต่อข้อมูลจริง รายการจะแสดงที่หน้านี้</span></div>; }
function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <div className="metric"><div><small>{label}</small><strong>{value}</strong><span>ข้อมูลล่าสุด</span></div><i>{icon}</i></div>; }
function WalletLine({ label, amount, percent, color }: { label: string; amount: string; percent: number; color: string }) { return <div className="wallet-line"><div><span><b className={color} />{label}</span><strong>{amount}</strong></div><div className="progress"><i className={color} style={{ width: `${percent}%` }} /></div></div>; }
function labelStatus(status: string) { return ({ pending_owner_review: "รอตรวจ", confirmed: "ยืนยันแล้ว", disputed: "โต้แย้ง", pending_owner_confirmation: "รอเจ้าของยืนยัน", partially_confirmed: "ยืนยันบางส่วน" } as Record<string, string>)[status] || status; }
