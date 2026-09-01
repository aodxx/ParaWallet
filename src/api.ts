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
  NETWORK_ERROR: "สัญญาณเชื่อมต่อไม่เสถียร ระบบลองเชื่อมต่อซ้ำแล้ว กรุณากดลองใหม่อีกครั้ง",
  INVALID_API_RESPONSE: "ระบบข้อมูลตอบกลับไม่สมบูรณ์ กรุณากดลองใหม่อีกครั้ง",
  REQUEST_ID_REQUIRED: "คำขอไม่สมบูรณ์ กรุณาลองใหม่",
  AUTH_REQUIRED: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่",
  INVALID_GOOGLE_ID_TOKEN: "ยืนยันบัญชี Google ไม่สำเร็จ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่",
  GOOGLE_TOKEN_EXPIRED: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่",
  USER_NOT_REGISTERED: "บัญชีนี้ยังไม่ได้ลงทะเบียนในระบบ กรุณาใช้บัญชีที่ได้รับสิทธิ์หรือติดต่อเจ้าของสวน",
  GARDEN_NOT_FOUND: "ไม่พบสวนที่เลือก สวนอาจถูกลบหรือเปลี่ยนแปลงแล้ว กรุณาเลือกสวนใหม่",
  GARDEN_ACCESS_DENIED: "บัญชีนี้ไม่มีสิทธิ์เข้าสวนที่เลือก กรุณาติดต่อเจ้าของสวนหรือเปลี่ยนบัญชี",
  OWNER_PERMISSION_REQUIRED: "รายการนี้ทำได้เฉพาะเจ้าของสวน กรุณาใช้บัญชีเจ้าของสวน",
  TAPPER_PERMISSION_REQUIRED: "รายการนี้ทำได้เฉพาะคนกรีดของสวนนี้ กรุณาตรวจบัญชีและสวนที่เลือก",
  SETTLEMENT_SLIP_REQUIRED: "กรุณาแนบสลิปการโอนเงิน",
  SETTLEMENT_SLIP_TOO_LARGE: "ไฟล์สลิปมีขนาดใหญ่เกินไป กรุณาเลือกไฟล์ไม่เกิน 4 MB",
  SETTLEMENT_SLIP_NOT_FOUND: "ไม่พบสลิปของรายการส่งเงินนี้",
  SETTLEMENT_SLIP_ACCESS_DENIED: "ไม่สามารถเปิดสลิปที่ไม่ใช่หลักฐานของรายการนี้",
  SETTLEMENT_SLIP_TYPE_INVALID: "สลิปต้องเป็นรูปภาพหรือไฟล์ PDF เท่านั้น",
  SETTLEMENT_PERMISSION_DENIED: "บัญชีนี้ไม่มีสิทธิ์สร้างรายการส่งเงินในสวนนี้",
  SETTLEMENT_TAPPER_MISMATCH: "รายการส่งเงินนี้ไม่ตรงกับบัญชีคนกรีดที่เข้าสู่ระบบ กรุณาเลือกบัญชีหรือสวนให้ถูกต้อง",
  TAPPER_SETTLEMENT_REQUIRED: "รายการส่งเงินต้องสร้างโดยบัญชีคนกรีด เจ้าของสวนมีหน้าที่ยืนยันการรับเงิน",
  SETTLEMENT_AMOUNT_INVALID: "กรุณาระบุยอดส่งเงินให้มากกว่า 0 บาท",
  SETTLEMENT_METHOD_INVALID: "กรุณาเลือกวิธีส่งเงินเป็นโอนเงินหรือเงินสด",
  SETTLEMENT_EXCEEDS_OUTSTANDING: "ยอดส่งเงินมากกว่ายอดเงินของเจ้าของสวนที่ค้างอยู่ กรุณาตรวจและลดจำนวนเงิน",
  SETTLEMENT_NOT_FOUND: "ไม่พบรายการส่งเงินนี้ รายการอาจถูกลบหรือเปลี่ยนแปลงแล้ว กรุณารีเฟรชข้อมูล",
  SETTLEMENT_NOT_CONFIRMABLE: "รายการส่งเงินนี้ไม่ได้อยู่ในสถานะรอเจ้าของยืนยัน จึงยืนยันซ้ำไม่ได้",
  SETTLEMENT_NOT_REJECTABLE: "รายการส่งเงินนี้ไม่ได้อยู่ในสถานะรอเจ้าของยืนยัน จึงปฏิเสธไม่ได้",
  SETTLEMENT_NOT_CANCELLABLE: "รายการส่งเงินนี้ไม่ได้อยู่ในสถานะรอยืนยัน จึงยกเลิกไม่ได้",
  SETTLEMENT_REJECTION_REASON_REQUIRED: "กรุณาระบุเหตุผลที่ปฏิเสธรายการส่งเงิน",
  SETTLEMENT_ALLOCATION_MISMATCH: "ระบบจัดสรรยอดส่งเงินกับรายการขายไม่ลงตัว จึงยังยืนยันไม่ได้ กรุณาแจ้งผู้ดูแลระบบ",
  CASH_LOCATION_REQUIRED: "กรุณาระบุสถานที่ส่งมอบเงินสด",
  MEMBER_EMAIL_REQUIRED: "กรุณากรอกอีเมล Google ของคนกรีด",
  TAPPER_USER_NOT_REGISTERED: "ยังไม่พบบัญชีคนกรีดที่พร้อมใช้งาน กรุณาลงทะเบียนบัญชีก่อน",
  MEMBER_ROLE_INVALID: "บัญชีนี้ไม่ได้ลงทะเบียนเป็นคนกรีด",
  MEMBER_NOT_FOUND: "ไม่พบสมาชิกที่เลือก หรือสมาชิกไม่ได้อยู่ในสวนนี้แล้ว กรุณารีเฟรชข้อมูล",
  MEMBER_HAS_ACTIVE_AGREEMENT: "ยังถอดคนกรีดไม่ได้ เพราะมีข้อตกลงที่กำลังใช้งาน",
  MEMBER_HAS_OPEN_ITEMS: "ยังถอดคนกรีดไม่ได้ เพราะมีรายการขายหรือรายการส่งเงินรอดำเนินการ",
  MEMBER_HAS_OUTSTANDING_BALANCE: "ยังถอดคนกรีดไม่ได้ เพราะยังมีเงินของเจ้าของสวนคงค้างอยู่",
  OWNER_MEMBER_CANNOT_BE_REMOVED: "ไม่สามารถถอดเจ้าของสวนออกจากสวนของตนเองได้",
  AGREEMENT_EFFECTIVE_FROM_REQUIRED: "กรุณาระบุวันที่เริ่มใช้ข้อตกลงให้ถูกต้อง",
  PERCENTAGES_MUST_SUM_TO_100: "สัดส่วนของเจ้าของสวนและคนกรีดต้องรวมกันเท่ากับ 100%",
  TAPPER_REQUIRED: "กรุณาเลือกคนกรีดสำหรับข้อตกลงนี้",
  TAPPER_NOT_ACTIVE_MEMBER: "คนกรีดที่เลือกไม่ได้เป็นสมาชิกที่ใช้งานอยู่ในสวนนี้ กรุณาเลือกคนกรีดใหม่",
  AGREEMENT_NOT_FOUND: "ไม่พบข้อตกลงที่เลือก กรุณารีเฟรชข้อมูลแล้วเลือกข้อตกลงใหม่",
  AGREEMENT_GARDEN_MISMATCH: "ข้อตกลงนี้ไม่ใช่ของสวนที่กำลังบันทึก กรุณาเลือกสวนหรือข้อตกลงให้ตรงกัน",
  AGREEMENT_NOT_ACTIVE: "ข้อตกลงนี้ไม่ได้ใช้งานแล้ว กรุณาเลือกข้อตกลงที่กำลังใช้งาน",
  AGREEMENT_DATE_OUT_OF_RANGE: "วันที่ขายอยู่นอกช่วงที่ข้อตกลงมีผล กรุณาตรวจวันที่ในบิล หรือให้เจ้าของสวนตรวจวันที่เริ่มใช้ข้อตกลง",
  AGREEMENT_TAPPER_MISMATCH: "ข้อตกลงนี้เป็นของคนกรีดคนอื่น กรุณาเลือกข้อตกลงที่ตรงกับบัญชีของคุณ",
  RECEIPT_IMAGE_REQUIRED: "กรุณาถ่ายหรือเลือกภาพใบเสร็จ",
  RECEIPT_IMAGE_TYPE_INVALID: "รองรับเฉพาะไฟล์ภาพใบเสร็จ",
  RECEIPT_IMAGE_TOO_LARGE: "ภาพใบเสร็จมีขนาดใหญ่เกินไป กรุณาเลือกไฟล์ไม่เกิน 4 MB",
  OCR_NOT_CONFIGURED: "ระบบอ่านบิลยังไม่ได้เปิดใช้งาน กรุณาแจ้งผู้ดูแลระบบหรือเลือกกรอกตัวเลขเอง",
  OCR_PROVIDER_FAILED: "บริการอ่านบิลขัดข้องชั่วคราว กรุณาลองสแกนใหม่ หรือเลือกกรอกตัวเลขเอง",
  OCR_PROVIDER_EMPTY_RESPONSE: "บริการอ่านบิลไม่ส่งผลลัพธ์กลับมา กรุณาลองสแกนใหม่ หรือเลือกกรอกตัวเลขเอง",
  OCR_PROVIDER_INVALID_JSON: "บริการอ่านบิลส่งผลลัพธ์ไม่สมบูรณ์ กรุณาลองสแกนใหม่ หรือเลือกกรอกตัวเลขเอง",
  OCR_PROVIDER_INVALID_RESPONSE: "บริการอ่านบิลส่งผลลัพธ์ที่ใช้ไม่ได้ กรุณาลองสแกนใหม่ หรือเลือกกรอกตัวเลขเอง",
  OCR_PROVIDER_SCHEMA_MISMATCH: "รูปแบบผลลัพธ์จากบริการอ่านบิลไม่ตรงกับระบบ กรุณาแจ้งผู้ดูแลระบบหรือเลือกกรอกตัวเลขเอง",
  SALE_RECEIPT_REQUIRED: "รายการจากการสแกนต้องมีหลักฐานใบเสร็จ",
  SALE_RECEIPT_ACCESS_DENIED: "ไม่สามารถใช้ใบเสร็จที่ไม่ได้สร้างจากบัญชีคนกรีดนี้",
  SALE_RECEIPT_NOT_FOUND: "ไม่พบไฟล์ใบเสร็จของรายการนี้",
  SALE_RECEIPT_MISMATCH: "ข้อมูลใบเสร็จกับรายการขายไม่ตรงกัน กรุณาตรวจสอบใหม่",
  RECEIPT_GARDEN_MISMATCH: "ใบเสร็จนี้ไม่ได้สแกนจากสวนที่กำลังบันทึก กรุณาสแกนใหม่ในสวนที่ถูกต้อง",
  OCR_HUMAN_VERIFICATION_REQUIRED: "กรุณาตรวจตัวเลขกับภาพบิลและทำเครื่องหมายยืนยันก่อนบันทึก",
  RECEIPT_NOT_FILLED_SALE: "ภาพนี้ไม่ใช่บิลขายที่กรอกแล้วหรืออ่านหลักฐานไม่ชัดเจน จึงใช้สร้างรายการขายไม่ได้",
  RECEIPT_TYPE_REQUIRED: "กรุณาเลือกรูปแบบใบเสร็จให้ตรงกับภาพ",
  SALE_REQUIRED_FIELDS_MISSING: "กรุณาระบุร้านรับซื้อและประเภทสินค้าให้ครบ",
  SALE_DATE_REQUIRED: "กรุณาตรวจและระบุวันที่ขายให้ถูกต้อง",
  RECEIPT_WEIGHT_ROWS_MISMATCH: "ผลรวมน้ำหนักรายแถวไม่ตรงกับน้ำหนักรวม กรุณาตรวจภาพอีกครั้ง",
  RECEIPT_NET_WEIGHT_MISMATCH: "น้ำหนักรวม หักตะกร้า และน้ำหนักสุทธิไม่สัมพันธ์กัน",
  RECEIPT_DRC_FIELDS_REQUIRED: "กรุณาระบุน้ำหนักยางสด เปอร์เซ็นต์ และน้ำหนักยางแห้งให้ครบ",
  RECEIPT_DRC_MISMATCH: "น้ำหนักยางสด เปอร์เซ็นต์ และน้ำหนักยางแห้งไม่สัมพันธ์กัน",
  RECEIPT_TOTAL_REQUIRED: "กรุณาระบุยอดเงินที่เขียนอยู่ในบิล",
  RECEIPT_MATH_MISMATCH: "น้ำหนัก ราคา รายการหัก และยอดเงินในบิลไม่สัมพันธ์กัน กรุณาตรวจภาพอีกครั้ง",
  SALE_INPUT_INVALID: "น้ำหนักและราคาต่อกิโลกรัมต้องมากกว่า 0 กรุณาตรวจตัวเลขในบิล",
  DEDUCTION_INVALID: "ยอดหักต้องไม่ติดลบ กรุณาตรวจยอดหักในบิล",
  SPLIT_BASE_NEGATIVE: "ยอดหักมากกว่ายอดขาย จึงแบ่งเงินไม่ได้ กรุณาตรวจน้ำหนัก ราคา และยอดหัก",
  SALE_NOT_FOUND: "ไม่พบรายการขายนี้ รายการอาจถูกลบหรือเปลี่ยนแปลงแล้ว กรุณารีเฟรชข้อมูล",
  SALE_NOT_REVIEWABLE: "รายการขายนี้ไม่ได้อยู่ในสถานะรอเจ้าของตรวจ จึงยืนยันซ้ำไม่ได้",
  LEDGER_IMBALANCE: "ยอดขาย ยอดหัก และส่วนแบ่งไม่สมดุล จึงยังยืนยันไม่ได้ กรุณาแจ้งผู้ดูแลระบบ",
  DISPUTE_REASON_REQUIRED: "กรุณาระบุเหตุผลที่คัดค้านรายการขาย",
  DISPUTE_NOT_FOUND: "ไม่พบรายการคัดค้านนี้ กรุณารีเฟรชข้อมูลแล้วลองใหม่",
  DISPUTE_NOT_RESOLVABLE: "รายการคัดค้านนี้ได้รับการสรุปแล้ว จึงดำเนินการซ้ำไม่ได้",
  DISPUTE_DECISION_INVALID: "กรุณาเลือกผลการพิจารณารายการคัดค้านให้ถูกต้อง",
  SALE_NOT_ADJUSTABLE: "แก้ไขยอดได้เฉพาะรายการขายที่เจ้าของยืนยันแล้ว",
  ADJUSTMENT_AMOUNT_INVALID: "กรุณาระบุยอดปรับปรุงให้มากกว่า 0 บาท",
  ADJUSTMENT_TYPE_INVALID: "กรุณาเลือกประเภทการปรับปรุงยอดให้ถูกต้อง",
  ADJUSTMENT_REASON_REQUIRED: "กรุณาระบุเหตุผลที่ปรับปรุงยอด",
  NOTIFICATION_NOT_FOUND: "ไม่พบการแจ้งเตือนนี้ รายการอาจถูกลบแล้ว กรุณารีเฟรชข้อมูล",
  NOTIFICATION_TARGET_NOT_FOUND: "ไม่พบรายการที่การแจ้งเตือนอ้างถึง รายการอาจถูกเปลี่ยนสถานะแล้ว กรุณารีเฟรชข้อมูล",
  UNKNOWN_ACTION: "รุ่นของหน้าเว็บไม่ตรงกับระบบข้อมูล กรุณาปิดแล้วเปิดแอปใหม่ หากยังไม่สำเร็จให้แจ้งผู้ดูแลระบบ",
  MISSING_SCRIPT_PROPERTY: "ระบบยังตั้งค่าบริการไม่ครบ กรุณาแจ้งผู้ดูแลระบบ",
  SHEET_MISSING: "ระบบจัดเก็บข้อมูลยังไม่พร้อมใช้งาน กรุณาแจ้งผู้ดูแลระบบ",
  SCHEMA_MISMATCH: "โครงสร้างข้อมูลไม่ตรงกับรุ่นของระบบ กรุณาแจ้งผู้ดูแลระบบก่อนทำรายการต่อ",
  SCHEMA_MIGRATION_UNEXPECTED: "ปรับโครงสร้างข้อมูลไม่สำเร็จตามที่คาดไว้ กรุณาแจ้งผู้ดูแลระบบก่อนทำรายการต่อ",
  ID_COLUMN_MISSING: "โครงสร้างข้อมูลไม่สมบูรณ์ กรุณาแจ้งผู้ดูแลระบบก่อนทำรายการต่อ",
};

