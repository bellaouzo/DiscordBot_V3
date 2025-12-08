import { UserDatabase, Note } from "@database";
import { Logger } from "@shared/Logger";

export interface NoteManagerOptions {
  readonly guildId: string;
  readonly userDb: UserDatabase;
  readonly logger: Logger;
}

export class NoteManager {
  constructor(private readonly options: NoteManagerOptions) {}

  AddNote(data: {
    userId: string;
    moderatorId: string;
    content: string;
  }): Note {
    try {
      return this.options.userDb.AddNote({
        user_id: data.userId,
        guild_id: this.options.guildId,
        moderator_id: data.moderatorId,
        content: data.content,
      });
    } catch (error) {
      this.options.logger.Error("Failed to add note", {
        error,
        extra: { userId: data.userId, guildId: this.options.guildId },
      });
      throw error;
    }
  }

  GetUserNotes(userId: string, limit?: number): Note[] {
    return this.options.userDb.GetNotes(userId, this.options.guildId, limit);
  }

  RemoveNoteById(noteId: number): boolean {
    return this.options.userDb.RemoveNoteById(noteId, this.options.guildId);
  }

  RemoveLatestNote(userId: string): Note | null {
    return this.options.userDb.RemoveLatestNote(userId, this.options.guildId);
  }
}

export function CreateNoteManager(options: NoteManagerOptions): NoteManager {
  return new NoteManager(options);
}
