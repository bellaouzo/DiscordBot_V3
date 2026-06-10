import type { ChatInputCommandInteraction } from "discord.js";
import type { CommandContext } from "@commands";
import { CreateCommand } from "@commands";
import { Config } from "@middleware/CommandConfig";
import { HandleActivateRaidMode } from "@commands/Moderation/RaidMode/ActivateFlow";
import { HandleDeactivateRaidMode } from "@commands/Moderation/RaidMode/DeactivateFlow";
import { HandleRaidModeStatus } from "@commands/Moderation/RaidMode/StatusFlow";
import { ReplyWithFeatureAbout } from "@commands/Utility/FeatureAbout";

async function ExecuteRaidMode(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const sub = interaction.options.getSubcommand(true);

  if (sub === "on") {
    await HandleActivateRaidMode(interaction, context);
    return;
  }

  if (sub === "off") {
    await HandleDeactivateRaidMode(interaction, context);
    return;
  }

  if (sub === "status") {
    await HandleRaidModeStatus(interaction, context);
    return;
  }

  if (sub === "about") {
    await ReplyWithFeatureAbout(interaction, context, "raidmode");
  }
}

export const RaidModeCommand = CreateCommand({
  name: "raidmode",
  description: "Enable or disable raid protection",
  group: "moderation",
  config: Config.mod().build(),
  execute: ExecuteRaidMode,
  configure: (builder) => {
    builder
      .addSubcommand((sub) =>
        sub
          .setName("on")
          .setDescription("Enable raid mode with lockdown + slowmode")
          .addIntegerOption((option) =>
            option
              .setName("length")
              .setDescription("Duration length")
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("unit")
              .setDescription("Duration unit")
              .setRequired(true)
              .addChoices(
                { name: "seconds", value: "seconds" },
                { name: "minutes", value: "minutes" },
                { name: "hours", value: "hours" },
              ),
          )
          .addIntegerOption((option) =>
            option
              .setName("slowmode")
              .setDescription("Slowmode seconds to apply (default 10)"),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("off")
          .setDescription("Disable raid mode and restore state"),
      )
      .addSubcommand((sub) =>
        sub.setName("status").setDescription("Show raid mode status"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("about")
          .setDescription("Learn what raid mode is and when to use it"),
      );
  },
});
