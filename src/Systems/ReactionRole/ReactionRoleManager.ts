import type {
  GuildMember,
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  User,
} from "discord.js";
import type { ServerDatabase } from "@database";
import type { Logger } from "@shared/Logger";
import { NormalizeReactionEmoji, ValidateAssignableRole } from "@utilities";

export class ReactionRoleManager {
  constructor(
    private readonly serverDb: ServerDatabase,
    private readonly logger: Logger,
  ) {}

  async HandleReactionAdd(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
  ): Promise<void> {
    const resolvedUser = user.partial ? await user.fetch() : user;
    const guild = reaction.message.guild;
    if (resolvedUser.bot || !guild) {
      return;
    }

    const resolvedReaction = reaction.partial
      ? await reaction.fetch().catch(() => null)
      : reaction;

    if (!resolvedReaction) {
      this.logger.Warn("Failed to fetch partial reaction");
      return;
    }

    const emoji = NormalizeReactionEmoji(resolvedReaction.emoji);
    const mapping = this.serverDb.GetReactionRoleMappingByEmoji(
      guild.id,
      resolvedReaction.message.id,
      emoji,
    );

    if (!mapping) {
      return;
    }

    const member = await guild.members.fetch(resolvedUser.id);
    await this.ApplyRoleChange(member, mapping.role_id, "add");
  }

  async HandleReactionRemove(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
  ): Promise<void> {
    const resolvedUser = user.partial ? await user.fetch() : user;
    const guild = reaction.message.guild;
    if (resolvedUser.bot || !guild) {
      return;
    }

    const resolvedReaction = reaction.partial
      ? await reaction.fetch().catch(() => null)
      : reaction;

    if (!resolvedReaction) {
      this.logger.Warn("Failed to fetch partial reaction");
      return;
    }

    const emoji = NormalizeReactionEmoji(resolvedReaction.emoji);
    const mapping = this.serverDb.GetReactionRoleMappingByEmoji(
      guild.id,
      resolvedReaction.message.id,
      emoji,
    );

    if (!mapping) {
      return;
    }

    const member = await guild.members.fetch(resolvedUser.id);
    await this.ApplyRoleChange(member, mapping.role_id, "remove");
  }

  private async ApplyRoleChange(
    member: GuildMember,
    roleId: string,
    action: "add" | "remove",
  ): Promise<void> {
    const role = await member.guild.roles.fetch(roleId);
    const validation = ValidateAssignableRole(member.guild, role);

    if (!validation.valid) {
      this.logger.Warn("Cannot apply reaction role", {
        extra: { roleId, reason: validation.reason },
      });
      return;
    }

    try {
      if (action === "add") {
        if (!member.roles.cache.has(roleId)) {
          await member.roles.add(roleId, "Reaction role");
        }
      } else if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId, "Reaction role removed");
      }
    } catch (error) {
      this.logger.Warn("Failed to update reaction role", {
        extra: { roleId, action },
        error,
      });
    }
  }
}
