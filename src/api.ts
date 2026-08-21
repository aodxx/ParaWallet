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

export type Garden = { id: string; ownerId?: string; name: string; locationText?: string; province?: string; district?: string; areaRai: number; treeCount: number; status: "active" | "archived" };
export type Plot = { id: string; gardenId: string; name: string; notes?: string; status: string };
export type Agreement = { id: string; gardenId: string; ownerId: string; tapperId: string; version: number; ownerPercentage: number; tapperPercentage: number; effectiveFrom: string; effectiveTo?: string; status: string };
export type Sale = { id: string; gardenId: string; agreementId: string; saleDate: string; buyerName?: string; productType?: string; weightKg?: number; netWeight?: number; unitPrice?: number; grossSale?: number; buyerDeductions?: number; sharedExpenses?: number; splitBase?: number; ownerShare?: number; tapperShare?: number; status: string; receiptFileId?: string; ocrConfidence?: number | string; manualEntry?: boolean };
export type Settlement = { id: string; gardenId: string; amount: number; method: string; status: string; transferDate?: string; referenceNo?: string };
export type Notification = { id: string; userId: string; type: string; title: string; body: string; readAt?: string; createdAt: string };
export type WalletSummary = { owner: number; tapper: number; outstanding: number; currency: "THB" };
export type DashboardData = { role: Role; garden?: Garden; wallet: WalletSummary; pendingReviews: number; monthlySales: number };
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
  const response = await fetch(apiUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body), signal: options.signal });
  const envelope = (await response.json()) as ApiResponse<TResult>;
  if (envelope.status !== "ok") {
    const code = envelope.error?.code || "API_ERROR";
    if (["AUTH_REQUIRED", "INVALID_GOOGLE_ID_TOKEN", "GOOGLE_TOKEN_EXPIRED", "USER_NOT_REGISTERED"].includes(code)) authFailureHandler?.();
    throw new ApiError(code, envelope.error?.message || "Apps Script request failed", envelope.error?.retryable === true);
  }
  return envelope.data as TResult;
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
  members: { list: (gardenId: string) => callApi("members.list", { gardenId }) },
  agreements: {
    list: (gardenId: string) => callApi<unknown, Agreement[]>("agreements.list", { gardenId }),
    create: (payload: Record<string, unknown>) => callApi("agreements.create", payload),
  },
  products: { list: () => callApi<undefined, unknown[]>("products.list") },
  buyers: { list: (gardenId: string) => callApi("buyers.list", { gardenId }) },
  receipts: { extract: (payload: { data: string; mimeType: string; filename: string }) => callApi("receipts.extract", payload) },
  sales: {
    create: (payload: Record<string, unknown>) => callApi("sales.create", payload),
    list: (payload: { gardenId: string; from?: string; to?: string; status?: string; productTypeId?: string }) => callApi<unknown, Sale[]>("sales.list", payload),
    duplicateCheck: (payload: Record<string, unknown>) => callApi("sales.duplicateCheck", payload),
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
