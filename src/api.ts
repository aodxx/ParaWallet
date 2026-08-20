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
  error?: { code: string; message: string; details?: unknown };
};

export type Garden = { id: string; name: string; province?: string; district?: string; areaRai: number; treeCount: number; status: "active" | "archived" };
export type WalletSummary = { owner: number; tapper: number; outstanding: number; currency: "THB" };
export type DashboardData = { role: Role; garden?: Garden; wallet: WalletSummary; pendingReviews: number; monthlySales: number };

const apiUrl = (import.meta.env.VITE_APPS_SCRIPT_URL || "").replace(/\/$/, "");

function newRequestId() {
  return `${Date.now()}-${crypto.randomUUID()}`;
}

export async function callApi<TPayload, TResult>(action: string, payload?: TPayload, options: { signal?: AbortSignal } = {}): Promise<TResult> {
  if (!apiUrl) throw new Error("VITE_APPS_SCRIPT_URL is not configured");
  const requestId = newRequestId();
  const body: ApiRequest<TPayload> = { action, requestId, payload };
  const response = await fetch(apiUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body), signal: options.signal });
  const envelope = (await response.json()) as ApiResponse<TResult>;
  if (envelope.status !== "ok") throw new Error(envelope.error?.message || "Apps Script request failed");
  return envelope.data as TResult;
}

export const api = {
  dashboard: () => callApi<undefined, DashboardData>("dashboard.get"),
  gardens: { list: () => callApi<undefined, Garden[]>("gardens.list") },
};
