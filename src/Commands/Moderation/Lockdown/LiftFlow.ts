import type {
  ChatInputCommandInteraction,
  TextChannel,
  CategoryChannel,
} from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { RequireGuild, EmbedFactory } from "@utilities";
import type { LockdownScope } from "@database";
import { ParseOverwrites } from "@commands/Moderation/shared/OverwriteSerialization";

export async function HandleUnlockTarget(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  scope: LockdownScope,
  targetId: string,
): Promise<void> {
  const db = context.databases.moderationDb;
  try {
    const record = db.GetActiveLockdown(
      scope,
      RequireGuild(interaction).id,
      targetId,
    );
    if (!record) {
      const embed = EmbedFactory.CreateWarning({
        title: "Not Locked",
        description: "No active lockdown found for the target.",
      });
      await context.responders.interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const overwrites = ParseOverwrites(record.overwrites);
    const channel = RequireGuild(interaction).channels.cache.get(targetId);

    if (!channel || !("permissionOverwrites" in channel)) {
      const embed = EmbedFactory.CreateError({
        title: "Channel Missing",
        description:
          "Could not locate the locked target to restore permissions.",
      });
      await context.responders.interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await (channel as TextChannel | CategoryChannel).permissionOverwrites.set(
      overwrites,
    );

    db.MarkLockdownLifted(record.id);

    const embed = EmbedFactory.CreateSuccess({
      title: "Lockdown Cleared",
      description: `Restored permissions for ${channel}.`,
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    context.logger.Error("Failed to unlock target", { error });
  }
}

export async function HandleLockdownStatus(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const db = context.databases.moderationDb;
  try {
    const active = db.ListActiveLockdowns(RequireGuild(interaction).id);
    if (active.length === 0) {
      const embed = EmbedFactory.CreateWarning({
        title: "No Active Lockdowns",
        description: "There are no locked channels or categories.",
      });
      await context.responders.interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const embed = EmbedFactory.Create({
      title: "🔒 Active Lockdowns",
      description: active
        .map((lock) => {
          const target =
            lock.scope === "category"
              ? `Category <#${lock.target_id}>`
              : `Channel <#${lock.target_id}>`;
          return `${target} — by <@${lock.applied_by}> <t:${Math.floor(
            lock.applied_at / 1000,
          )}:R>`;
        })
        .join("\n"),
    });

    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    context.logger.Error("Failed to show status", { error });
  }
}
