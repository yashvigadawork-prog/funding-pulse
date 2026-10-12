import { describe, expect, it } from "vitest";
import { chooseDealDate, roundupEndFromTitle } from "./dates";

describe("roundupEndFromTitle", () => {
  it("reads 'Oct 5 - Oct 10'", () => {
    expect(roundupEndFromTitle("Funding and acquisitions in Indian startups this week: Oct 5 - Oct 10", new Date("2026-10-12T04:00:00Z"))).toBe("2026-10-10");
  });
  it("reads 'September 28 to October 3'", () => {
    expect(roundupEndFromTitle("Weekly funding report September 28 to October 3", new Date("2026-10-05T04:00:00Z"))).toBe("2026-10-03");
  });
  it("returns null when there is no range", () => {
    expect(roundupEndFromTitle("Weekly funding roundup", new Date())).toBeNull();
  });
});

describe("chooseDealDate", () => {
  const today = new Date("2026-10-14T06:00:00Z");
  it("trusts a believable stated date", () => {
    expect(chooseDealDate({ statedOn: "2026-10-08", publishedAt: new Date("2026-10-09T05:00:00Z"), title: "x", kind: "article", today })).toBe("2026-10-08");
  });
  it("ignores dates in the future or far in the past", () => {
    expect(chooseDealDate({ statedOn: "2026-12-01", publishedAt: new Date("2026-10-09T05:00:00Z"), title: "x", kind: "article", today })).toBe("2026-10-09");
    expect(chooseDealDate({ statedOn: "2025-01-01", publishedAt: new Date("2026-10-09T05:00:00Z"), title: "x", kind: "article", today })).toBe("2026-10-09");
  });
  it("files a Monday roundup under the previous Sunday", () => {
    expect(chooseDealDate({ statedOn: null, publishedAt: new Date("2026-10-12T04:00:00Z"), title: "Weekly funding roundup", kind: "roundup", today })).toBe("2026-10-11");
  });
  it("uses the title's range for roundups", () => {
    expect(chooseDealDate({ statedOn: null, publishedAt: new Date("2026-10-12T04:00:00Z"), title: "Funding in Indian startups this week Oct 5 - Oct 10", kind: "roundup", today })).toBe("2026-10-10");
  });
});
