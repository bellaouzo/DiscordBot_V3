import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AutocompleteInteraction,
  Guild,
  GuildMember,
  ModalSubmitInteraction,
  User,
} from "discord.js";
import { TagCommand } from "@commands/Utility/TagCommand";
import type { CustomTag } from "@database";
import {
  createMockContext,
  createMockDatabaseSet,
  createMockInteraction,
  stubInteractionOptions,
} from "../../helpers";

function Member(isModerator: boolean) {
  return {
    roles: { cache: { some: vi.fn(() => false) } },
    permissions: { has: vi.fn(() => isModerator) },
  };
}

function Interaction(options: {
  subcommand: string;
  name?: string;
  moderator?: boolean;
}) {
  const interaction = createMockInteraction({
    guild: { id: "g1", name: "Cafe", memberCount: 50 } as unknown as Guild,
    user: { id: "u1" } as unknown as User,
    member: Member(options.moderator ?? false) as unknown as GuildMember,
  });
  Object.assign(interaction, { channelId: "c1", showModal: vi.fn() });
  stubInteractionOptions(interaction, {
    getSubcommand: () => options.subcommand,
    getString: () => options.name ?? null,
  });
  return interaction;
}

const TAG: CustomTag = {
  id: 1,
  guild_id: "g1",
  name: "rules",
  content: "Hi {user}, read the rules of {server}",
  created_by: "m1",
  uses: 0,
  created_at: 0,
  updated_at: 0,
};

function FirstReply(context: ReturnType<typeof createMockContext>) {
  return vi.mocked(context.responders.interactionResponder.Reply).mock
    .calls[0][1] as {
    content?: string;
    allowedMentions?: unknown;
    embeds?: Array<{ title: string }>;
  };
}

describe("TagCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts a rendered tag without pinging anyone else and counts the use", async () => {
    const databases = createMockDatabaseSet();
    vi.mocked(databases.serverDb.GetCustomTag).mockReturnValue(TAG);
    const context = createMockContext({ databases });

    await TagCommand.execute(
      Interaction({ subcommand: "show", name: "Rules" }),
      context,
    );

    expect(databases.serverDb.GetCustomTag).toHaveBeenCalledWith("g1", "rules");
    expect(FirstReply(context)).toMatchObject({
      content: "Hi <@u1>, read the rules of Cafe",
      allowedMentions: { parse: [], users: ["u1"] },
    });
    expect(databases.serverDb.IncrementCustomTagUses).toHaveBeenCalledWith(
      "g1",
      "rules",
    );
  });

  it("explains when a tag does not exist", async () => {
    const databases = createMockDatabaseSet();
    vi.mocked(databases.serverDb.GetCustomTag).mockReturnValue(null);
    const context = createMockContext({ databases });

    await TagCommand.execute(
      Interaction({ subcommand: "show", name: "nope" }),
      context,
    );

    expect(FirstReply(context).embeds?.[0].title).toBe("Tag Not Found");
  });

  it("only lets moderators create tags", async () => {
    const context = createMockContext();
    const interaction = Interaction({ subcommand: "create", name: "faq" });

    await TagCommand.execute(interaction, context);

    expect(FirstReply(context).embeds?.[0].title).toBe("Permission Denied");
    expect(interaction.showModal).not.toHaveBeenCalled();
  });

  it("rejects invalid names before opening the modal", async () => {
    const context = createMockContext();
    const interaction = Interaction({
      subcommand: "create",
      name: "bad name!",
      moderator: true,
    });

    await TagCommand.execute(interaction, context);

    expect(FirstReply(context).embeds?.[0].title).toBe("Invalid Name");
    expect(interaction.showModal).not.toHaveBeenCalled();
  });

  it("creates a tag from the modal content", async () => {
    const databases = createMockDatabaseSet();
    vi.mocked(databases.serverDb.GetCustomTag).mockReturnValue(null);
    vi.mocked(databases.serverDb.CountCustomTags).mockReturnValue(0);
    const context = createMockContext({ databases });
    const interaction = Interaction({
      subcommand: "create",
      name: "FAQ",
      moderator: true,
    });

    await TagCommand.execute(interaction, context);

    expect(interaction.showModal).toHaveBeenCalled();
    const registration = vi.mocked(context.responders.modalRouter.RegisterModal)
      .mock.calls[0][0];
    expect(registration.ownerId).toBe("u1");

    const modal = {
      fields: { getTextInputValue: () => "  Ask in #help  " },
      reply: vi.fn(),
    } as unknown as ModalSubmitInteraction;
    await registration.handler(modal);

    expect(databases.serverDb.CreateCustomTag).toHaveBeenCalledWith({
      guild_id: "g1",
      name: "faq",
      content: "Ask in #help",
      created_by: "u1",
    });
    expect(modal.reply).toHaveBeenCalled();
  });

  it("suggests matching tag names in autocomplete", async () => {
    const databases = createMockDatabaseSet();
    vi.mocked(databases.serverDb.SearchCustomTagNames).mockReturnValue([
      "rules",
      "roles",
    ]);
    const context = createMockContext({ databases });
    const respond = vi.fn();
    const interaction = {
      guildId: "g1",
      options: { getFocused: () => "r" },
      respond,
    } as unknown as AutocompleteInteraction;

    await TagCommand.autocomplete?.(interaction, context);

    expect(databases.serverDb.SearchCustomTagNames).toHaveBeenCalledWith(
      "g1",
      "r",
      25,
    );
    expect(respond).toHaveBeenCalledWith([
      { name: "rules", value: "rules" },
      { name: "roles", value: "roles" },
    ]);
  });
});
