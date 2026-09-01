import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, callApi, onAuthFailure, setAuthToken, userMessageForApiError } from "../src/api";

describe("Apps Script API contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setAuthToken("");
    onAuthFailure(() => undefined);
  });

  it("returns data from a successful envelope", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ status: "ok", requestId: "req-1", data: { connected: true } }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(callApi("health.get", undefined, { requestId: "req-1" })).resolves.toEqual({ connected: true });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("preserves the caller request ID and auth token in the request body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ status: "ok", requestId: "req-2", data: {} }) });
    vi.stubGlobal("fetch", fetchMock);
    setAuthToken("id-token");
    await callApi("dashboard.get", { gardenId: "garden-1" }, { requestId: "req-2" });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ action: "dashboard.get", requestId: "req-2", authToken: "id-token", payload: { gardenId: "garden-1" } });
  });

  it("maps structured server errors to ApiError with code and retryability", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ status: "error", requestId: "req-3", error: { code: "SETTLEMENT_EXCEEDS_OUTSTANDING", message: "amount too high", retryable: false } }) });
    vi.stubGlobal("fetch", fetchMock);
    const request = callApi("settlements.confirm", { settlementId: "s1" }, { requestId: "req-3" });
    await expect(request).rejects.toMatchObject({ name: "ApiError", code: "SETTLEMENT_EXCEEDS_OUTSTANDING", retryable: false, message: "amount too high" });
  });

  it("clears auth through the registered failure handler for an expired token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ status: "error", requestId: "req-4", error: { code: "GOOGLE_TOKEN_EXPIRED", message: "expired", retryable: false } }) });
    vi.stubGlobal("fetch", fetchMock);
    const authFailure = vi.fn();
    onAuthFailure(authFailure);
    await expect(callApi("dashboard.get", undefined, { requestId: "req-4" })).rejects.toBeInstanceOf(ApiError);
    expect(authFailure).toHaveBeenCalledOnce();
  });

  it("does not treat business validation errors as authentication failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ status: "error", requestId: "req-5", error: { code: "SALE_INPUT_INVALID", message: "invalid sale", retryable: false } }) });
    vi.stubGlobal("fetch", fetchMock);
    const authFailure = vi.fn();
    onAuthFailure(authFailure);
    await expect(callApi("sales.create", {}, { requestId: "req-5" })).rejects.toBeInstanceOf(ApiError);
    expect(authFailure).not.toHaveBeenCalled();
  });

  it("retries a busy request with the same request ID", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ status: "error", requestId: "req-6", error: { code: "TRANSACTION_BUSY", message: "TRANSACTION_BUSY:request:req-6", retryable: true } }) })
      .mockResolvedValueOnce({ json: async () => ({ status: "ok", requestId: "req-6", data: { connected: true } }) });
    vi.stubGlobal("fetch", fetchMock);
    const request = callApi("dashboard.get", undefined, { requestId: "req-6" });
    await vi.advanceTimersByTimeAsync(800);
    await expect(request).resolves.toEqual({ connected: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).requestId).toBe("req-6");
    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body)).requestId).toBe("req-6");
    vi.useRealTimers();
  });

  it("retries a transient network failure with the same request ID", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ json: async () => ({ status: "ok", requestId: "req-network", data: { connected: true } }) });
    vi.stubGlobal("fetch", fetchMock);
    const request = callApi("dashboard.get", undefined, { requestId: "req-network" });
    await vi.advanceTimersByTimeAsync(800);
    await expect(request).resolves.toEqual({ connected: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body)).requestId).toBe("req-network");
    vi.useRealTimers();
  });

  it("shows a safe Thai message instead of an internal busy request key", () => {
    const error = new ApiError("TRANSACTION_BUSY", "TRANSACTION_BUSY:request:private-uuid", true);
    expect(userMessageForApiError(error)).toBe("ระบบกำลังประมวลผลข้อมูล กรุณาลองอีกครั้งในอีกสักครู่");
    expect(userMessageForApiError(error)).not.toContain("private-uuid");
  });

  it("explains when automatic network retries are exhausted", () => {
    expect(userMessageForApiError(new ApiError("NETWORK_ERROR", "Failed to fetch", true))).toContain("ระบบลองเชื่อมต่อซ้ำแล้ว");
  });

  it("sends owner-controlled member mutations through the typed API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ status: "ok", requestId: "req-member", data: { id: "member-1" } }) });
    vi.stubGlobal("fetch", fetchMock);
    await api.members.add({ gardenId: "garden-1", email: "tapper@example.com" }, "req-member");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toMatchObject({ action: "members.add", requestId: "req-member", payload: { gardenId: "garden-1", email: "tapper@example.com" } });
  });

  it("explains why a Tapper with open money cannot be removed", () => {
    expect(userMessageForApiError(new ApiError("MEMBER_HAS_OUTSTANDING_BALANCE", "internal"))).toContain("เงินของเจ้าของสวนคงค้าง");
  });

  it("requests Sale receipt evidence without exposing a raw Drive URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ status: "ok", requestId: "req-receipt", data: { saleId: "sale-1", dataUrl: "data:image/jpeg;base64,AA==" } }) });
    vi.stubGlobal("fetch", fetchMock);
    await api.sales.receipt("sale-1");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toMatchObject({ action: "sales.receipt", payload: { saleId: "sale-1" } });
  });

  it("requests settlement slip evidence by settlement ID", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ status: "ok", requestId: "req-slip", data: { settlementId: "settlement-1", dataUrl: "data:image/jpeg;base64,AA==" } }) });
    vi.stubGlobal("fetch", fetchMock);
    await api.settlements.evidence("settlement-1");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toMatchObject({ action: "settlements.evidence", payload: { settlementId: "settlement-1" } });
  });

  it("shows a useful message for missing receipt evidence", () => {
    expect(userMessageForApiError(new ApiError("SALE_RECEIPT_NOT_FOUND", "internal"))).toBe("ไม่พบไฟล์ใบเสร็จของรายการนี้");
  });

  it("explains when a notification target no longer exists", () => {
    expect(userMessageForApiError(new ApiError("NOTIFICATION_TARGET_NOT_FOUND", "internal entity id"))).toBe("ไม่พบรายการที่การแจ้งเตือนอ้างถึง รายการอาจถูกเปลี่ยนสถานะแล้ว กรุณารีเฟรชข้อมูล");
  });

  it("explains that a receipt date is outside the active agreement instead of reporting a load failure", () => {
    expect(userMessageForApiError(new ApiError("AGREEMENT_DATE_OUT_OF_RANGE", "internal"))).toBe("วันที่ขายอยู่นอกช่วงที่ข้อตกลงมีผล กรุณาตรวจวันที่ในบิล หรือให้เจ้าของสวนตรวจวันที่เริ่มใช้ข้อตกลง");
  });

  it("has actionable Thai copy for every user-facing business error group", () => {
    const fallback = userMessageForApiError(new ApiError("UNRECOGNIZED_SERVER_CODE", "internal"));
    const codes = [
      "AUTH_REQUIRED", "USER_NOT_REGISTERED", "GARDEN_NOT_FOUND", "GARDEN_ACCESS_DENIED",
      "OWNER_PERMISSION_REQUIRED", "TAPPER_PERMISSION_REQUIRED", "MEMBER_NOT_FOUND",
      "AGREEMENT_EFFECTIVE_FROM_REQUIRED", "PERCENTAGES_MUST_SUM_TO_100", "TAPPER_REQUIRED",
      "TAPPER_NOT_ACTIVE_MEMBER", "AGREEMENT_NOT_FOUND", "AGREEMENT_GARDEN_MISMATCH",
      "AGREEMENT_NOT_ACTIVE", "AGREEMENT_DATE_OUT_OF_RANGE", "AGREEMENT_TAPPER_MISMATCH",
      "OCR_PROVIDER_FAILED", "SALE_INPUT_INVALID", "DEDUCTION_INVALID", "SPLIT_BASE_NEGATIVE",
      "SALE_NOT_FOUND", "SALE_NOT_REVIEWABLE", "LEDGER_IMBALANCE", "DISPUTE_REASON_REQUIRED",
      "DISPUTE_NOT_FOUND", "DISPUTE_NOT_RESOLVABLE", "DISPUTE_DECISION_INVALID",
      "SETTLEMENT_PERMISSION_DENIED", "SETTLEMENT_TAPPER_MISMATCH", "TAPPER_SETTLEMENT_REQUIRED",
      "SETTLEMENT_AMOUNT_INVALID", "SETTLEMENT_METHOD_INVALID", "SETTLEMENT_EXCEEDS_OUTSTANDING",
      "SETTLEMENT_NOT_FOUND", "SETTLEMENT_NOT_CONFIRMABLE", "SETTLEMENT_NOT_REJECTABLE",
      "SETTLEMENT_NOT_CANCELLABLE", "SETTLEMENT_REJECTION_REASON_REQUIRED",
      "SETTLEMENT_ALLOCATION_MISMATCH", "NOTIFICATION_NOT_FOUND",
      "SCHEMA_MIGRATION_UNEXPECTED",
    ];
    codes.forEach((code) => {
      const message = userMessageForApiError(new ApiError(code, `private:${code}`));
      expect(message, code).not.toBe(fallback);
      expect(message, code).not.toContain(code);
      expect(message, code).not.toContain("private:");
    });
  });

  it("uses an action-neutral fallback for an unknown server code", () => {
    const message = userMessageForApiError(new ApiError("UNRECOGNIZED_SERVER_CODE", "private record"));
    expect(message).toBe("ดำเนินการไม่สำเร็จ กรุณาลองอีกครั้ง หากยังไม่สำเร็จให้แจ้งผู้ดูแลระบบ");
    expect(message).not.toContain("โหลดข้อมูล");
    expect(message).not.toContain("UNRECOGNIZED_SERVER_CODE");
  });
});
