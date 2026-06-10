import { describe, expect, it, vi } from "vitest";
import { MessageFlags } from "discord.js";
import { StarboardCommand } from "@commands/Utility/StarboardCommand";
import {
  createMockInteraction,
  createMockContext,
  stubInteractionOptions,
} from "../../helpers";

describe("Feature about subcommands", () => {
  it("replies with a starboard feature guide", async () => {
    const interaction = createMockInteraction({ guildId: "guild-1" });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "about",
    });

    const context = createMockContext();

    await StarboardCommand.execute(interaction, context);

    expect(
      context.responders.interactionResponder.Reply,
    ).toHaveBeenCalledOnce();

    const payload = vi.mocked(context.responders.interactionResponder.Reply)
      .mock.calls[0][1];
    const embed = payload.embeds?.[0] as {
      title?: string;
      fields?: Array<{ name: string }>;
    };

    expect(embed?.title).toContain("Starboard");
    expect(embed?.fields?.some((field) => field.name === "How it works")).toBe(
      true,
    );
    expect(payload.flags).toBe(MessageFlags.Ephemeral);
  });
});
