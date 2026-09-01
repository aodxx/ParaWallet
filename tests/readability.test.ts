import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../src/readability.css", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");

function luminance(hex: string) {
  const channels = hex.match(/[a-f\d]{2}/gi)?.map((value) => Number.parseInt(value, 16) / 255) ?? [];
  const [red, green, blue] = channels.map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground: string, background: string) {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

describe("outdoor mobile readability", () => {
  it("loads the readability layer after the legacy visual system", () => {
    expect(main.indexOf('import "./readability.css"')).toBeGreaterThan(main.indexOf('import "./styles.css"'));
  });

  it("keeps critical mobile copy above the old 10–12 pixel scale", () => {
    expect(css).toContain("body {\n    font-size: 16px");
    expect(css).toContain(".metric small { font-size: 13px");
    expect(css).toContain(".data-row span { font-size: 14px");
    expect(css).toContain(".form-grid textarea { font-size: 16px");
    expect(css).toContain(".financial-proof small { min-height: auto; font-size: 13px");
    expect(css).toContain(".receipt-scan-status small,");
  });

  it("meets WCAG AA contrast for core light-surface and status colors", () => {
    expect(contrast("526554", "ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("543b1f", "dda15e")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("1f6634", "dff2e2")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("744a0e", "fff0c7")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("943f2d", "ffe5da")).toBeGreaterThanOrEqual(4.5);
  });
});
