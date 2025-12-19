import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import { Config } from "@middleware";
import { EmbedFactory } from "@utilities";
import { PaginationPage } from "@shared/Paginator";

const EVENT_LIST_PAGE_SIZE = 8;

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

  const db = context.databases.serverDb;
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
      description: `Scheduled **${event.title}** as #${event.guild_event_id} for <t:${Math.floor(
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
  }
}

async function ExecuteEventList(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder, paginatedResponder } = context.responders;

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

  const db = context.databases.serverDb;
  try {
    const events = db
      .ListUpcomingEvents(interaction.guild.id)
      .slice(0, safeLimit);

    if (events.length === 0) {
      const embed = EmbedFactory.CreateWarning({
        title: "No Upcoming Events",
        description: "No upcoming events scheduled.",
      });
      await interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        ephemeral: true,
      });
      return;
    }

    const pages = BuildEventPages(events);

    await paginatedResponder.Send({
      interaction,
      pages,
      ephemeral: true,
      ownerId: interaction.user.id,
      timeoutMs: 1000 * 60 * 3,
      idleTimeoutMs: 1000 * 60 * 2,
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
  }
}

function BuildEventPages(
  events: Array<{
    id: number;
    guild_event_id: number;
    title: string;
    scheduled_at: number;
    should_notify: boolean;
  }>
): PaginationPage[] {
  const pages: PaginationPage[] = [];

  for (let index = 0; index < events.length; index += EVENT_LIST_PAGE_SIZE) {
    const slice = events.slice(index, index + EVENT_LIST_PAGE_SIZE);
    const start = index + 1;
    const end = index + slice.length;

    const embed = EmbedFactory.Create({
      title: "📅 Upcoming Events",
      description: `Showing events ${start} - ${end} of ${events.length}`,
    });

    embed.addFields(
      slice.map((event) => ({
        name: `#${event.guild_event_id} — ${event.title}`,
        value: `<t:${Math.floor(event.scheduled_at / 1000)}:F> (<t:${Math.floor(
          event.scheduled_at / 1000
        )}:R>)${event.should_notify ? " • will notify" : ""}`,
        inline: false,
      }))
    );

    pages.push({ embeds: [embed.toJSON()] });
  }

  return pages;
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

  const db = context.databases.serverDb;
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
  }
}

export const EventCommand = CreateCommand({
  name: "event",
  description: "Create a scheduled event",
  group: "utility",
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
