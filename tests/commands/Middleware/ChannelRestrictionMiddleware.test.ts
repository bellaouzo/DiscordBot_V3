import {
  MessageFlags,
  PermissionFlagsBits,
  PermissionsBitField,
} from "discord.js";
import { describe, it, expect, vi } from "vitest";
import { ChannelRestrictionMiddleware } from "@middleware/ChannelRestrictionMiddleware";
import {
  createMockDatabaseSet,
  createMockInteraction,
  createMockMiddlewareContext,
} from "../../helpers";

const GuildMemberMock = vi.hoisted(() => class GuildMemberMock {});

vi.mock("discord.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("discord.js")>();
  return { ...actual, GuildMember: GuildMemberMock };
});

function createContext(options: {
  allowed: string[];
  channelId: string;
  parentId?: string;
  admin?: boolean;
  commandName?: string;
}) {
  const databases = createMockDatabaseSet();
  vi.mocked(databases.serverDb.ListCommandChannels).mockReturnValue(
    options.allowed,
  );

  const member = Object.assign(new GuildMemberMock(), {
    permissions: new PermissionsBitField(
      options.admin ? [PermissionFlagsBits.ManageGuild] : [],
    ),
    roles: { cache: { some: () => false } },
  });
  const interaction = createMockInteraction({
    user: { id: "user-1" },
    member: member as never,
  });
  Object.assign(interaction, {
    channelId: options.channelId,
    channel: {
      isThread: () => Boolean(options.parentId),
      parentId: options.parentId ?? null,
    },
  });

  return createMockMiddlewareContext({
    interaction,
    databases,
    command: {
      data: { name: options.commandName ?? "meme" },
      group: "fun",
      execute: vi.fn(),
    } as never,
  });
}

describe("ChannelRestrictionMiddleware", () => {
  it("calls next when the command has no restriction", async () => {
    const context = createContext({ allowed: [], channelId: "c1" });
    const next = vi.fn().mockResolvedValue(undefined);

    await ChannelRestrictionMiddleware.execute(context, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("calls next in an allowed channel and in its threads", async () => {
    const next = vi.fn().mockResolvedValue(undefined);

    await ChannelRestrictionMiddleware.execute(
      createContext({ allowed: ["c1"], channelId: "c1" }),
      next,
    );
    await ChannelRestrictionMiddleware.execute(
      createContext({ allowed: ["c1"], channelId: "thread-1", parentId: "c1" }),
      next,
    );

    expect(next).toHaveBeenCalledTimes(2);
  });

  it("lists the allowed channels when used elsewhere", async () => {
    const context = createContext({ allowed: ["c1", "c2"], channelId: "c9" });
    const next = vi.fn();

    await ChannelRestrictionMiddleware.execute(context, next);

    expect(next).not.toHaveBeenCalled();
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      context.interaction,
      expect.objectContaining({
        flags: MessageFlags.Ephemeral,
        embeds: [
          expect.objectContaining({
            description: expect.stringContaining("<#c1>, <#c2>"),
          }),
        ],
      }),
    );
  });

  it("lets admins use restricted commands anywhere", async () => {
    const context = createContext({
      allowed: ["c1"],
      channelId: "c9",
      admin: true,
    });
    const next = vi.fn().mockResolvedValue(undefined);

    await ChannelRestrictionMiddleware.execute(context, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("ignores restrictions on protected commands", async () => {
    const context = createContext({
      allowed: ["c1"],
      channelId: "c9",
      commandName: "help",
    });
    const next = vi.fn().mockResolvedValue(undefined);

    await ChannelRestrictionMiddleware.execute(context, next);

    expect(next).toHaveBeenCalledOnce();
  });
});
