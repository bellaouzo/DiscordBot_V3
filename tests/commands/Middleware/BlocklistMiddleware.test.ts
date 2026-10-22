import { MessageFlags } from "discord.js";
import { describe, it, expect, vi } from "vitest";
import {
  BlocklistMiddleware,
  FindBlocklistMatch,
} from "@middleware/BlocklistMiddleware";
import {
  createMockAppConfig,
  createMockDatabaseSet,
  createMockMiddlewareContext,
} from "../../helpers";

function Entry(target_type: "user" | "guild", target_id: string) {
  return {
    target_type,
    target_id,
    reason: null,
    created_by: "owner",
    created_at: 0,
  };
}

describe("BlocklistMiddleware", () => {
  it("calls next when neither the user nor the guild is blocked", async () => {
    const context = createMockMiddlewareContext();
    const next = vi.fn().mockResolvedValue(undefined);

    await BlocklistMiddleware.execute(context, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("replies ephemerally and stops a blocked user", async () => {
    const databases = createMockDatabaseSet();
    vi.mocked(databases.serverDb.GetBlocklistEntry).mockImplementation(
      (type, id) =>
        type === "user" && id === "user-1" ? Entry(type, id) : null,
    );
    const context = createMockMiddlewareContext({ databases });
    const next = vi.fn();

    await BlocklistMiddleware.execute(context, next);

    expect(next).not.toHaveBeenCalled();
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      context.interaction,
      expect.objectContaining({ flags: MessageFlags.Ephemeral }),
    );
  });

  it("blocks every user in a blocked guild", () => {
    const databases = createMockDatabaseSet();
    vi.mocked(databases.serverDb.GetBlocklistEntry).mockImplementation(
      (type, id) => (type === "guild" ? Entry(type, id) : null),
    );

    const match = FindBlocklistMatch({
      userId: "user-1",
      guildId: "guild-1",
      serverDb: databases.serverDb,
      appConfig: createMockAppConfig(),
    });

    expect(match?.entry.target_type).toBe("guild");
  });

  it("never blocks bot owners", () => {
    const databases = createMockDatabaseSet();
    vi.mocked(databases.serverDb.GetBlocklistEntry).mockImplementation(
      (type, id) => Entry(type, id),
    );
    const appConfig = createMockAppConfig();

    const match = FindBlocklistMatch({
      userId: "owner-1",
      guildId: "guild-1",
      serverDb: databases.serverDb,
      appConfig: {
        ...appConfig,
        discord: { ...appConfig.discord, ownerIds: ["owner-1"] },
      },
    });

    expect(match).toBeNull();
  });
});
