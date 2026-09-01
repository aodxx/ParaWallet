import { describe, expect, it } from "vitest";
import { dateToday, formatThaiDateTime, monthStartToday } from "../src/date";

describe("Thailand financial dates", () => {
  it("uses Bangkok business date instead of UTC near midnight", () => {
    const instant = new Date("2026-08-31T18:30:00.000Z");
    expect(dateToday(instant)).toBe("2026-09-01");
    expect(monthStartToday(instant)).toBe("2026-09-01");
  });

  it("renders a date-only value without shifting it across time zones", () => {
    const formatted = formatThaiDateTime("2026-08-31");
    expect(formatted).toContain("31");
    expect(formatted).not.toContain("30");
    expect(formatted).not.toContain("น.");
  });
});
