import { describe, expect, it, vi } from "vitest";
import { MessageFlags, type Guild, type User } from "discord.js";
import {
  createMockContext,
  createMockInteraction,
  stubInteractionOptions,
} from "../helpers";
import { TicketCommand } from "@commands/Utility/TicketCommand";

function GetTopLevelSubcommandNames(): string[] {
  const json = TicketCommand.data.toJSON();
  return (json.options ?? [])
    .filter((option) => option.type === 1)
    .map((option) => option.name);
}

function GetConfigSubcommandNames(): string[] {
  const json = TicketCommand.data.toJSON();
  const configGroup = (json.options ?? []).find(
    (option) => option.type === 2 && option.name === "config",
  );
  return (configGroup?.options ?? [])
    .filter((option) => option.type === 1)
    .map((option) => option.name);
}

describe("TicketCommand structure", () => {
  it("exposes the reduced button-first subcommand surface", () => {
    expect(TicketCommand.data.name).toBe("ticket");
    expect(GetTopLevelSubcommandNames()).toEqual([
      "open",
      "panel",
      "list",
      "transcript",
      "reopen",
      "tag",
    ]);
    expect(GetConfigSubcommandNames()).toEqual([
      "list",
      "add",
      "edit",
      "remove",
    ]);
  });

  it("does not expose removed slash-only subcommands", () => {
    const names = GetTopLevelSubcommandNames();
    expect(names).not.toContain("create");
    expect(names).not.toContain("queue");
    expect(names).not.toContain("claim");
    expect(names).not.toContain("close");
    expect(names).not.toContain("add");
    expect(names).not.toContain("remove");
    expect(names).not.toContain("config");
  });

  it("adds list scope option for server queue", () => {
    const json = TicketCommand.data.toJSON();
    const listOption = (json.options ?? []).find(
      (option) => option.type === 1 && option.name === "list",
    );
    const scopeOption = listOption?.options?.find(
      (option) => option.name === "scope",
    );
    expect(scopeOption).toBeDefined();
    expect(scopeOption?.choices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "mine" }),
        expect.objectContaining({ value: "server" }),
      ]),
    );
  });

  it("keeps config list free of category mutation options", () => {
    const json = TicketCommand.data.toJSON();
    const configGroup = (json.options ?? []).find(
      (option) => option.type === 2 && option.name === "config",
    );
    const listSubcommand = configGroup?.options?.find(
      (option) => option.type === 1 && option.name === "list",
    );
    expect(listSubcommand?.options ?? []).toHaveLength(0);
  });
});

describe("TicketCommand behavior", () => {
  it("opens ticket category picker on open subcommand success", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1", name: "Test Guild" } as unknown as Guild,
      user: { id: "user-1", username: "UserOne" } as unknown as User,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "open",
      getSubcommandGroup: () => null,
    });

    const context = createMockContext();
    await TicketCommand.execute(interaction, context);

    expect(context.responders.interactionResponder.Defer).toHaveBeenCalledWith(
      interaction,
      true,
    );
    expect(context.responders.interactionResponder.Edit).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: "🎫 Open a Ticket",
          }),
        ]),
        components: expect.any(Array),
      }),
    );
    expect(
      context.responders.selectMenuRouter.RegisterSelectMenu,
    ).toHaveBeenCalled();
  });

  it("blocks server queue list for non-staff members", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1", name: "Test Guild" } as unknown as Guild,
      member: {
        permissions: { has: vi.fn().mockReturnValue(false) },
        roles: { cache: { some: vi.fn().mockReturnValue(false) } },
      } as never,
      user: { id: "user-1", username: "UserOne" } as unknown as User,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "list",
      getSubcommandGroup: () => null,
      getString: (name) => (name === "scope" ? "server" : null),
    });

    const context = createMockContext();
    await TicketCommand.execute(interaction, context);

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        flags: MessageFlags.Ephemeral,
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: "Permission Denied",
          }),
        ]),
      }),
    );
  });
});
