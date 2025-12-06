import { TicketDatabase, Warning } from "../Database";
import { Logger } from "../Shared/Logger";

export interface WarnManagerOptions {
  readonly guildId: string;
  readonly ticketDb: TicketDatabase;
  readonly logger: Logger;
}

export class WarnManager {
  constructor(private readonly options: WarnManagerOptions) {}

  AddWarning(data: {
    userId: string;
    moderatorId: string;
    reason?: string | null;
  }): Warning {
    try {
      return this.options.ticketDb.AddWarning({
        user_id: data.userId,
        guild_id: this.options.guildId,
        moderator_id: data.moderatorId,
        reason: data.reason ?? null,
      });
    } catch (error) {
      this.options.logger.Error("Failed to add warning", {
        error,
        extra: { userId: data.userId, guildId: this.options.guildId },
      });
      throw error;
    }
  }

  GetUserWarnings(userId: string, limit?: number): Warning[] {
    return this.options.ticketDb.GetWarnings(
      userId,
      this.options.guildId,
      limit
    );
  }

  CountWarnings(userId: string): number {
    const warnings = this.options.ticketDb.GetWarnings(
      userId,
      this.options.guildId
    );
    return warnings.length;
  }

  GetWarningById(warningId: number): Warning | null {
    return this.options.ticketDb.GetWarningById(
      warningId,
      this.options.guildId
    );
  }

  RemoveWarningById(warningId: number): boolean {
    return this.options.ticketDb.RemoveWarningById(
      warningId,
      this.options.guildId
    );
  }

  RemoveLatestWarning(userId: string): Warning | null {
    return this.options.ticketDb.RemoveLatestWarning(
      userId,
      this.options.guildId
    );
  }
}

export function CreateWarnManager(options: WarnManagerOptions): WarnManager {
  return new WarnManager(options);
}
