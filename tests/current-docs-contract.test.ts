import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const readme = read("README.md");
const todo = read("todo.md");
const manual = read("docs/PARAWALLET-REAL-USE-MANUAL.md");
const uxAudit = read("docs/UX-AUDIT-REMEDIATION-2026-08-29.md");
const closure = read("docs/RELEASE-CLOSURE-ACCEPTANCE-2026-08-30.md");
const index = read("docs/INDEX.md");

describe("current operating documentation contract", () => {
  it("separates the deployed backend from the next Apps Script target", () => {
    for (const document of [readme, todo, manual, closure]) {
      expect(document).toContain("2026.08.30-ocr-provider-v8");
    }
    expect(todo).toContain("2026.08.29-ux-ws3-v7");
    expect(uxAudit).toContain("2026.08.29-ux-ws3-v7");
    expect(manual).toContain("frontend UX remediation ชุด 1–7");
    expect(manual).not.toContain("backend D10 / frontend UX remediation ชุด 2");
  });

  it("keeps real-device acceptance visibly open and separate from automated verification", () => {
    expect(closure).toContain("Automated test ใช้ยืนยันสัญญาโค้ดเท่านั้น");
    expect(closure).toContain("ห้ามใช้แทนผลทดสอบบนมือถือจริง");
    expect(closure).toContain("| คนกรีด — journey ครบ | [ ]");
    expect(closure).toContain("| เจ้าของสวน — journey ครบ | [ ]");
    expect(todo).toContain("Do not mark a real-device item complete from automated tests alone");
  });

  it("makes the release-closure checklist discoverable and covers every open gate", () => {
    expect(index).toContain("RELEASE-CLOSURE-ACCEPTANCE-2026-08-30.md");
    expect(todo).toContain("docs/RELEASE-CLOSURE-ACCEPTANCE-2026-08-30.md");
    for (const required of ["มือถือคนกรีด", "มือถือเจ้าของสวน", "Failure journey", "หมุนเวียนความลับ", "เฝ้าดูเหตุขัดข้อง", "รักษาหลักฐาน"]) {
      expect(closure).toContain(required);
    }
  });
});
