import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Guild, User } from "discord.js";
import { BanCommand } from "@commands/Moderation/BanCommand";
import {
  createMockContext,
  createMockInteraction,
  createMockDatabaseSet,
  stubInteractionOptions,
} from "../../helpers";

describe("BanCommand behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replies with invalid duration when length and unit mismatch", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1", bans: { create: vi.fn() } } as unknown as Guild,
      user: { id: "mod-1" } as unknown as User,
    });
    stubInteractionOptions(interaction, {
      getUser: () => null,
      getString: (name: string) =>
        name === "user_id" ? null : name === "unit" ? null : "reason",
      getInteger: () => 5,
      getBoolean: () => false,
    });
    const context = createMockContext();
    await BanCommand.execute(interaction, context);
    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.title).toBe("Invalid Duration");
  });

  it("replies with missing user when no target provided", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1", bans: { create: vi.fn() } } as unknown as Guild,
      user: { id: "mod-1" } as unknown as User,
    });
    stubInteractionOptions(interaction, {
      getUser: () => null,
      getString: (name: string) => (name === "reason" ? "reason" : null),
      getInteger: () => null,
      getBoolean: () => false,
    });
    const context = createMockContext();
    await BanCommand.execute(interaction, context);
    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.title).toBe("Missing User");
  });

  it("creates ban and temp action on timed ban success", async () => {
    const createBan = vi.fn().mockResolvedValue(undefined);
    const bannableMember = { bannable: true, id: "target-id" };
    const interaction = createMockInteraction({
      guild: {
        id: "guild-1",
        bans: { create: createBan },
        members: {
          cache: { get: vi.fn().mockReturnValue(undefined) },
          fetch: vi.fn().mockResolvedValue(bannableMember),
        },
      } as unknown as Guild,
      user: { id: "mod-1" } as unknown as User,
    });
    stubInteractionOptions(interaction, {
      getUser: () => ({ id: "target-id", tag: "Target#0001" }),
      getString: (name: string) =>
        name === "unit" ? "hours" : name === "reason" ? "spam" : null,
      getInteger: () => 2,
      getBoolean: () => false,
    });
    const databases = createMockDatabaseSet();
    const context = createMockContext({ databases });
    await BanCommand.execute(interaction, context);
    expect(createBan).toHaveBeenCalledWith("target-id", { reason: "spam" });
    expect(databases.moderationDb.AddModerationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ban", user_id: "target-id" }),
    );
    expect(databases.moderationDb.AddTempAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ban", user_id: "target-id" }),
    );
    expect(
      context.responders.interactionResponder.WithAction,
    ).toHaveBeenCalled();
  });
});
