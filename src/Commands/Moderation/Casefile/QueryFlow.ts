import type { ChatInputCommandInteraction } from "discord.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from "discord.js";
import type { CommandContext } from "@commands";
import {
  RequireGuild,
  CreateNoteManager,
  CreateWarnManager,
  EmbedFactory,
  CreateGuildResourceLocator,
} from "@utilities";
import {
  buildEventPages,
  buildMutePages,
  buildNotePages,
  buildWarningPages,
} from "@commands/Moderation/Casefile/Formatters";

export async function HandleCasefileQuery(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder } = context.responders;
  const { buttonResponder, paginatedResponder, componentRouter } =
    context.responders;

  const targetUser = interaction.options.getUser("user", true);
  const guild = RequireGuild(interaction);
  const warnManager = CreateWarnManager({
    guildId: guild.id,
    userDb: context.databases.userDb,
    logger: context.logger,
  });
  const noteManager = CreateNoteManager({
    guildId: guild.id,
    userDb: context.databases.userDb,
    logger: context.logger,
  });
  const modDb = context.databases.moderationDb;

  const warnings = warnManager.GetUserWarnings(targetUser.id);
  const notes = noteManager.GetUserNotes(targetUser.id);
  const kickEvents = modDb.ListModerationEvents({
    guild_id: guild.id,
    user_id: targetUser.id,
    action: "kick",
  });
  const kickCount = kickEvents.length;
  const recentKick = kickEvents[0];

  const banEvents = modDb.ListModerationEvents({
    guild_id: guild.id,
    user_id: targetUser.id,
    action: "ban",
  });
  const banCount = banEvents.length;
  const recentBan = banEvents[0];

  const muteHistory = modDb.ListUserTempActions({
    guild_id: guild.id,
    user_id: targetUser.id,
    action: "mute",
    limit: 50,
  });

  const kickPages = buildEventPages(kickEvents, `${targetUser.tag} — Kicks`);
  const banPages = buildEventPages(banEvents, `${targetUser.tag} — Bans`);
  const mutePages = buildMutePages(muteHistory, targetUser.tag);
  const warningPages = buildWarningPages(warnings, targetUser.tag);
  const notePages = buildNotePages(notes, targetUser.tag);

  const activeTempMute = modDb.GetActiveTempActionForUser({
    guild_id: guild.id,
    user_id: targetUser.id,
    action: "mute",
  });

  const locator = CreateGuildResourceLocator({
    guild,
    logger: context.logger,
  });
  const targetMember = await locator.GetMember(targetUser.id).catch(() => null);
  const liveMuteUntil =
    targetMember?.communicationDisabledUntilTimestamp ?? null;

  const fields = [];
  fields.push({
    name: "Warnings",
    value:
      warnings.length === 0
        ? "None"
        : `Count: **${warnings.length}**\nLatest: ${new Date(
            warnings[warnings.length - 1].created_at,
          ).toLocaleString()}`,
    inline: false,
  });

  fields.push({
    name: "Notes",
    value:
      notes.length === 0
        ? "None"
        : `Count: **${notes.length}**\nLatest: ${new Date(
            notes[notes.length - 1].created_at,
          ).toLocaleString()}`,
    inline: false,
  });

  fields.push({
    name: "Kicks",
    value:
      kickEvents.length === 0
        ? "None recorded"
        : `Count: **${kickCount}**\nLatest: ${new Date(
            recentKick?.created_at ?? 0,
          ).toLocaleString()}${
            recentKick?.reason ? `\nReason: ${recentKick.reason}` : ""
          }`,
    inline: false,
  });

  fields.push({
    name: "Bans",
    value:
      banEvents.length === 0
        ? "None recorded"
        : `Count: **${banCount}**\nLatest: ${new Date(
            recentBan?.created_at ?? 0,
          ).toLocaleString()}${
            recentBan?.reason ? `\nReason: ${recentBan.reason}` : ""
          }${
            recentBan?.duration_ms
              ? `\nDuration: ${Math.round(
                  recentBan.duration_ms / 1000 / 60,
                )} min`
              : ""
          }`,
    inline: false,
  });

  let muteValue = "None";
  const now = Date.now();
  if (liveMuteUntil && liveMuteUntil > now) {
    const remainingMs = liveMuteUntil - now;
    const remainingMinutes = Math.max(1, Math.floor(remainingMs / 1000 / 60));
    muteValue = `Active (ends <t:${Math.floor(liveMuteUntil / 1000)}:R>)`;
    if (activeTempMute?.reason) {
      muteValue += `\nReason: ${activeTempMute.reason}`;
    }
    muteValue += `\nRemaining: ~${remainingMinutes} min`;
  } else if (activeTempMute) {
    muteValue = `Pending mute record (expires <t:${Math.floor(
      activeTempMute.expires_at / 1000,
    )}:R>)`;
    if (activeTempMute.reason) {
      muteValue += `\nReason: ${activeTempMute.reason}`;
    }
  }

  fields.push({
    name: "Mute Status",
    value: muteValue,
    inline: false,
  });

  const embed = EmbedFactory.Create({
    title: `Casefile — ${targetUser.tag}`,
    description: `Overview of moderation items for <@${targetUser.id}>.\nUse the buttons below for detailed pages.`,
  });
  embed.addFields(fields);

  const buttonIds = {
    warnings: "",
    notes: "",
    kicks: "",
    bans: "",
    mutes: "",
  };

  const warnButton = componentRouter.RegisterButton({
    ownerId: interaction.user.id,
    expiresInMs: 1000 * 60 * 3,
    handler: async (btn) => {
      if (warnings.length === 0) {
        await buttonResponder.Reply(btn, {
          content: "No warnings recorded.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await paginatedResponder.Send({
        interaction: btn,
        pages: warningPages,
        flags: MessageFlags.Ephemeral,
        ownerId: interaction.user.id,
        timeoutMs: 1000 * 60 * 3,
        idleTimeoutMs: 1000 * 60 * 2,
      });
    },
  });

  const notesButton = componentRouter.RegisterButton({
    ownerId: interaction.user.id,
    expiresInMs: 1000 * 60 * 3,
    handler: async (btn) => {
      if (notes.length === 0) {
        await buttonResponder.Reply(btn, {
          content: "No notes recorded.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await paginatedResponder.Send({
        interaction: btn,
        pages: notePages,
        flags: MessageFlags.Ephemeral,
        ownerId: interaction.user.id,
        timeoutMs: 1000 * 60 * 3,
        idleTimeoutMs: 1000 * 60 * 2,
      });
    },
  });

  const kicksButton = componentRouter.RegisterButton({
    ownerId: interaction.user.id,
    expiresInMs: 1000 * 60 * 3,
    handler: async (btn) => {
      if (kickCount === 0) {
        await buttonResponder.Reply(btn, {
          content: "No kicks recorded.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await paginatedResponder.Send({
        interaction: btn,
        pages: kickPages,
        flags: MessageFlags.Ephemeral,
        ownerId: interaction.user.id,
        timeoutMs: 1000 * 60 * 3,
        idleTimeoutMs: 1000 * 60 * 2,
      });
    },
  });

  const bansButton = componentRouter.RegisterButton({
    ownerId: interaction.user.id,
    expiresInMs: 1000 * 60 * 3,
    handler: async (btn) => {
      if (banCount === 0) {
        await buttonResponder.Reply(btn, {
          content: "No bans recorded.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await paginatedResponder.Send({
        interaction: btn,
        pages: banPages,
        flags: MessageFlags.Ephemeral,
        ownerId: interaction.user.id,
        timeoutMs: 1000 * 60 * 3,
        idleTimeoutMs: 1000 * 60 * 2,
      });
    },
  });

  const mutesButton = componentRouter.RegisterButton({
    ownerId: interaction.user.id,
    expiresInMs: 1000 * 60 * 3,
    handler: async (btn) => {
      if (muteHistory.length === 0) {
        await buttonResponder.Reply(btn, {
          content: "No mutes recorded.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await paginatedResponder.Send({
        interaction: btn,
        pages: mutePages,
        flags: MessageFlags.Ephemeral,
        ownerId: interaction.user.id,
        timeoutMs: 1000 * 60 * 3,
        idleTimeoutMs: 1000 * 60 * 2,
      });
    },
  });

  buttonIds.warnings = warnButton.customId;
  buttonIds.notes = notesButton.customId;
  buttonIds.kicks = kicksButton.customId;
  buttonIds.bans = bansButton.customId;
  buttonIds.mutes = mutesButton.customId;

  const buttonsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(buttonIds.warnings)
      .setLabel("Warnings")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(warnings.length === 0),
    new ButtonBuilder()
      .setCustomId(buttonIds.notes)
      .setLabel("Notes")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(notes.length === 0),
    new ButtonBuilder()
      .setCustomId(buttonIds.kicks)
      .setLabel("Kicks")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(kickCount === 0),
    new ButtonBuilder()
      .setCustomId(buttonIds.bans)
      .setLabel("Bans")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(banCount === 0),
    new ButtonBuilder()
      .setCustomId(buttonIds.mutes)
      .setLabel("Mutes")
      .setStyle(ButtonStyle.Success)
      .setDisabled(muteHistory.length === 0),
  );

  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    components: [buttonsRow.toJSON() as never],
    flags: MessageFlags.Ephemeral,
  });
}
