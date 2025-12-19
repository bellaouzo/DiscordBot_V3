import {
  ChatInputCommandInteraction,
  ActivityType,
  PresenceData,
  PresenceStatusData,
  type ActivitiesOptions,
} from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import { Config } from "@middleware";
import { EmbedFactory } from "@utilities";

type ActivityKind =
  | "playing"
  | "listening"
  | "watching"
  | "competing"
  | "streaming";

const sanitizeStatus = (
  status?: PresenceStatusData | string | null
): PresenceStatusData => {
  if (
    status === "online" ||
    status === "idle" ||
    status === "dnd" ||
    status === "invisible"
  ) {
    return status;
  }
  return "online";
};

function mapActivityType(kind: ActivityKind): ActivityType {
  switch (kind) {
    case "listening":
      return ActivityType.Listening;
    case "watching":
      return ActivityType.Watching;
    case "competing":
      return ActivityType.Competing;
    case "streaming":
      return ActivityType.Streaming;
    default:
      return ActivityType.Playing;
  }
}

async function HandleStatus(
  interaction: ChatInputCommandInteraction,
  status: PresenceStatusData
): Promise<void> {
  if (!interaction.client.user) {
    throw new Error("Client user unavailable.");
  }

  const safeStatus = sanitizeStatus(status);
  const presence: PresenceData = {
    status: safeStatus,
  };

  await interaction.client.user.setPresence(presence);
}

async function HandleActivity(
  interaction: ChatInputCommandInteraction,
  options: {
    name: string;
    kind: ActivityKind;
    url?: string | null;
  }
): Promise<void> {
  if (!interaction.client.user) {
    throw new Error("Client user unavailable.");
  }

  const status = sanitizeStatus(interaction.client.user.presence?.status);
  const activityType = mapActivityType(options.kind);
  const activities: ActivitiesOptions[] = [
    {
      name: options.name,
      type: activityType,
      url:
        activityType === ActivityType.Streaming
          ? (options.url ?? undefined)
          : undefined,
    },
  ];

  const presence: PresenceData = {
    status,
    activities,
  };

  await interaction.client.user.setPresence(presence);
}

async function HandleClearActivity(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.client.user) {
    throw new Error("Client user unavailable.");
  }

  const status = sanitizeStatus(interaction.client.user.presence?.status);
  await interaction.client.user.setPresence({
    status,
    activities: [],
  });
}

async function ExecutePresence(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;

  if (!interaction.client.user) {
    const embed = EmbedFactory.CreateError({
      title: "Client Not Ready",
      description: "Bot user is not available yet. Try again in a moment.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const sub = interaction.options.getSubcommand(true);

  try {
    if (sub === "status") {
      const status = interaction.options.getString(
        "status",
        true
      ) as PresenceStatusData;
      await HandleStatus(interaction, status);

      const embed = EmbedFactory.CreateSuccess({
        title: "Presence Updated",
        description: `Status set to **${status}**.`,
      });
      await interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        ephemeral: true,
      });
      return;
    }

    if (sub === "activity") {
      const name = interaction.options.getString("name", true);
      const kind = interaction.options.getString("type", true) as ActivityKind;
      const url = interaction.options.getString("url") ?? null;

      await HandleActivity(interaction, { name, kind, url });

      const embed = EmbedFactory.CreateSuccess({
        title: "Activity Updated",
        description: `Activity set to **${kind}**: ${name}`,
      });
      await interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        ephemeral: true,
      });
      return;
    }

    if (sub === "clearactivity") {
      await HandleClearActivity(interaction);
      const embed = EmbedFactory.CreateSuccess({
        title: "Activity Cleared",
        description: "Bot activity has been cleared.",
      });
      await interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        ephemeral: true,
      });
      return;
    }
  } catch (error) {
    context.logger.Error("Failed to update presence", { error });
    const embed = EmbedFactory.CreateError({
      title: "Presence Update Failed",
      description:
        "Could not update the bot's presence. Check logs for details.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  }
}

export const PresenceCommand = CreateCommand({
  name: "presence",
  description: "Manage bot status and activity",
  group: "utility",
  configure: (builder) => {
    builder
      .addSubcommand((sub) =>
        sub
          .setName("status")
          .setDescription("Set the bot's status")
          .addStringOption((option) =>
            option
              .setName("status")
              .setDescription("Presence status")
              .setRequired(true)
              .addChoices(
                { name: "Online", value: "online" },
                { name: "Idle", value: "idle" },
                { name: "Do Not Disturb", value: "dnd" },
                { name: "Invisible", value: "invisible" }
              )
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("activity")
          .setDescription("Set the bot's activity (game/listening/etc.)")
          .addStringOption((option) =>
            option
              .setName("name")
              .setDescription("Activity text")
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName("type")
              .setDescription("Activity type")
              .setRequired(true)
              .addChoices(
                { name: "Playing", value: "playing" },
                { name: "Listening", value: "listening" },
                { name: "Watching", value: "watching" },
                { name: "Competing", value: "competing" },
                { name: "Streaming", value: "streaming" }
              )
          )
          .addStringOption((option) =>
            option
              .setName("url")
              .setDescription("Streaming URL (only for streaming)")
              .setRequired(false)
          )
      )
      .addSubcommand((sub) =>
        sub.setName("clearactivity").setDescription("Clear the bot's activity")
      );
  },
  config: Config.admin(5),
  execute: ExecutePresence,
});


