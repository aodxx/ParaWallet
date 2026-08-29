import { describe, expect, it } from "vitest";
import { createSystemStatus, idleSystemStatus, isErrorStatus, shouldShowStatus } from "../src/systemStatus";

describe("central system status contract", () => {
  it("creates a complete typed status with safe defaults", () => {
    expect(createSystemStatus("action", "success", "บันทึกแล้ว", "ข้อมูลพร้อมใช้งาน")).toEqual({
      kind: "success",
      scope: "action",
      title: "บันทึกแล้ว",
      detail: "ข้อมูลพร้อมใช้งาน",
      nextAction: "",
      retryable: false,
      dismissible: false,
      updatedAt: "",
    });
  });

  it("hides idle and empty states while exposing actionable failures", () => {
    expect(shouldShowStatus(idleSystemStatus("connection"))).toBe(false);
    expect(shouldShowStatus(createSystemStatus("connection", "empty", "ยังไม่มีข้อมูล", ""))).toBe(false);
    expect(shouldShowStatus(createSystemStatus("connection", "offline", "ออฟไลน์", "ใช้ข้อมูลล่าสุด"))).toBe(true);
    expect(isErrorStatus(createSystemStatus("authentication", "auth_error", "เข้าสู่ระบบไม่สำเร็จ", "ลองใหม่"))).toBe(true);
  });

  it("requires retry and dismiss behavior to be opted into explicitly", () => {
    const status = createSystemStatus("connection", "api_error", "เชื่อมต่อไม่สำเร็จ", "ตรวจอินเทอร์เน็ต", {
      nextAction: "ลองอีกครั้ง",
      retryable: true,
      dismissible: true,
      updatedAt: "2026-08-29T00:00:00.000Z",
    });
    expect(status).toMatchObject({ retryable: true, dismissible: true, nextAction: "ลองอีกครั้ง", updatedAt: "2026-08-29T00:00:00.000Z" });
  });
});
