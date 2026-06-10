import { ChatInputCommandInteraction, MessageFlags } from "discord.js";

import { CommandContext, CreateCommand } from "@commands";

import { Config } from "@middleware";

import { CreateAppealManager, EmbedFactory } from "@utilities";

import { HandleSubmit } from "@commands/Moderation/Appeal/AppealSubmitFlow";

async function ExecuteAppeal(
  interaction: ChatInputCommandInteraction,

  context: CommandContext,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand(true);

  if (subcommand === "submit") {
    await HandleSubmit(interaction, context);

    return;
  }

  if (subcommand === "my") {
    await HandleMyAppeals(interaction, context);
  }
}

async function HandleMyAppeals(
  interaction: ChatInputCommandInteraction,

  context: CommandContext,
): Promise<void> {
  const { interactionResponder } = context.responders;

  if (!interaction.guild) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Only",

      description: "Appeal history can only be viewed inside a server.",
    });

    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],

      flags: MessageFlags.Ephemeral,
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

      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  const embed = EmbedFactory.Create({
    title: `Your Appeals in ${guild.name}`,

    description: `Showing ${Math.min(appeals.length, 10)} of ${appeals.length} appeals.`,
  });

  const fields = await Promise.all(
    appeals.slice(0, 10).map(async (appeal) => {
      const validation = manager.ValidateTarget({
        actionType: appeal.action_type,

        actionRef: appeal.action_ref,
      });

      const targetContext =
        validation.target?.context ?? appeal.action_ref ?? "n/a";

      let statusLine = `Status: **${appeal.status.toUpperCase()}**`;

      if (appeal.status === "open" && appeal.review_channel_id) {
        statusLine += `\nReview: <#${appeal.review_channel_id}>`;
      }

      if (appeal.resolved_reason) {
        statusLine += `\nResolution: ${appeal.resolved_reason}`;
      }

      return {
        name: `#${appeal.id} — ${appeal.action_type.toUpperCase()}`,

        value: `${statusLine}\nTarget: ${targetContext}\nCreated: <t:${Math.floor(appeal.created_at / 1000)}:R>`,

        inline: false,
      };
    }),
  );

  embed.addFields(fields);

  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],

    flags: MessageFlags.Ephemeral,
  });
}

export const AppealCommand = CreateCommand({
  name: "appeal",

  description: "Submit and track moderation appeals",

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

                { name: "Kick", value: "kick" },
              ),
          ),
      )

      .addSubcommand((sub) =>
        sub.setName("my").setDescription("View your submitted appeals"),
      );
  },
});
