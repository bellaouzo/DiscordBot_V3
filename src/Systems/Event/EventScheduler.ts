import type { Client, TextChannel } from "discord.js";
import type { ServerDatabase } from "@database";
import type { Logger } from "@shared/Logger";
import { EmbedFactory } from "@utilities";

const POLL_INTERVAL_MS = 30_000;

export class EventScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    private readonly client: Client,
    private readonly serverDb: ServerDatabase,
    private readonly logger: Logger,
  ) {}

  Start(): void {
    if (this.intervalId) {
      this.logger.Warn("EventScheduler already running");
      return;
    }

    this.intervalId = setInterval(() => {
      void this.ProcessDueEvents();
    }, POLL_INTERVAL_MS);

    void this.ProcessDueEvents();
  }

  Stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async ProcessDueEvents(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const dueEvents = this.serverDb.ListEventsDueForNotification(Date.now());

      for (const event of dueEvents) {
        await this.NotifyEvent(event);
      }
    } catch (error) {
      this.logger.Error("Error processing due events", { error });
    } finally {
      this.isProcessing = false;
    }
  }

  private async NotifyEvent(event: {
    id: number;
    guild_id: string;
    guild_event_id: number;
    title: string;
    scheduled_at: number;
    created_by: string;
  }): Promise<void> {
    try {
      const settings = this.serverDb.GetGuildSettings(event.guild_id);
      const channelId = settings?.announcement_channel_id;

      if (!channelId) {
        this.logger.Warn("No announcement channel configured for event notification", {
          extra: {
            guildId: event.guild_id,
            eventId: event.guild_event_id,
          },
        });
        this.serverDb.MarkEventNotified(event.id, Date.now());
        return;
      }

      const guild = await this.client.guilds.fetch(event.guild_id);
      const channel = await guild.channels.fetch(channelId);

      if (!channel?.isTextBased()) {
        this.logger.Warn("Announcement channel is not text-based", {
          extra: {
            guildId: event.guild_id,
            channelId,
          },
        });
        this.serverDb.MarkEventNotified(event.id, Date.now());
        return;
      }

      const embed = EmbedFactory.Create({
        title: `📅 Event Starting: ${event.title}`,
        description: [
          `Event **#${event.guild_event_id}** is happening now!`,
          `**Scheduled:** <t:${Math.floor(event.scheduled_at / 1000)}:F>`,
          `**Created by:** <@${event.created_by}>`,
        ].join("\n"),
        color: 0x5865f2,
        timestamp: true,
      });

      await (channel as TextChannel).send({ embeds: [embed.toJSON()] });
      this.serverDb.MarkEventNotified(event.id, Date.now());
    } catch (error) {
      this.logger.Error("Error notifying event", {
        extra: { eventId: event.guild_event_id, guildId: event.guild_id },
        error,
      });
    }
  }
}
