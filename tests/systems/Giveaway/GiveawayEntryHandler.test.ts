import { describe, expect, it, vi, beforeEach } from "vitest";
import { ChannelType } from "discord.js";
import { RegisterGiveawayEntryHandler } from "@systems/Giveaway/GiveawayEntryHandler";
import { GiveawayManager } from "@systems/Giveaway/GiveawayManager";
import { createMockContext } from "../../helpers";

describe("GiveawayEntryHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupHandler(
    giveawayOverrides?: Partial<{
      ended: boolean;
      ends_at: number;
    }>,
  ) {
    const context = createMockContext();
    const databases = context.databases;
    const manager = new GiveawayManager("guild-1", databases.userDb);

    const giveaway = {
      id: 1,
      guild_id: "guild-1",
      channel_id: "ch-1",
      message_id: "msg-1",
      host_id: "host-1",
      prize: "Nitro",
      winner_count: 1,
      ends_at: Date.now() + 60_000,
      ended: false,
      ...giveawayOverrides,
    };

    vi.spyOn(manager, "GetGiveaway").mockReturnValue(giveaway as never);
    vi.spyOn(manager, "HasEntered").mockReturnValue(false);
    vi.spyOn(manager, "EnterGiveaway").mockReturnValue(undefined);
    vi.spyOn(manager, "GetEntryCount").mockReturnValue(3);

    const channel = {
      type: ChannelType.GuildText,
      messages: {
        fetch: vi.fn().mockResolvedValue({
          edit: vi.fn().mockResolvedValue(undefined),
        }),
      },
    };

    RegisterGiveawayEntryHandler({
      customId: "giveaway:msg-1:enter",
      expiresInMs: 60_000,
      manager,
      channel: channel as never,
      giveawayMessageId: "msg-1",
      context,
    });

    const registration = (
      context.responders.componentRouter.RegisterButton as ReturnType<
        typeof vi.fn
      >
    ).mock.calls[0][0];

    return { context, registration, manager, channel };
  }

  it("registers entry on first click", async () => {
    const { context, registration, manager } = setupHandler();
    const buttonInteraction = {
      user: { id: "user-1" },
      reply: vi.fn().mockResolvedValue(undefined),
    };

    await registration.handler(buttonInteraction);

    expect(manager.EnterGiveaway).toHaveBeenCalledWith(1, "user-1");
    expect(context.responders.buttonResponder.Reply).toHaveBeenCalledWith(
      buttonInteraction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: "Entered Giveaway" }),
        ]),
      }),
    );
  });

  it("leaves giveaway when user already entered", async () => {
    const { context, registration, manager } = setupHandler();
    vi.spyOn(manager, "HasEntered").mockReturnValue(true);
    vi.spyOn(manager, "LeaveGiveaway").mockReturnValue(undefined);
    vi.spyOn(manager, "GetEntryCount").mockReturnValue(2);

    const buttonInteraction = {
      user: { id: "user-1" },
      reply: vi.fn().mockResolvedValue(undefined),
    };

    await registration.handler(buttonInteraction);

    expect(manager.LeaveGiveaway).toHaveBeenCalledWith(1, "user-1");
    expect(context.responders.buttonResponder.Reply).toHaveBeenCalledWith(
      buttonInteraction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: "Left Giveaway" }),
        ]),
      }),
    );
  });

  it("replies when giveaway already ended", async () => {
    const { context, registration } = setupHandler({ ended: true });
    const buttonInteraction = {
      user: { id: "user-1" },
      reply: vi.fn().mockResolvedValue(undefined),
    };

    await registration.handler(buttonInteraction);

    expect(context.responders.buttonResponder.Reply).toHaveBeenCalledWith(
      buttonInteraction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: "Giveaway Ended" }),
        ]),
      }),
    );
  });

  it("finalizes expired giveaway on entry click", async () => {
    const { context, registration, manager } = setupHandler({
      ends_at: Date.now() - 1000,
    });
    vi.spyOn(manager, "FinalizeGiveaway").mockResolvedValue({
      winners: ["winner-1"],
      entryCount: 4,
    });

    const buttonInteraction = {
      user: { id: "user-1" },
      reply: vi.fn().mockResolvedValue(undefined),
    };

    await registration.handler(buttonInteraction);

    expect(manager.FinalizeGiveaway).toHaveBeenCalled();
    expect(context.responders.buttonResponder.Reply).toHaveBeenCalledWith(
      buttonInteraction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: "Giveaway Ended" }),
        ]),
      }),
    );
  });
});
