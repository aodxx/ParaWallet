import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const readme = read("README.md");
const todo = read("todo.md");
const manual = read("docs/PARAWALLET-REAL-USE-MANUAL.md");
const uxAudit = read("docs/UX-AUDIT-REMEDIATION-2026-08-29.md");
const closure = read("docs/RELEASE-CLOSURE-ACCEPTANCE-2026-08-30.md");
const index = read("docs/INDEX.md");
const providerV10 = read("docs/OCR-PROVIDER-V10-PREDEPLOYMENT-SELF-TEST-2026-09-01.md");

describe("current operating documentation contract", () => {
  it("keeps the verified deployed backend and completed UX baseline current", () => {
    for (const document of [readme, todo, manual, uxAudit, closure]) {
      expect(document).toContain("2026.08.30-ocr-provider-v8");
    }
    expect(readme).toContain("| Backend deployed | `2026.08.30-ocr-provider-v8` |");
    expect(todo).toContain("[x] Deploy Apps Script `2026.08.30-ocr-provider-v8`");
    expect(todo).toContain("[ ] Smoke-test one authorized receipt");
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

  it("makes v10 and its provider self-test the single next backend target", () => {
    for (const document of [readme, todo, manual, closure]) {
      expect(document).toContain("2026.09.01-ocr-provider-v10");
    }
    expect(index).toContain("OCR-PROVIDER-V10-PREDEPLOYMENT-SELF-TEST-2026-09-01.md");
    expect(providerV10).toContain("testGeminiProviderConnection()");
    expect(providerV10).toContain("GEMINI_CONNECTION_OK");
    expect(providerV10).toContain("does not call Vision, Google Sheets, Google Drive");
    expect(todo).toContain("v9 was not deployed and is superseded by v10");
  });
});
