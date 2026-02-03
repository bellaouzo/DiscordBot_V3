import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "@commands";
import { Config } from "@middleware";
import { EmbedFactory, CreateNoteManager } from "@utilities";
import { Note } from "@database";
import { PaginationPage } from "@shared/Paginator";

const NOTE_LIST_PAGE_SIZE = 6;

async function ExecuteNote(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const noteManager = CreateNoteManager({
    guildId: interaction.guild!.id,
    userDb: context.databases.userDb,
    logger: context.logger,
  });

  const subcommand = interaction.options.getSubcommand(true);

  if (subcommand === "add") {
    await HandleAdd(interaction, context, noteManager);
    return;
  }

  if (subcommand === "remove") {
    await HandleRemove(interaction, context, noteManager);
    return;
  }

  if (subcommand === "list") {
    await HandleList(interaction, context, noteManager);
    return;
  }
}

async function HandleAdd(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  noteManager: ReturnType<typeof CreateNoteManager>
): Promise<void> {
  const { interactionResponder } = context.responders;
  const targetUser = interaction.options.getUser("user", true);
  const content = interaction.options.getString("content", true);

  noteManager.AddNote({
    userId: targetUser.id,
    moderatorId: interaction.user.id,
    content,
  });

  const totalNotes = noteManager.GetUserNotes(targetUser.id).length;
  const embed = EmbedFactory.CreateSuccess({
    title: "🗒️ Note Added",
    description: `Added a note for **${targetUser.tag}**.`,
    footer: `Total notes: ${totalNotes}`,
  });

  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    ephemeral: true,
  });
}

async function HandleRemove(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  noteManager: ReturnType<typeof CreateNoteManager>
): Promise<void> {
  const { interactionResponder } = context.responders;
  const targetUser = interaction.options.getUser("user", true);
  const noteId = interaction.options.getInteger("note_id");

  if (noteId) {
    const notes = noteManager.GetUserNotes(targetUser.id);

    if (noteId < 1 || noteId > notes.length) {
      const embed = EmbedFactory.CreateWarning({
        title: "Note Not Found",
        description: `No note found with number ${noteId}.`,
      });
      await interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        ephemeral: true,
      });
      return;
    }

    const note = notes[noteId - 1];

    const removed = noteManager.RemoveNoteById(note.id);
    if (!removed) {
      const embed = EmbedFactory.CreateError({
        title: "Removal Failed",
        description: "Failed to remove the note.",
      });
      await interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        ephemeral: true,
      });
      return;
    }

    const embed = EmbedFactory.CreateSuccess({
      title: "Note Removed",
      description: `Removed note **#${noteId}** for **${targetUser.tag}**.`,
    });

    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const removedNote = noteManager.RemoveLatestNote(targetUser.id);
  if (!removedNote) {
    const embed = EmbedFactory.CreateWarning({
      title: "No Notes",
      description: `${targetUser.tag} has no notes to remove.`,
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const embed = EmbedFactory.CreateSuccess({
    title: "Latest Note Removed",
    description: `Removed latest note for **${targetUser.tag}**.`,
  });

  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    ephemeral: true,
  });
}

async function HandleList(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  noteManager: ReturnType<typeof CreateNoteManager>
): Promise<void> {
  const { interactionResponder, paginatedResponder } = context.responders;
  const targetUser = interaction.options.getUser("user") ?? interaction.user;
  const notes = noteManager.GetUserNotes(targetUser.id);

  if (notes.length === 0) {
    const embed = EmbedFactory.CreateWarning({
      title: "No Notes",
      description: `${targetUser.tag} has no notes.`,
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const pages = BuildNotePages(notes, targetUser.tag);

  await paginatedResponder.Send({
    interaction,
    pages,
    ephemeral: true,
    ownerId: interaction.user.id,
    timeoutMs: 1000 * 60 * 3,
    idleTimeoutMs: 1000 * 60 * 2,
  });
}

function BuildNotePages(notes: Note[], userTag: string): PaginationPage[] {
  const pages: PaginationPage[] = [];

  for (let index = 0; index < notes.length; index += NOTE_LIST_PAGE_SIZE) {
    const slice = notes.slice(index, index + NOTE_LIST_PAGE_SIZE);
    const start = index + 1;
    const end = index + slice.length;

    const embed = EmbedFactory.Create({
      title: `Notes for ${userTag}`,
      description: `Showing notes ${start} - ${end} of ${notes.length}`,
    });

    embed.addFields(
      slice.map((note, sliceIndex) => {
        const date = new Date(note.created_at).toLocaleDateString();
        const noteNumber = start + sliceIndex;
        return {
          name: `#${noteNumber} — ${date}`,
          value: `Mod: <@${note.moderator_id}>\n${note.content}`,
          inline: false,
        };
      })
    );

    pages.push({ embeds: [embed.toJSON()] });
  }

  return pages;
}

export const NoteCommand = CreateCommand({
  name: "note",
  description: "Manage user notes",
  group: "moderation",
  config: Config.mod(5).build(),
  execute: ExecuteNote,
  configure: (builder) => {
    builder
      .addSubcommand((sub) =>
        sub
          .setName("add")
          .setDescription("Add a note to a user")
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription("User to note")
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName("content")
              .setDescription("Note content")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("remove")
          .setDescription("Remove a user's note")
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription("User whose note to remove")
              .setRequired(true)
          )
          .addIntegerOption((option) =>
            option
              .setName("note_id")
              .setDescription("Note number")
              .setRequired(true)
              .setMinValue(1)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("list")
          .setDescription("List notes for a user")
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription("User to view (defaults to yourself)")
              .setRequired(true)
          )
      );
  },
});
