import {
  MessageFlags,
  PermissionFlagsBits,
  PermissionsBitField,
} from "discord.js";
import { describe, it, expect, vi } from "vitest";
import { BotPermissionMiddleware } from "@middleware/BotPermissionMiddleware";
import {
  createMockInteraction,
  createMockMiddlewareContext,
} from "../../helpers";
import type { CommandConfig } from "@middleware";

function createContext(options: {
  appPermissions: bigint[] | null;
  config: CommandConfig;
  subcommand?: string;
}) {
  const interaction = createMockInteraction({
    user: { id: "user-1" },
    options: {
      getSubcommand: vi.fn().mockReturnValue(options.subcommand ?? null),
    },
  });
  Object.assign(interaction, {
    appPermissions:
      options.appPermissions === null
        ? null
        : new PermissionsBitField(options.appPermissions),
  });
  return createMockMiddlewareContext({ interaction, config: options.config });
}

describe("BotPermissionMiddleware", () => {
  it("calls next when the bot has every required permission", async () => {
    const context = createContext({
      appPermissions: [PermissionFlagsBits.BanMembers],
      config: { botPermissions: ["BanMembers"] },
    });
    const next = vi.fn().mockResolvedValue(undefined);

    await BotPermissionMiddleware.execute(context, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("names the missing permissions and stops the chain", async () => {
    const context = createContext({
      appPermissions: [PermissionFlagsBits.ManageMessages],
      config: {
        botPermissions: ["ManageMessages", "ReadMessageHistory"],
      },
    });
    const next = vi.fn();

    await BotPermissionMiddleware.execute(context, next);

    expect(next).not.toHaveBeenCalled();
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      context.interaction,
      expect.objectContaining({
        flags: MessageFlags.Ephemeral,
        embeds: [
          expect.objectContaining({
            description: expect.stringContaining("Read Message History"),
          }),
        ],
      }),
    );
  });

  it("calls next when a subcommand override clears the requirement", async () => {
    const context = createContext({
      appPermissions: [],
      config: { botPermissions: [] },
    });
    const next = vi.fn().mockResolvedValue(undefined);

    await BotPermissionMiddleware.execute(context, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("calls next when Discord sent no app permissions", async () => {
    const context = createContext({
      appPermissions: null,
      config: { botPermissions: ["BanMembers"] },
    });
    const next = vi.fn().mockResolvedValue(undefined);

    await BotPermissionMiddleware.execute(context, next);

    expect(next).toHaveBeenCalledOnce();
  });
});
