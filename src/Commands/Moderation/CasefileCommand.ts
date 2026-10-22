import { CreateCommand, CreateUserMenu } from "@commands";
import { HandleCasefileQuery } from "@commands/Moderation/Casefile/QueryFlow";

export const CasefileCommand = CreateCommand({
  name: "casefile",
  description: "View key moderation info for a user",
  group: "moderation",
  config: { access: "mod", cooldown: "5s" },
  execute: (interaction, context) =>
    HandleCasefileQuery(
      interaction,
      context,
      interaction.options.getUser("user", true),
    ),
  configure: (builder) => {
    builder.addUserOption((option) =>
      option.setName("user").setDescription("User to view").setRequired(true),
    );
  },
});

/** Right-click a user → Apps → Casefile. */
export const CasefileUserMenu = CreateUserMenu({
  name: "Casefile",
  command: CasefileCommand,
  execute: (interaction, context) =>
    HandleCasefileQuery(interaction, context, interaction.targetUser),
});
