import { describe, expect, it } from "vitest";
import { DurationToMs, ResolveConfig } from "@middleware/CommandConfig";

describe("DurationToMs", () => {
  it("converts each unit", () => {
    expect(DurationToMs("250ms")).toBe(250);
    expect(DurationToMs("5s")).toBe(5000);
    expect(DurationToMs("2m")).toBe(120_000);
    expect(DurationToMs("1h")).toBe(3_600_000);
    expect(DurationToMs("1.5s")).toBe(1500);
  });

  it("rejects malformed durations", () => {
    expect(() => DurationToMs("5 seconds" as never)).toThrow(
      /Invalid duration/,
    );
  });
});

describe("ResolveConfig", () => {
  it("fills in defaults: guild only, everyone, no cooldown", () => {
    expect(ResolveConfig()).toEqual({
      access: "everyone",
      guildOnly: true,
      userPermissions: [],
      anyUserPermission: false,
      role: undefined,
      cooldownMs: 0,
      botPermissions: [],
      autoDefer: false,
      feature: undefined,
    });
  });

  it("resolves every field", () => {
    const resolved = ResolveConfig({
      access: "mod",
      dms: true,
      userPermissions: ["ManageGuild"],
      anyUserPermission: true,
      role: "role-1",
      cooldown: "5s",
      botPermissions: ["BanMembers"],
      autoDefer: "ephemeral",
      feature: "economy",
    });

    expect(resolved).toEqual({
      access: "mod",
      guildOnly: false,
      userPermissions: ["ManageGuild"],
      anyUserPermission: true,
      role: "role-1",
      cooldownMs: 5000,
      botPermissions: ["BanMembers"],
      autoDefer: { ephemeral: true },
      feature: "economy",
    });
  });

  it("lets later layers override earlier ones field by field", () => {
    const resolved = ResolveConfig(
      { access: "mod", cooldown: "5s", botPermissions: ["ManageRoles"] },
      { botPermissions: [], cooldown: false },
    );

    expect(resolved.access).toBe("mod");
    expect(resolved.botPermissions).toEqual([]);
    expect(resolved.cooldownMs).toBe(0);
  });

  it("treats autoDefer true as a public defer", () => {
    expect(ResolveConfig({ autoDefer: true }).autoDefer).toEqual({
      ephemeral: false,
    });
  });
});
