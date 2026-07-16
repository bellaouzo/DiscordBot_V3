import type { MessageCreateHandler } from "./types";

export const VerificationChannelGuardHandler: MessageCreateHandler = {
  name: "verification-channel-guard",

  async execute(context, msg) {
    const guild = msg.guild;
    if (!guild) {
      return "continue";
    }

    const settings = context.databases.serverDb.GetGuildSettings(guild.id);
    if (
      !settings?.verification_enabled ||
      !settings.verification_channel_id ||
      msg.channelId !== settings.verification_channel_id
    ) {
      return "continue";
    }

    try {
      await msg.delete();
    } catch (error) {
      context.logger.Warn("Failed to delete message in verification channel", {
        error,
        extra: {
          guildId: guild.id,
          channelId: msg.channelId,
          messageId: msg.id,
        },
      });
    }

    return "stop";
  },
};
