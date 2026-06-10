import {
  Appeal,
  AppealActionType,
  AppealStatus,
  ModerationDatabase,
  TempAction,
  UserDatabase,
} from "@database";
import { Logger } from "@shared/Logger";

export interface AppealManagerOptions {
  readonly guildId: string;
  readonly userId: string;
  readonly moderationDb: ModerationDatabase;
  readonly userDb: UserDatabase;
  readonly logger: Logger;
}

export interface ValidatedAppealTarget {
  readonly actionType: AppealActionType;
  readonly actionRef: string;
  readonly context: string;
}

export interface AppealValidationResult {
  readonly success: boolean;
  readonly message?: string;
  readonly target?: ValidatedAppealTarget;
}

export interface AppealableActionOption extends ValidatedAppealTarget {
  readonly createdAt: number;
  readonly preview: string;
  readonly moderatorId: string;
}

export class AppealManager {
  constructor(private readonly options: AppealManagerOptions) {}

  ValidateTarget(data: {
    actionType: AppealActionType;
    actionRef?: string | null;
  }): AppealValidationResult {
    try {
      if (data.actionType === "warning") {
        return this.ValidateWarningTarget(data.actionRef);
      }

      if (data.actionType === "mute") {
        return this.ValidateMuteTarget(data.actionRef);
      }

      if (data.actionType === "kick" || data.actionType === "ban") {
        return this.ValidateModerationEventTarget(
          data.actionType,
          data.actionRef,
        );
      }

      return { success: false, message: "Unsupported appeal action type." };
    } catch (error) {
      this.options.logger.Error("Failed to validate appeal target", {
        error,
        extra: {
          guildId: this.options.guildId,
          userId: this.options.userId,
          actionType: data.actionType,
          actionRef: data.actionRef,
        },
      });
      return { success: false, message: "Failed to validate appeal target." };
    }
  }

  CreateAppeal(data: {
    actionType: AppealActionType;
    actionRef: string;
    reason: string;
    evidence?: string | null;
  }): Appeal {
    return this.options.moderationDb.AddAppeal({
      guild_id: this.options.guildId,
      user_id: this.options.userId,
      action_type: data.actionType,
      action_ref: data.actionRef,
      reason: data.reason,
      evidence: data.evidence ?? null,
    });
  }

  ListAppeals(status?: AppealStatus): Appeal[] {
    return this.options.moderationDb.ListAppeals({
      guild_id: this.options.guildId,
      user_id: this.options.userId,
      status,
      limit: 50,
    });
  }

