import { describe, expect, it } from "vitest";
import { digestSettingsSchema } from "./schema";

describe("digest settings limits", () => {
  it("fills every default", () => {
    const s = digestSettingsSchema.parse({});
    expect(s.refresh_cooldown_minutes).toBe(30);
    expect(s.daily_send_cap).toBe(20);
    expect(s.ask_per_ip_per_hour).toBe(10);
  });
  it("clamps values that would switch a safety limit off, instead of rejecting them", () => {
    const s = digestSettingsSchema.parse({ refresh_cooldown_minutes: 0, daily_send_cap: 100000, ask_per_ip_per_hour: 99999, send_per_ip_per_hour: 500, max_search_queries_per_run: 9999, lookback_days: 400 });
    expect(s.refresh_cooldown_minutes).toBe(5);
    expect(s.daily_send_cap).toBe(100);
    expect(s.ask_per_ip_per_hour).toBe(100);
    expect(s.send_per_ip_per_hour).toBe(20);
    expect(s.max_search_queries_per_run).toBe(100);
    expect(s.lookback_days).toBe(30);
  });
  it("keeps sensible values as they are", () => {
    const s = digestSettingsSchema.parse({ daily_send_cap: 40, refresh_cooldown_minutes: 60 });
    expect(s.daily_send_cap).toBe(40);
    expect(s.refresh_cooldown_minutes).toBe(60);
  });
});
