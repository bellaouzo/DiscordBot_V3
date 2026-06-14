import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { CreateCommand } from "@commands";
import { Config } from "@middleware";
import { RequireGuild } from "@utilities";
import { ReplyWithFeatureAbout } from "@commands/Utility/FeatureAbout";
import { BuildHubPayload } from "@commands/Utility/Hub/HubComponents";
import {
  RegisterHubButtons,
  ResolveHubContext,
} from "@commands/Utility/Hub/HubRouting";

async function ExecuteHub(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder } = context.responders;
  const guild = RequireGuild(interaction);
  const hub = await ResolveHubContext(
    { guild, user: interaction.user, id: interaction.id },
    context,
  );

  if (!hub) {
    return;
  }

  const payload = BuildHubPayload(hub);

  RegisterHubButtons({
    context,
    hub,
    componentRouter: context.responders.componentRouter,
    buttonResponder: context.responders.buttonResponder,
  });

  await interactionResponder.Reply(interaction, {
    content: payload.content,
    embeds: payload.embeds,
    components: payload.components,
    flags: MessageFlags.Ephemeral,
  });
}

export const HubCommand = CreateCommand({
  name: "hub",
  description: "Quick-action dashboard for tickets, help, stats, and more",
  group: "utility",
  config: Config.utility(3),
  configure: (builder) => {
    builder
      .addSubcommand((sub) =>
        sub.setName("open").setDescription("Open the quick-action dashboard"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("about")
          .setDescription("Learn what the quick hub is and how to use it"),
      );
  },
  execute: async (interaction, context) => {
    const sub = interaction.options.getSubcommand(true);

    if (sub === "about") {
      await ReplyWithFeatureAbout(interaction, context, "hub");
      return;
    }

    await ExecuteHub(interaction, context);
  },
});
