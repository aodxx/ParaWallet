export type Role = "owner" | "tapper";
export type RequestStatus = "ok" | "error";

export type ApiRequest<T> = {
  action: string;
  requestId: string;
  payload?: T;
  authToken?: string;
};

export type ApiResponse<T> = {
  status: RequestStatus;
  requestId: string;
  data?: T;
  error?: { code: string; message: string; details?: unknown; retryable?: boolean };
};

export class ApiError extends Error {
  code: string;
  retryable: boolean;
  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.retryable = retryable;
  }
}

const apiErrorMessages: Record<string, string> = {
  TRANSACTION_BUSY: "ระบบกำลังประมวลผลข้อมูล กรุณาลองอีกครั้งในอีกสักครู่",
  API_ERROR: "เชื่อมต่อระบบข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง",
  REQUEST_ID_REQUIRED: "คำขอไม่สมบูรณ์ กรุณาลองใหม่",
  SETTLEMENT_SLIP_REQUIRED: "กรุณาแนบสลิปการโอนเงิน",
  SETTLEMENT_SLIP_TOO_LARGE: "ไฟล์สลิปมีขนาดใหญ่เกินไป กรุณาเลือกไฟล์ไม่เกิน 4 MB",
  CASH_LOCATION_REQUIRED: "กรุณาระบุสถานที่ส่งมอบเงินสด",
  MEMBER_EMAIL_REQUIRED: "กรุณากรอกอีเมล Google ของ Tapper",
  TAPPER_USER_NOT_REGISTERED: "ยังไม่พบบัญชี Tapper ที่ active ใน Users กรุณาลงทะเบียนบัญชีก่อน",
  MEMBER_ROLE_INVALID: "บัญชีนี้ไม่ได้ลงทะเบียนด้วยบทบาท Tapper",
  MEMBER_HAS_ACTIVE_AGREEMENT: "ยังถอด Tapper ไม่ได้ เพราะมีข้อตกลงที่กำลังใช้งาน",
  MEMBER_HAS_OPEN_ITEMS: "ยังถอด Tapper ไม่ได้ เพราะมีรายการขายหรือรายการส่งเงินรอดำเนินการ",
  MEMBER_HAS_OUTSTANDING_BALANCE: "ยังถอด Tapper ไม่ได้ เพราะยังมีเงินของ Owner คงค้างอยู่",
  OWNER_MEMBER_CANNOT_BE_REMOVED: "ไม่สามารถถอด Owner ออกจากสวนของตนเองได้",
  RECEIPT_IMAGE_REQUIRED: "กรุณาถ่ายหรือเลือกภาพใบเสร็จ",
  RECEIPT_IMAGE_TYPE_INVALID: "รองรับเฉพาะไฟล์ภาพใบเสร็จ",
  RECEIPT_IMAGE_TOO_LARGE: "ภาพใบเสร็จมีขนาดใหญ่เกินไป กรุณาเลือกไฟล์ไม่เกิน 4 MB",
  SALE_RECEIPT_REQUIRED: "รายการจากการสแกนต้องมีหลักฐานใบเสร็จ",
  SALE_RECEIPT_ACCESS_DENIED: "ไม่สามารถใช้ใบเสร็จที่ไม่ได้สร้างจากบัญชี Tapper นี้",
  SALE_RECEIPT_NOT_FOUND: "ไม่พบไฟล์ใบเสร็จของรายการนี้",
  SALE_RECEIPT_MISMATCH: "ข้อมูลใบเสร็จกับรายการขายไม่ตรงกัน กรุณาตรวจสอบใหม่",
};

export function userMessageForApiError(error: unknown) {
  if (error instanceof ApiError) return apiErrorMessages[error.code] || "ไม่สามารถโหลดข้อมูลได้ กรุณาลองอีกครั้ง";
  return "ยังเชื่อมต่อ Google Sheets ไม่ได้ กรุณาลองอีกครั้ง";
}

