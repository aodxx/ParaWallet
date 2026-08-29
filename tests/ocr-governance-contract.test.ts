import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const agents = read("AGENTS.md");
const canonical = read("docs/OCR-GEMINI-CANONICAL.md");
const backend = read("appsscript/Code.gs");
const frontend = [read("src/App.tsx"), read("src/api.ts"), read("src/ocr.ts")].join("\n");

describe("OCR multi-developer governance contract", () => {
  it("declares exactly one current OCR architecture for contributors", () => {
    expect(agents).toContain("docs/OCR-GEMINI-CANONICAL.md");
    expect(agents).toContain("appsscript/Code.gs");
    expect(canonical).toContain("This document is the only current design");
    expect(canonical).toContain("gemini-3.7-flash");
    expect(canonical).toContain("stateless Interactions API");
  });

  it("keeps all AI provider calls and credentials out of the browser", () => {
    expect(frontend).not.toContain("generativelanguage.googleapis.com");
    expect(frontend).not.toContain("vision.googleapis.com");
    expect(frontend).not.toContain("GEMINI_API_KEY");
    expect(backend).toContain("generativelanguage.googleapis.com/v1/interactions");
    expect(backend).toContain("vision.googleapis.com/v1/images:annotate");
  });

  it("labels the supplied images as references rather than real-bill acceptance", () => {
    expect(canonical).toContain("temporary reference images");
    expect(canonical).toContain("do not assert that a provider read the attached pixels");
    expect(canonical).toContain("Production recognition is “not yet certified.”");
  });

  it("requires deterministic and human safety gates", () => {
    expect(agents).toContain("verifies row sums, tare/net weight, DRC/dry weight, written total, and rounding");
    expect(agents).toContain("A Tapper must compare");
    expect(agents).toContain("An Owner must still review");
    expect(backend).toContain('throw new Error("OCR_HUMAN_VERIFICATION_REQUIRED")');
    expect(backend).toContain('throw new Error("RECEIPT_MATH_MISMATCH")');
  });
});
