import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandleBalance } from "@systems/Economy/handlers/BalanceHandler";
import {
  createMockInteraction,
  createMockContext,
  createMockDatabaseSet,
} from "../../helpers";

describe("BalanceHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replies with balance embed for self when no user option", async () => {
    const interaction = createMockInteraction({
      guildId: "g1",
      user: { id: "u1" } as unknown as import("discord.js").User,
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.GetBalance).mockReturnValue({
      user_id: "u1",
      guild_id: "g1",
      balance: 250,
      updated_at: Date.now(),
    });
    const context = createMockContext({ databases });
    await HandleBalance(interaction, context);
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.any(Array),
        ephemeral: true,
      })
    );
    expect(databases.userDb.GetBalance).toHaveBeenCalledWith("u1", "g1");
  });

  it("replies with balance embed for target user when user option provided", async () => {
    const targetUser = { id: "u2" } as unknown as import("discord.js").User;
    const interaction = createMockInteraction({
      guildId: "g1",
      user: { id: "u1" } as unknown as import("discord.js").User,
      options: {
        getString: vi.fn(),
        getInteger: vi.fn(),
        getNumber: vi.fn(),
        getBoolean: vi.fn(),
        getUser: vi.fn().mockReturnValue(targetUser),
        getMember: vi.fn(),
        getChannel: vi.fn(),
        getRole: vi.fn(),
        getMentionable: vi.fn(),
        getAttachment: vi.fn(),
        getSubcommand: vi.fn(),
        getSubcommandGroup: vi.fn(),
      },
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.GetBalance).mockReturnValue({
      user_id: "u2",
      guild_id: "g1",
      balance: 500,
      updated_at: Date.now(),
    });
    const context = createMockContext({ databases });
    await HandleBalance(interaction, context);
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalled();
    expect(databases.userDb.GetBalance).toHaveBeenCalledWith("u2", "g1");
  });
});
