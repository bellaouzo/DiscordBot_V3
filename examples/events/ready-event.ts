import { Events } from "discord.js";
import { CreateEvent } from "../../src/Events";

/**
 * Bot ready event
 * Fires when the bot successfully connects to Discord
 */
export const ReadyEvent = CreateEvent({
  name: Events.ClientReady,
  once: true, // Only fire once
  execute: async (context) => {
    const user = context.client.user;
    
    context.logger.Info("Bot is ready!", {
      extra: {
        tag: user?.tag,
        id: user?.id,
        guilds: context.client.guilds.cache.size,
      },
    });

    // Set bot status
    context.client.user?.setActivity("with Discord.js", { type: "PLAYING" });
  },
});