  ListAppealableActions(
    preferredAction?: AppealActionType,
  ): AppealableActionOption[] {
    const actions = preferredAction
      ? [preferredAction]
      : (["warning", "mute", "ban", "kick"] as AppealActionType[]);
    const result: AppealableActionOption[] = [];

    actions.forEach((actionType) => {
      if (actionType === "warning") {
        this.options.userDb
          .GetWarnings(this.options.userId, this.options.guildId)
          .forEach((warning) => {
            result.push({
              actionType: "warning",
              actionRef: String(warning.id),
              createdAt: warning.created_at,
              context: `Warning #${warning.id} from <t:${Math.floor(
                warning.created_at / 1000,
              )}:f>`,
              preview: `Mod: ${warning.moderator_id} | ${this.BuildReasonPreview(
                warning.reason,
              )}`,
              moderatorId: warning.moderator_id,
            });
          });
        return;
      }

      if (actionType === "mute") {
        this.options.moderationDb
          .ListUserTempActions({
            guild_id: this.options.guildId,
            user_id: this.options.userId,
            action: "mute",
            limit: 50,
          })
          .forEach((mute) => {
            result.push(this.BuildMuteOption(mute));
          });
        return;
      }

      this.options.moderationDb
        .ListModerationEvents({
          guild_id: this.options.guildId,
          user_id: this.options.userId,
          action: actionType,
          limit: 50,
        })
        .forEach((event) => {
          result.push({
            actionType,
            actionRef: String(event.id),
            createdAt: event.created_at,
            context: `${actionType.toUpperCase()} #${
              event.id
            } from <t:${Math.floor(event.created_at / 1000)}:f>`,
            preview: `Mod: ${event.moderator_id} | ${this.BuildReasonPreview(
              event.reason,
            )}`,
            moderatorId: event.moderator_id,
          });
        });
    });

    return result
      .filter(
        (entry) =>
          !this.options.moderationDb.HasOpenAppealForAction({
            guild_id: this.options.guildId,
            user_id: this.options.userId,
            action_type: entry.actionType,
            action_ref: entry.actionRef,
          }),
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  ListGuildOpenAppeals(limit = 25): Appeal[] {
    return this.options.moderationDb.ListAppeals({
      guild_id: this.options.guildId,
      status: "open",
      limit,
    });
  }

  private BuildMuteOption(mute: TempAction): AppealableActionOption {
    const status = mute.processed ? "expired" : "active";
    return {
      actionType: "mute",
      actionRef: String(mute.id),
      createdAt: mute.created_at,
      context: `Mute #${mute.id} (${status}) from <t:${Math.floor(
        mute.created_at / 1000,
      )}:f>`,
      preview: `Mod: ${mute.moderator_id} | ${this.BuildReasonPreview(
        mute.reason,
      )}`,
      moderatorId: mute.moderator_id,
    };
  }

  private BuildReasonPreview(reason?: string | null): string {
    if (!reason || reason.trim().length === 0) {
      return "No reason provided";
    }

    const normalized = reason.replace(/\s+/g, " ").trim();
    if (normalized.length <= 50) {
      return normalized;
    }

    return `${normalized.slice(0, 47)}...`;
  }

  private ValidateWarningTarget(
    actionRef?: string | null,
  ): AppealValidationResult {
    const warnings = this.options.userDb.GetWarnings(
      this.options.userId,
      this.options.guildId,
    );

    if (warnings.length === 0) {
      return { success: false, message: "No warnings found to appeal." };
    }

    if (!actionRef) {
      const latest = warnings[warnings.length - 1];
      const context = `Warning #${latest.id} from <t:${Math.floor(
        latest.created_at / 1000,
      )}:f>`;
      return {
        success: true,
        target: {
          actionType: "warning",
          actionRef: String(latest.id),
          context,
        },
      };
    }

    const warningId = Number(actionRef);
    if (!Number.isInteger(warningId) || warningId <= 0) {
      return {
        success: false,
        message: "Warning reference must be a positive numeric ID.",
      };
    }

    const warning = this.options.userDb.GetWarningById(
      warningId,
      this.options.guildId,
    );
    if (!warning || warning.user_id !== this.options.userId) {
      return {
        success: false,
        message: `Warning #${warningId} was not found for this user.`,
      };
    }

    const context = `Warning #${warning.id} from <t:${Math.floor(
      warning.created_at / 1000,
    )}:f>`;
    return {
      success: true,
      target: { actionType: "warning", actionRef: String(warning.id), context },
    };
  }

  private ValidateMuteTarget(
    actionRef?: string | null,
  ): AppealValidationResult {
    const mutes = this.options.moderationDb.ListUserTempActions({
      guild_id: this.options.guildId,
      user_id: this.options.userId,
      action: "mute",
      limit: 50,
    });

    if (mutes.length === 0) {
      return { success: false, message: "No mute records found to appeal." };
    }

    const targetMute = actionRef
      ? mutes.find((mute) => String(mute.id) === actionRef)
      : mutes[0];

    if (!targetMute) {
      return {
        success: false,
        message: `Mute record ${actionRef} was not found for this user.`,
      };
    }

    const context = `Mute #${targetMute.id} from <t:${Math.floor(
      targetMute.created_at / 1000,
    )}:f>`;
    return {
      success: true,
      target: { actionType: "mute", actionRef: String(targetMute.id), context },
    };
  }

  private ValidateModerationEventTarget(
    actionType: "kick" | "ban",
    actionRef?: string | null,
  ): AppealValidationResult {
    const events = this.options.moderationDb.ListModerationEvents({
      guild_id: this.options.guildId,
      user_id: this.options.userId,
      action: actionType,
      limit: 50,
    });

    if (events.length === 0) {
      return {
        success: false,
        message: `No ${actionType} records found to appeal.`,
      };
    }

    const targetEvent = actionRef
      ? events.find((event) => String(event.id) === actionRef)
      : events[0];

    if (!targetEvent) {
      return {
        success: false,
        message: `${actionType} record ${actionRef} was not found for this user.`,
      };
    }

    const context = `${actionType.toUpperCase()} #${targetEvent.id} from <t:${Math.floor(
      targetEvent.created_at / 1000,
    )}:f>`;
    return {
      success: true,
      target: {
        actionType,
        actionRef: String(targetEvent.id),
        context,
      },
    };
  }
}

export function CreateAppealManager(
  options: AppealManagerOptions,
): AppealManager {
  return new AppealManager(options);
}
