import { describe, it, expect, vi } from "vitest";
import {
  CreateEmptySettings,
  ResolveExistingChannelId,
  SanitizeGuildSettings,
} from "@systems/Setup/state";

describe("Setup state", () => {
  it("CreateEmptySettings returns settings with guild_id and null ids", () => {
    const result = CreateEmptySettings("g1");
    expect(result.guild_id).toBe("g1");
    expect(result.admin_role_ids).toEqual([]);
    expect(result.mod_role_ids).toEqual([]);
    expect(result.ticket_category_id).toBeNull();
    expect(result.command_log_channel_id).toBeNull();
    expect(result.announcement_channel_id).toBeNull();
    expect(result.delete_log_channel_id).toBeNull();
    expect(result.production_log_channel_id).toBeNull();
    expect(result.welcome_channel_id).toBeNull();
    expect(result.created_at).toBeDefined();
    expect(result.updated_at).toBeDefined();
  });

  it("ResolveExistingChannelId returns null when channelId is null", async () => {
    const result = await ResolveExistingChannelId(null, null, 4);
    expect(result).toBeNull();
  });

  it("ResolveExistingChannelId returns null when guild is null", async () => {
    const result = await ResolveExistingChannelId(null, "ch1", 4);
    expect(result).toBeNull();
  });

  it("ResolveExistingChannelId returns channelId when guild has channel of expected type", async () => {
    const guild = {
      channels: {
        fetch: vi.fn().mockResolvedValue({
          id: "ch1",
          type: 4,
        }),
      },
    };
    const result = await ResolveExistingChannelId(
      guild as never,
      "ch1",
      4 as never
    );
    expect(result).toBe("ch1");
    expect(guild.channels.fetch).toHaveBeenCalledWith("ch1");
  });

  it("ResolveExistingChannelId returns null when channel type does not match", async () => {
    const guild = {
      channels: {
        fetch: vi.fn().mockResolvedValue({
          id: "ch1",
          type: 0,
        }),
      },
    };
    const result = await ResolveExistingChannelId(
      guild as never,
      "ch1",
      4 as never
    );
    expect(result).toBeNull();
  });

  it("SanitizeGuildSettings resolves channel ids and returns merged settings", async () => {
    const guild = {
      channels: {
        fetch: vi.fn().mockResolvedValue({ id: "ch1", type: 4 }),
      },
    };
    const settings = CreateEmptySettings("g1");
    const result = await SanitizeGuildSettings(guild as never, settings);
    expect(result.guild_id).toBe("g1");
    expect(result.ticket_category_id).toBeNull();
    expect(result.command_log_channel_id).toBeNull();
  });
});
