import {
  CreateNoteManager,
  CreateWarnManager,
  EmbedFactory,
} from "@utilities";
import { PaginationPage } from "@shared/Paginator";
import { ModerationDatabase } from "@database";

export function buildWarningPages(
  warnings: ReturnType<ReturnType<typeof CreateWarnManager>["GetUserWarnings"]>,
  userTag: string,
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
      }),
    );

    pages.push({ embeds: [embed.toJSON()] });
  }

  return pages;
}

export function buildNotePages(
  notes: ReturnType<ReturnType<typeof CreateNoteManager>["GetUserNotes"]>,
  userTag: string,
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
      }),
    );

    pages.push({ embeds: [embed.toJSON()] });
  }

  return pages;
}

export function buildEventPages(
  events: ReturnType<ModerationDatabase["ListModerationEvents"]>,
  title: string,
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
      }),
    );

    pages.push({ embeds: [embed.toJSON()] });
  }

  return pages;
}

export function buildMutePages(
  mutes: ReturnType<ModerationDatabase["ListUserTempActions"]>,
  userTag: string,
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
      }),
    );

    pages.push({ embeds: [embed.toJSON()] });
  }

  return pages;
}
