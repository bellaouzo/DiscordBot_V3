import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Guild, User } from "discord.js";
import { MuteCommand } from "@commands/Moderation/MuteCommand";
import {
  createMockContext,
  createMockInteraction,
  createMockDatabaseSet,
  stubInteractionOptions,
} from "../../helpers";

describe("MuteCommand behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replies with invalid duration when duration exceeds limit", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1" } as unknown as Guild,
      user: { id: "mod-1" } as unknown as User,
      client: { user: { id: "bot-1" } },
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "set",
      getUser: () => ({ id: "target-1", username: "Target" }),
      getInteger: () => 30,
      getString: (name: string) =>
        name === "unit" ? "days" : name === "reason" ? "spam" : null,
      getBoolean: () => false,
    });
    const context = createMockContext();
    await MuteCommand.execute(interaction, context);
    const payload = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1];
    const embed = payload.embeds[0];
    const title = embed.data?.title ?? embed.title;
    expect(title).toBe("Invalid Duration");
  });

  it("adds temp mute action on successful set", async () => {
    const timeout = vi.fn().mockResolvedValue(undefined);
    const targetMember = {
      id: "target-1",
      moderatable: true,
      timeout,
    };
    const interaction = createMockInteraction({
      guild: {
        id: "guild-1",
        members: {
          cache: { get: vi.fn().mockReturnValue(undefined) },
          fetch: vi.fn().mockResolvedValue(targetMember),
        },
      } as unknown as Guild,
      user: { id: "mod-1" } as unknown as User,
      client: { user: { id: "bot-1" } },
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "set",
      getUser: () => ({ id: "target-1", username: "Target" }),
      getInteger: () => 10,
      getString: (name: string) =>
        name === "unit" ? "minutes" : name === "reason" ? "spam" : null,
      getBoolean: () => false,
    });
    const databases = createMockDatabaseSet();
    const context = createMockContext({ databases });
    await MuteCommand.execute(interaction, context);
    expect(timeout).toHaveBeenCalled();
    expect(databases.moderationDb.AddTempAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "mute",
        user_id: "target-1",
        moderator_id: "mod-1",
      }),
    );
    expect(context.responders.interactionResponder.WithAction).toHaveBeenCalled();
  });
});
