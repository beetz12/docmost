import { describe, expect, it } from "vitest";
import { parseJournalDateQuery } from "./journal-date-query";

// Friday 6 November 2026, local time
const NOW = new Date(2026, 10, 6, 15, 30);
const first = (q: string) => parseJournalDateQuery(q, NOW)[0]?.date;

describe("parseJournalDateQuery", () => {
  it("empty query and today", () => {
    expect(first("")).toBe("2026-11-06");
    expect(first("today")).toBe("2026-11-06");
    expect(first("tod")).toBe("2026-11-06");
  });

  it("tomorrow and yesterday, with fuzzy prefixes", () => {
    expect(first("tomorrow")).toBe("2026-11-07");
    expect(first("tom")).toBe("2026-11-07");
    expect(first("yesterday")).toBe("2026-10-05".replace("10-05", "11-05"));
    expect(first("yest")).toBe("2026-11-05");
    expect(first("ye")).toBe("2026-11-05");
  });

  it("last / next mean the same weekday last / next week", () => {
    expect(first("last")).toBe("2026-10-30");
    expect(first("next")).toBe("2026-11-13");
  });

  it("last / next with a weekday", () => {
    expect(first("last mon")).toBe("2026-10-26");
    expect(first("next fri")).toBe("2026-11-13");
  });

  it("weekday name is that weekday this week (Monday start)", () => {
    expect(first("monday")).toBe("2026-11-02");
    expect(first("sun")).toBe("2026-11-08");
    expect(first("wed")).toBe("2026-11-04");
  });

  it("month name with or without a day", () => {
    expect(first("mar 5")).toBe("2026-03-05");
    expect(first("5 mar")).toBe("2026-03-05");
    expect(first("march")).toBe("2026-03-01");
    expect(first("dec 25")).toBe("2026-12-25");
    expect(first("feb 30")).toBeUndefined();
  });

  it("ISO dates", () => {
    expect(first("2026-01-02")).toBe("2026-01-02");
  });

  it("ambiguous prefixes return several suggestions, best first", () => {
    const r = parseJournalDateQuery("to", NOW).map((s) => s.date);
    expect(r[0]).toBe("2026-11-06");
    expect(r).toContain("2026-11-07");
  });

  it("non-date text gives nothing", () => {
    expect(parseJournalDateQuery("meeting notes", NOW)).toEqual([]);
    expect(parseJournalDateQuery("x", NOW)).toEqual([]);
  });
});
