import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "@commands";
import { Config } from "@middleware";
import { CreateAppealManager, EmbedFactory } from "@utilities";
import { HandleSubmit } from "@commands/Moderation/Appeal/AppealSubmitFlow";
import { HandleReview } from "@commands/Moderation/Appeal/AppealReviewFlow";

async function ExecuteAppeal(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const subcommand = interaction.options.getSubcommand(true);

  if (subcommand === "submit") {
    await HandleSubmit(interaction, context);
    return;
  }

  if (subcommand === "my") {
    await HandleMyAppeals(interaction, context);
    return;
  }

  if (subcommand === "review") {
    await HandleReview(interaction, context);
    return;
  }
}

async function HandleMyAppeals(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  if (!interaction.guild) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Only",
      description: "Appeal history can only be viewed inside a server.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }
  const guild = interaction.guild;

  const manager = CreateAppealManager({
    guildId: guild.id,
    userId: interaction.user.id,
    moderationDb: context.databases.moderationDb,
    userDb: context.databases.userDb,
    logger: context.logger,
  });

  const appeals = manager.ListAppeals();
  if (appeals.length === 0) {
    const embed = EmbedFactory.CreateWarning({
      title: "No Appeals",
      description: "You have not submitted any appeals in this guild.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const embed = EmbedFactory.Create({
    title: `Your Appeals in ${guild.name}`,
    description: `Showing ${Math.min(appeals.length, 10)} of ${appeals.length} appeals.`,
  });
  embed.addFields(
    appeals.slice(0, 10).map((appeal) => ({
      name: `#${appeal.id} — ${appeal.action_type.toUpperCase()}`,
      value: `Status: **${appeal.status.toUpperCase()}**\nTarget: ${
        appeal.action_ref ?? "n/a"
      }\nCreated: <t:${Math.floor(appeal.created_at / 1000)}:R>`,
      inline: false,
    }))
  );

  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    ephemeral: true,
  });
}


export const AppealCommand = CreateCommand({
  name: "appeal",
  description: "Submit and review moderation appeals",
  group: "moderation",
  config: Config.create().guildOnly().cooldownSeconds(10).build(),
  execute: ExecuteAppeal,
  configure: (builder) => {
    builder
      .addSubcommand((sub) =>
        sub
          .setName("submit")
          .setDescription("Start a guided moderation appeal")
          .addStringOption((option) =>
            option
              .setName("action")
              .setDescription("Optional: only appeal this action type")
              .setRequired(false)
              .addChoices(
                { name: "Warning", value: "warning" },
                { name: "Mute", value: "mute" },
                { name: "Ban", value: "ban" },
                { name: "Kick", value: "kick" }
              )
          )
      )
      .addSubcommand((sub) =>
        sub.setName("my").setDescription("View your submitted appeals")
      )
      .addSubcommand((sub) =>
        sub
          .setName("review")
          .setDescription("Resolve an appeal (staff)")
          .addIntegerOption((option) =>
            option
              .setName("appeal_id")
              .setDescription("Appeal ID to resolve")
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName("decision")
              .setDescription("Resolution decision")
              .setRequired(true)
              .addChoices(
                { name: "Approve", value: "approved" },
                { name: "Deny", value: "denied" }
              )
          )
          .addStringOption((option) =>
            option
              .setName("review_reason")
              .setDescription("Reason for approval or denial")
              .setRequired(false)
          )
      );
  },
});