const unknownApiErrorMessage = "ดำเนินการไม่สำเร็จ กรุณาลองอีกครั้ง หากยังไม่สำเร็จให้แจ้งผู้ดูแลระบบ";

export function userMessageForApiError(error: unknown) {
  if (error instanceof ApiError) return apiErrorMessages[error.code] || unknownApiErrorMessage;
  return "ยังเชื่อมต่อ Google Sheets ไม่ได้ กรุณาลองอีกครั้ง";
}

export type Garden = { id: string; ownerId?: string; name: string; locationText?: string; province?: string; district?: string; areaRai: number; treeCount: number; status: "active" | "archived" };
export type Plot = { id: string; gardenId: string; name: string; notes?: string; status: string };
export type GardenMember = { id: string; gardenId: string; userId: string; role: "owner" | "tapper"; status: "active" | "inactive"; name?: string; email?: string; createdAt?: string };
export type Agreement = { id: string; gardenId: string; ownerId: string; tapperId: string; version: number; ownerPercentage: number; tapperPercentage: number; effectiveFrom: string; effectiveTo?: string; status: string };
export type Sale = { id: string; gardenId: string; agreementId: string; tapperId?: string; receiptId?: string; saleDate: string; ticketNumber?: string; buyerName?: string; productType?: string; weightKg?: number; netWeight?: number; unitPrice?: number; grossSale?: number; buyerDeductions?: number; sharedExpenses?: number; splitBase?: number; ownerShare?: number; tapperShare?: number; status: string; receiptFileId?: string; ocrConfidence?: number | string; manualEntry?: boolean; createdAt?: string };
export type SaleReceiptEvidence = { saleId: string; receiptId?: string; fileId: string; name: string; mimeType: string; dataUrl: string };
export type Settlement = { id: string; gardenId: string; amount: number; method: string; status: string; transferDate?: string; referenceNo?: string; bank?: string; slipFileId?: string; location?: string; note?: string };
export type SettlementEvidence = { settlementId: string; fileId: string; name: string; mimeType: string; dataUrl: string };
export type Notification = { id: string; userId: string; type: string; title: string; body: string; readAt?: string; createdAt: string; targetScreen?: "sales" | "settlements" | "gardens" | "agreements" | "notifications"; entityType?: "sale" | "settlement" | "garden" | "agreement"; entityId?: string };
export type WalletSummary = { owner: number; tapper: number; outstanding: number; currency: "THB" };
export type WalletData = { gardenId: string; role: Role; owner: { totalEntitlement: number; totalReceived: number; outstanding: number; pending: number; disputed: number }; tapper: { totalIncome: number; ownerMoneyHeld: number; ownerMoneyTransferred: number; pendingReviews: number } };
export type DashboardData = { role: Role; garden?: Garden; wallet: WalletSummary; walletDetails?: WalletData; pendingReviews: number; pendingSales?: number; pendingSettlements?: number; unreadNotifications?: number; monthlySales: number; monthlySalesSeries?: number[] };
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

