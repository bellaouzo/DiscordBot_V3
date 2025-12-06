import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import { LoggingMiddleware, ErrorMiddleware } from "@middleware";
import { Config } from "@middleware/CommandConfig";
import { EmbedFactory } from "@utilities";
import { ServerDatabase } from "@database";

function ParseTime(input: string): number | null {
  const numeric = Number(input);
  if (!Number.isNaN(numeric)) {
    // Accept seconds or milliseconds
    const asMs = numeric < 10_000_000_000 ? numeric * 1000 : numeric;
    return asMs;
  }

  const parsed = Date.parse(input);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
}

async function ExecuteEventCreate(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;

  if (!interaction.guild) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Only",
      description: "This command can only be used in a server.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const timeInput = interaction.options.getString("time", true);
  const title = interaction.options.getString("title", true);
  const shouldNotify = interaction.options.getBoolean("shouldnotify") ?? false;

  const scheduledAt = ParseTime(timeInput);
  if (!scheduledAt || Number.isNaN(scheduledAt)) {
    const embed = EmbedFactory.CreateError({
      title: "Invalid Time",
      description:
        "Provide a valid time (ISO date, `YYYY-MM-DD HH:mm`, or Unix seconds).",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  if (scheduledAt <= Date.now()) {
    const embed = EmbedFactory.CreateError({
      title: "Time In The Past",
      description: "Please provide a future time.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const db = new ServerDatabase(context.logger.Child({ phase: "events-db" }));
  try {
    const event = db.CreateEvent({
      guild_id: interaction.guild.id,
      title,
      scheduled_at: scheduledAt,
      should_notify: shouldNotify,
      created_by: interaction.user.id,
    });

    const embed = EmbedFactory.CreateSuccess({
      title: "Event Created",
      description: `Scheduled **${event.title}** for <t:${Math.floor(
        event.scheduled_at / 1000
      )}:F> (relative: <t:${Math.floor(event.scheduled_at / 1000)}:R>).`,
    });
    if (shouldNotify) {
      embed.addFields({
        name: "Notify",
        value: "Will attempt to notify when time is reached.",
        inline: true,
      });
    }

    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  } catch (error) {
    context.logger.Error("Failed to create event", { error });
    const embed = EmbedFactory.CreateError({
      title: "Create Failed",
      description: "Could not schedule the event.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  } finally {
    db.Close();
  }
}

async function ExecuteEventList(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;

  if (!interaction.guild) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Only",
      description: "This command can only be used in a server.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const limit = interaction.options.getInteger("limit") ?? 10;
  const safeLimit = Math.min(Math.max(limit, 1), 25);

  const db = new ServerDatabase(context.logger.Child({ phase: "events-db" }));
  try {
    const events = db
      .ListUpcomingEvents(interaction.guild.id)
      .slice(0, safeLimit);

    const embed = EmbedFactory.Create({
      title: "📅 Upcoming Events",
      description:
        events.length === 0
          ? "No upcoming events scheduled."
          : `Showing up to ${safeLimit} upcoming event${
              safeLimit === 1 ? "" : "s"
            }.`,
    });

    if (events.length > 0) {
      embed.addFields(
        events.map((event) => ({
          name: `#${event.id} — ${event.title}`,
          value: `<t:${Math.floor(event.scheduled_at / 1000)}:F> (<t:${Math.floor(
            event.scheduled_at / 1000
          )}:R>)${event.should_notify ? " • will notify" : ""}`,
          inline: false,
        }))
      );
    }

    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  } catch (error) {
    context.logger.Error("Failed to list events", { error });
    const embed = EmbedFactory.CreateError({
      title: "List Failed",
      description: "Could not fetch upcoming events.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  } finally {
    db.Close();
  }
}

async function ExecuteEventCancel(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;

  if (!interaction.guild) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Only",
      description: "This command can only be used in a server.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const eventId = interaction.options.getInteger("id", true);

  const db = new ServerDatabase(context.logger.Child({ phase: "events-db" }));
  try {
    const event = db.GetEventById(eventId, interaction.guild.id);
    if (!event) {
      const embed = EmbedFactory.CreateWarning({
        title: "Not Found",
        description: `No event found with ID ${eventId}.`,
      });
      await interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        ephemeral: true,
      });
      return;
    }

    const deleted = db.DeleteEvent(eventId, interaction.guild.id);
    if (!deleted) {
      const embed = EmbedFactory.CreateError({
        title: "Cancel Failed",
        description: "Could not cancel the event.",
      });
      await interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        ephemeral: true,
      });
      return;
    }

    const embed = EmbedFactory.CreateSuccess({
      title: "Event Cancelled",
      description: `Cancelled event #${eventId} — **${event.title}**.`,
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  } catch (error) {
    context.logger.Error("Failed to cancel event", { error });
    const embed = EmbedFactory.CreateError({
      title: "Cancel Failed",
      description: "Could not cancel the event.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  } finally {
    db.Close();
  }
}

export const EventCommand = CreateCommand({
  name: "event",
  description: "Create a scheduled event",
  group: "utility",
  middleware: {
    before: [LoggingMiddleware],
    after: [ErrorMiddleware],
  },
  config: Config.utility(3),
  configure: (builder) => {
    builder
      .addSubcommand((sub) =>
        sub
          .setName("create")
          .setDescription("Create a scheduled event")
          .addStringOption((option) =>
            option
              .setName("time")
              .setDescription(
                "When the event starts (ISO, human date, or epoch seconds)"
              )
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName("title")
              .setDescription("Event title")
              .setRequired(true)
          )
          .addBooleanOption((option) =>
            option
              .setName("shouldnotify")
              .setDescription("Notify when event time is reached")
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("list")
          .setDescription("List upcoming events")
          .addIntegerOption((option) =>
            option
              .setName("limit")
              .setDescription("Max events to show (1-25, default 10)")
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("cancel")
          .setDescription("Cancel a scheduled event by ID")
          .addIntegerOption((option) =>
            option
              .setName("id")
              .setDescription("Event ID to cancel")
              .setRequired(true)
          )
      );
  },
  execute: async (interaction, context) => {
    const sub = interaction.options.getSubcommand(true);
    if (sub === "create") {
      await ExecuteEventCreate(interaction, context);
    } else if (sub === "list") {
      await ExecuteEventList(interaction, context);
    } else if (sub === "cancel") {
      await ExecuteEventCancel(interaction, context);
    }
  },
});
