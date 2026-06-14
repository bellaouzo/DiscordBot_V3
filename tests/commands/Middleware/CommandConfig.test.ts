import { describe, expect, it } from "vitest";
import { Config, CommandConfigBuilder } from "@middleware/CommandConfig";

describe("CommandConfig", () => {
  it("builds configs through the fluent builder", () => {
    const config = CommandConfigBuilder.create()
      .guildOnly()
      .permissions("BanMembers", "KickMembers")
      .anyPermission("ManageGuild")
      .cooldownSeconds(5)
      .cooldownMinutes(1)
      .cooldownMs(500)
      .role("role-1")
      .hasModRole()
      .hasAdminRole()
      .owner()
      .requiredFeature("economy")
      .build();

    expect(config.guildOnly).toBe(true);
    expect(config.permissions?.required).toEqual(["ManageGuild"]);
    expect(config.permissions?.requireAny).toBe(true);
    expect(config.cooldown?.seconds).toBe(5);
    expect(config.role).toBe("role-1");
    expect(config.modRole).toBe(true);
    expect(config.adminRole).toBe(true);
    expect(config.owner).toBe(true);
    expect(config.requiredFeature).toBe("economy");
  });

  it("exposes convenience config helpers", () => {
    expect(Config.requirePermissions("BanMembers")).toEqual({
      permissions: { required: ["BanMembers"] },
    });
    expect(Config.requireAnyPermission("BanMembers", "KickMembers")).toEqual({
      permissions: {
        required: ["BanMembers", "KickMembers"],
        requireAny: true,
      },
    });
    expect(Config.requireRole("role-1")).toEqual({ role: "role-1" });
    expect(Config.requireOwner()).toEqual({ owner: true });
    expect(Config.cooldownSeconds(10)).toEqual({
      cooldown: { seconds: 10 },
    });
    expect(Config.utilityWithFeature("giveaways", 2)).toEqual({
      guildOnly: true,
      cooldown: { seconds: 2 },
      requiredFeature: "giveaways",
    });
  });
});