export type Garden = { id: string; ownerId?: string; name: string; locationText?: string; province?: string; district?: string; areaRai: number; treeCount: number; status: "active" | "archived" };
export type Plot = { id: string; gardenId: string; name: string; notes?: string; status: string };
export type GardenMember = { id: string; gardenId: string; userId: string; role: "owner" | "tapper"; status: "active" | "inactive"; name?: string; email?: string; createdAt?: string };
export type Agreement = { id: string; gardenId: string; ownerId: string; tapperId: string; version: number; ownerPercentage: number; tapperPercentage: number; effectiveFrom: string; effectiveTo?: string; status: string };
export type Sale = { id: string; gardenId: string; agreementId: string; tapperId?: string; receiptId?: string; saleDate: string; ticketNumber?: string; buyerName?: string; productType?: string; weightKg?: number; netWeight?: number; unitPrice?: number; grossSale?: number; buyerDeductions?: number; sharedExpenses?: number; splitBase?: number; ownerShare?: number; tapperShare?: number; status: string; receiptFileId?: string; ocrConfidence?: number | string; manualEntry?: boolean; createdAt?: string };
export type SaleReceiptEvidence = { saleId: string; receiptId?: string; fileId: string; name: string; mimeType: string; dataUrl: string };
export type Settlement = { id: string; gardenId: string; amount: number; method: string; status: string; transferDate?: string; referenceNo?: string; bank?: string; slipFileId?: string; location?: string; note?: string };
export type Notification = { id: string; userId: string; type: string; title: string; body: string; readAt?: string; createdAt: string };
export type WalletSummary = { owner: number; tapper: number; outstanding: number; currency: "THB" };
export type DashboardData = { role: Role; garden?: Garden; wallet: WalletSummary; pendingReviews: number; monthlySales: number; monthlySalesSeries?: number[] };
export type WalletData = { gardenId: string; role: Role; owner: { totalEntitlement: number; totalReceived: number; outstanding: number; pending: number; disputed: number }; tapper: { totalIncome: number; ownerMoneyHeld: number; ownerMoneyTransferred: number; pendingReviews: number } };
export type ReportData = { summary: { from: string; to: string; salesCount: number; confirmedSales: number; grossSales: number; ownerShare: number; tapperShare: number; deductions: number; settlements: number; outstanding: number }; rows: Sale[] };

const apiUrl = (import.meta.env.VITE_APPS_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbwiW2tuD_RQUgygjZz-jIEfCLe03s6kdXXyz2Z2ZG8mUDwjvfA_luGrl4SpZ253UeH3/exec").replace(/\/$/, "");
let currentAuthToken = "";
let authFailureHandler: (() => void) | undefined;
export function setAuthToken(token: string) { currentAuthToken = token; }
export function onAuthFailure(handler: () => void) { authFailureHandler = handler; }
export function getAuthToken() { return currentAuthToken; }

export function newRequestId() {
  return `${Date.now()}-${crypto.randomUUID()}`;
}

export async function callApi<TPayload, TResult>(action: string, payload?: TPayload, options: { signal?: AbortSignal; authToken?: string; requestId?: string } = {}): Promise<TResult> {
  if (!apiUrl) throw new Error("VITE_APPS_SCRIPT_URL is not configured");
  const requestId = options.requestId ?? newRequestId();
  const body: ApiRequest<TPayload> = { action, requestId, payload, authToken: options.authToken ?? currentAuthToken };
  const retryDelays = [0, 250, 700];
  for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
    if (retryDelays[attempt] > 0) await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
    const response = await fetch(apiUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body), signal: options.signal });
    const envelope = (await response.json()) as ApiResponse<TResult>;
    if (envelope.status === "ok") return envelope.data as TResult;
    const code = envelope.error?.code || "API_ERROR";
    if (["AUTH_REQUIRED", "INVALID_GOOGLE_ID_TOKEN", "GOOGLE_TOKEN_EXPIRED", "USER_NOT_REGISTERED"].includes(code)) authFailureHandler?.();
    const apiError = new ApiError(code, envelope.error?.message || "Apps Script request failed", envelope.error?.retryable === true);
    if (!apiError.retryable || attempt === retryDelays.length - 1) throw apiError;
  }
  throw new ApiError("API_ERROR", "Apps Script request failed", true);
}

