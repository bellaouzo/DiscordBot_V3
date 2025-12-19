import {
  ChatInputCommandInteraction,
  GuildMember,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { CommandContext, CreateCommand } from "@commands";
import { Config } from "@middleware";
import {
  CreateNoteManager,
  CreateWarnManager,
  EmbedFactory,
  CreateGuildResourceLocator,
} from "@utilities";
import { PaginationPage } from "@shared/Paginator";
import { ModerationDatabase } from "@database";

function IsModerator(member: GuildMember | null): boolean {
  if (!member) return false;
  const perms = member.permissions;
  return (
    perms.has("Administrator") ||
    perms.has("KickMembers") ||
    perms.has("BanMembers")
  );
}

function buildWarningPages(
  warnings: ReturnType<ReturnType<typeof CreateWarnManager>["GetUserWarnings"]>,
  userTag: string
): PaginationPage[] {
  const PAGE_SIZE = 6;
  const pages: PaginationPage[] = [];

  for (let i = 0; i < warnings.length; i += PAGE_SIZE) {
    const slice = warnings.slice(i, i + PAGE_SIZE);
    const start = i + 1;
    const end = i + slice.length;

    const embed = EmbedFactory.Create({
      title: `Warnings for ${userTag}`,
      description: `Showing ${start}-${end} of ${warnings.length}`,
    });

    embed.addFields(
      slice.map((warning, idx) => {
        const num = start + idx;
        const date = new Date(warning.created_at).toLocaleString();
        return {
          name: `#${num} — ${date}`,
          value: `Mod: <@${warning.moderator_id}>\nReason: ${
            warning.reason ?? "No reason provided"
          }`,
          inline: false,
        };
      })
    );

    pages.push({ embeds: [embed.toJSON()] });
  }

  return pages;
}

function buildNotePages(
  notes: ReturnType<ReturnType<typeof CreateNoteManager>["GetUserNotes"]>,
  userTag: string
): PaginationPage[] {
  const PAGE_SIZE = 6;
  const pages: PaginationPage[] = [];

  for (let i = 0; i < notes.length; i += PAGE_SIZE) {
    const slice = notes.slice(i, i + PAGE_SIZE);
    const start = i + 1;
    const end = i + slice.length;

    const embed = EmbedFactory.Create({
      title: `Notes for ${userTag}`,
      description: `Showing ${start}-${end} of ${notes.length}`,
    });

    embed.addFields(
      slice.map((note, idx) => {
        const num = start + idx;
        const date = new Date(note.created_at).toLocaleString();
        return {
          name: `#${num} — ${date}`,
          value: `Mod: <@${note.moderator_id}>\n${note.content}`,
          inline: false,
        };
      })
    );

    pages.push({ embeds: [embed.toJSON()] });
  }

  return pages;
}

function buildEventPages(
  events: ReturnType<ModerationDatabase["ListModerationEvents"]>,
  title: string
): PaginationPage[] {
  const PAGE_SIZE = 6;
  const pages: PaginationPage[] = [];

  for (let i = 0; i < events.length; i += PAGE_SIZE) {
    const slice = events.slice(i, i + PAGE_SIZE);
    const start = i + 1;
    const end = i + slice.length;

    const embed = EmbedFactory.Create({
      title,
      description: `Showing ${start}-${end} of ${events.length}`,
    });

    embed.addFields(
      slice.map((event, idx) => {
        const num = start + idx;
        const date = new Date(event.created_at).toLocaleString();
        const durationText =
          event.action === "ban" && event.duration_ms
            ? `\nDuration: ${Math.round(event.duration_ms / 1000 / 60)} min`
            : "";
        return {
          name: `#${num} — ${date}`,
          value: `Mod: <@${event.moderator_id}>${
            event.reason ? `\nReason: ${event.reason}` : ""
          }${durationText}`,
          inline: false,
        };
      })
    );

    pages.push({ embeds: [embed.toJSON()] });
  }

  return pages;
}

function buildMutePages(
  mutes: ReturnType<ModerationDatabase["ListUserTempActions"]>,
  userTag: string
): PaginationPage[] {
  const PAGE_SIZE = 6;
  const pages: PaginationPage[] = [];

  for (let i = 0; i < mutes.length; i += PAGE_SIZE) {
    const slice = mutes.slice(i, i + PAGE_SIZE);
    const start = i + 1;
    const end = i + slice.length;

    const embed = EmbedFactory.Create({
      title: `Mutes for ${userTag}`,
      description: `Showing ${start}-${end} of ${mutes.length}`,
    });

    embed.addFields(
      slice.map((mute, idx) => {
        const num = start + idx;
        const date = new Date(mute.created_at).toLocaleString();
        const status = mute.processed ? "Processed/expired" : "Active/pending";
        const expires =
          mute.expires_at > 0
            ? `\nExpires: <t:${Math.floor(mute.expires_at / 1000)}:R>`
            : "";
        return {
          name: `#${num} — ${date}`,
          value: `Status: ${status}${expires}${
            mute.reason ? `\nReason: ${mute.reason}` : ""
          }`,
          inline: false,
        };
      })
    );

    pages.push({ embeds: [embed.toJSON()] });
  }

  return pages;
}

async function ExecuteCasefile(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  const { buttonResponder, paginatedResponder, componentRouter } =
    context.responders;

  if (!interaction.guild) {
    throw new Error("This command can only be used in a server.");
  }

  const member = interaction.member as GuildMember | null;
  const isMod = IsModerator(member);
  if (!isMod) {
    const embed = EmbedFactory.CreateError({
      title: "Permission Denied",
      description: "You must be a moderator to view case files.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const targetUser = interaction.options.getUser("user", true);
  const warnManager = CreateWarnManager({
    guildId: interaction.guild.id,
    userDb: context.databases.userDb,
    logger: context.logger,
  });
  const noteManager = CreateNoteManager({
    guildId: interaction.guild.id,
    userDb: context.databases.userDb,
    logger: context.logger,
  });
  const modDb = context.databases.moderationDb;

  const warnings = warnManager.GetUserWarnings(targetUser.id);
  const notes = noteManager.GetUserNotes(targetUser.id);
  const kickEvents = modDb.ListModerationEvents({
    guild_id: interaction.guild.id,
    user_id: targetUser.id,
    action: "kick",
  });
  const kickCount = kickEvents.length;
  const recentKick = kickEvents[0];

  const banEvents = modDb.ListModerationEvents({
    guild_id: interaction.guild.id,
    user_id: targetUser.id,
    action: "ban",
  });
  const banCount = banEvents.length;
  const recentBan = banEvents[0];

  const muteHistory = modDb.ListUserTempActions({
    guild_id: interaction.guild.id,
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
    guild_id: interaction.guild.id,
    user_id: targetUser.id,
    action: "mute",
  });

  const locator = CreateGuildResourceLocator({
    guild: interaction.guild,
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
            warnings[warnings.length - 1].created_at
          ).toLocaleString()}`,
    inline: false,
  });

  fields.push({
    name: "Notes",
    value:
      notes.length === 0
        ? "None"
        : `Count: **${notes.length}**\nLatest: ${new Date(
            notes[notes.length - 1].created_at
          ).toLocaleString()}`,
    inline: false,
  });

  fields.push({
    name: "Kicks",
    value:
      kickEvents.length === 0
        ? "None recorded"
        : `Count: **${kickCount}**\nLatest: ${new Date(
            recentKick!.created_at
          ).toLocaleString()}${
            recentKick!.reason ? `\nReason: ${recentKick!.reason}` : ""
          }`,
    inline: false,
  });

  fields.push({
    name: "Bans",
    value:
      banEvents.length === 0
        ? "None recorded"
        : `Count: **${banCount}**\nLatest: ${new Date(
            recentBan!.created_at
          ).toLocaleString()}${
            recentBan!.reason ? `\nReason: ${recentBan!.reason}` : ""
          }${
            recentBan!.duration_ms
              ? `\nDuration: ${Math.round(
                  recentBan!.duration_ms / 1000 / 60
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
      activeTempMute.expires_at / 1000
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
          ephemeral: true,
        });
        return;
      }
      await paginatedResponder.Send({
        interaction: btn,
        pages: warningPages,
        ephemeral: true,
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
          ephemeral: true,
        });
        return;
      }
      await paginatedResponder.Send({
        interaction: btn,
        pages: notePages,
        ephemeral: true,
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
          ephemeral: true,
        });
        return;
      }
      await paginatedResponder.Send({
        interaction: btn,
        pages: kickPages,
        ephemeral: true,
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
          ephemeral: true,
        });
        return;
      }
      await paginatedResponder.Send({
        interaction: btn,
        pages: banPages,
        ephemeral: true,
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
          ephemeral: true,
        });
        return;
      }
      await paginatedResponder.Send({
        interaction: btn,
        pages: mutePages,
        ephemeral: true,
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
      .setDisabled(muteHistory.length === 0)
  );

  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    components: [buttonsRow.toJSON() as never],
    ephemeral: true,
  });
}

export const CasefileCommand = CreateCommand({
  name: "casefile",
  description: "View key moderation info for a user",
  group: "moderation",
  config: Config.mod().build(),
  execute: ExecuteCasefile,
  configure: (builder) => {
    builder.addUserOption((option) =>
      option.setName("user").setDescription("User to view").setRequired(true)
    );
  },
});