const retryDelays = [0, 800, 2200];

function waitForRetry(delay: number, signal?: AbortSignal) {
  if (!delay) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timer = globalThis.setTimeout(resolve, delay);
    signal?.addEventListener("abort", () => {
      globalThis.clearTimeout(timer);
      reject(signal.reason || new DOMException("The operation was aborted", "AbortError"));
    }, { once: true });
  });
}

export async function callApi<TPayload, TResult>(action: string, payload?: TPayload, options: { signal?: AbortSignal; authToken?: string; requestId?: string } = {}): Promise<TResult> {
  if (!apiUrl) throw new Error("VITE_APPS_SCRIPT_URL is not configured");
  const requestId = options.requestId ?? newRequestId();
  const body: ApiRequest<TPayload> = { action, requestId, payload, authToken: options.authToken ?? currentAuthToken };
  for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
    await waitForRetry(retryDelays[attempt], options.signal);
    try {
      const response = await fetch(apiUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body), signal: options.signal });
      if (response.ok === false) throw new ApiError("NETWORK_ERROR", `Apps Script HTTP ${response.status}`, true);
      let envelope: ApiResponse<TResult>;
      try {
        envelope = (await response.json()) as ApiResponse<TResult>;
      } catch {
        throw new ApiError("INVALID_API_RESPONSE", "Apps Script returned invalid JSON", true);
      }
      if (envelope.status === "ok") return envelope.data as TResult;
      const code = envelope.error?.code || "API_ERROR";
      if (["AUTH_REQUIRED", "INVALID_GOOGLE_ID_TOKEN", "GOOGLE_TOKEN_EXPIRED", "USER_NOT_REGISTERED"].includes(code)) authFailureHandler?.();
      throw new ApiError(code, envelope.error?.message || "Apps Script request failed", envelope.error?.retryable === true);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") throw caught;
      const apiError = caught instanceof ApiError
        ? caught
        : new ApiError("NETWORK_ERROR", caught instanceof Error ? caught.message : "Apps Script network request failed", true);
      if (!apiError.retryable || attempt === retryDelays.length - 1) throw apiError;
    }
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
    evidence: (settlementId: string) => callApi<unknown, SettlementEvidence>("settlements.evidence", { settlementId }),
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