export const api = {
  dashboard: () => callApi<undefined, DashboardData>("dashboard.get"),
  gardens: {
    list: () => callApi<undefined, Garden[]>("gardens.list"),
    create: (payload: Partial<Garden>) => callApi("gardens.create", payload),
    update: (payload: Partial<Garden> & { gardenId: string }) => callApi("gardens.update", payload),
  },
  plots: {
    list: (gardenId: string) => callApi("plots.list", { gardenId }),
    create: (payload: { gardenId: string; name: string; notes?: string }) => callApi("plots.create", payload),
  },
  members: {
    list: (gardenId: string) => callApi<unknown, GardenMember[]>("members.list", { gardenId }),
    add: (payload: { gardenId: string; email: string }, requestId?: string) => callApi<unknown, GardenMember>("members.add", payload, { requestId }),
    deactivate: (payload: { gardenId: string; memberId: string }, requestId?: string) => callApi<unknown, GardenMember>("members.deactivate", payload, { requestId }),
  },
  agreements: {
    list: (gardenId: string) => callApi<unknown, Agreement[]>("agreements.list", { gardenId }),
    create: (payload: Record<string, unknown>) => callApi("agreements.create", payload),
  },
  products: { list: () => callApi<undefined, unknown[]>("products.list") },
  buyers: { list: (gardenId: string) => callApi("buyers.list", { gardenId }) },
  receipts: { extract: (payload: { gardenId: string; data: string; mimeType: string; filename: string; imageHash?: string }) => callApi("receipts.extract", payload) },
  sales: {
    create: (payload: Record<string, unknown>) => callApi("sales.create", payload),
    list: (payload: { gardenId: string; from?: string; to?: string; status?: string; productTypeId?: string }) => callApi<unknown, Sale[]>("sales.list", payload),
    duplicateCheck: (payload: Record<string, unknown>) => callApi("sales.duplicateCheck", payload),
    receipt: (saleId: string) => callApi<unknown, SaleReceiptEvidence>("sales.receipt", { saleId }),
    confirm: (saleId: string) => callApi("sales.confirm", { saleId }),
    dispute: (payload: { saleId: string; reason: string; note?: string; evidenceFileId?: string }) => callApi("sales.dispute", payload),
  },
  wallets: { me: (gardenId: string) => callApi<unknown, WalletData>("wallets.me", { gardenId }) },
  settlements: {
    list: (gardenId: string) => callApi<unknown, Settlement[]>("settlements.list", { gardenId }),
    create: (payload: Record<string, unknown>) => callApi<unknown, Settlement>("settlements.create", payload),
    confirm: (settlementId: string, requestId?: string) => callApi("settlements.confirm", { settlementId }, { requestId }),
    reject: (payload: { settlementId: string; reason: string }, requestId?: string) => callApi("settlements.reject", payload, { requestId }),
    cancel: (settlementId: string, requestId?: string) => callApi("settlements.cancel", { settlementId }, { requestId }),
  },
  notifications: {
    list: () => callApi<undefined, Notification[]>("notifications.list"),
    read: (notificationId: string) => callApi("notifications.read", { notificationId }),
  },
  reports: { summary: (payload: { gardenId: string; from?: string; to?: string }) => callApi<unknown, ReportData>("reports.summary", payload) },
  disputes: { resolve: (payload: { disputeId?: string; saleId?: string; decision: "resolved" | "rejected"; resolution?: string }, requestId?: string) => callApi("disputes.resolve", payload, { requestId }) },
  adjustments: { create: (payload: { saleId: string; adjustmentType: string; amount: number; reason: string }, requestId?: string) => callApi("adjustments.create", payload, { requestId }) },
};
