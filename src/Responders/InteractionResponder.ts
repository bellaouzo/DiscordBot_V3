import {
  ChatInputCommandInteraction,
  MessageFlags,
  User,
  ButtonInteraction,
} from "discord.js";
import { Logger } from "../Shared/Logger";
import {
  ResponseOptions,
  ResponseResult,
  ResponseActionOptions,
  ResponderMessageOptions,
  ConvertToInteractionFlags,
} from "./ResponseTypes";

type InteractionLike = ChatInputCommandInteraction | ButtonInteraction;

/**
 * Handles slash command and button interactions: reply, edit, defer, follow-up, and action wrappers.
 */
export class InteractionResponder {
  constructor(private readonly logger: Logger) {}

  /**
   * Sends an initial reply. No-op if already replied or deferred.
   *
   * @param interaction - Slash or button interaction
   * @param options - Content, embeds, components, ephemeral, etc.
   * @returns Success flag and message
   */
  async Reply(
    interaction: InteractionLike,
    options: ResponseOptions
  ): Promise<ResponseResult> {
    if (interaction.replied || interaction.deferred) {
      return { success: false, message: "Already replied to this interaction" };
    }

    try {
      await interaction.reply({
        content: options.content,
        flags: ConvertToInteractionFlags(options),
        components: options.components,
        embeds: options.embeds,
        files: options.files,
      });

      return { success: true, message: "Reply sent" };
    } catch (error) {
      this.logger.Error("Reply failed", { error });
      return { success: false, message: "Failed to reply" };
    }
  }

  /**
   * Edits the existing reply. Fails if not yet replied or deferred.
   *
   * @param interaction - Slash or button interaction
   * @param options - Content, embeds, components, etc.
   * @returns Success flag and message
   */
  async Edit(
    interaction: InteractionLike,
    options: ResponseOptions
  ): Promise<ResponseResult> {
    if (!interaction.replied && !interaction.deferred) {
      return { success: false, message: "No reply to edit" };
    }

    try {
      await interaction.editReply({
        content: options.content,
        components: options.components,
        embeds: options.embeds,
        files: options.files,
      });

      return { success: true, message: "Reply edited" };
    } catch (error) {
      this.logger.Error("Edit failed", { error });
      return { success: false, message: "Failed to edit" };
    }
  }

  /**
   * Sends a follow-up message after an initial reply.
   *
   * @param interaction - Slash or button interaction
   * @param options - Content, embeds, components, ephemeral, etc.
   * @returns Success flag and message
   */
  async FollowUp(
    interaction: InteractionLike,
    options: ResponseOptions
  ): Promise<ResponseResult> {
    try {
      await interaction.followUp({
        content: options.content,
        flags: ConvertToInteractionFlags(options),
        components: options.components,
        embeds: options.embeds,
        files: options.files,
      });

      return { success: true, message: "Follow-up sent" };
    } catch (error) {
      this.logger.Error("Follow-up failed", { error });
      return { success: false, message: "Failed to send follow-up" };
    }
  }

  /**
   * Defers the reply (shows "thinking"). Ephemeral when options is true or when options.ephemeral is true.
   *
   * @param interaction - Slash or button interaction
   * @param options - Ephemeral flag or message options; false = public defer
   * @returns Success flag and message
   */
  async Defer(
    interaction: InteractionLike,
    options: ResponderMessageOptions | boolean = false
  ): Promise<ResponseResult> {
    if (interaction.deferred || interaction.replied) {
      return { success: true, message: "Already acknowledged" };
    }

    try {
      const flags =
        typeof options === "boolean"
          ? options
            ? MessageFlags.Ephemeral
            : undefined
          : ConvertToInteractionFlags(options);

      await interaction.deferReply({
        flags: flags,
      });

      return { success: true, message: "Deferred" };
    } catch (error) {
      const code = (error as { code?: number }).code;
      const message = (error as { message?: string }).message;
      const alreadyAck =
        code === 40060 ||
        (typeof message === "string" &&
          message.toLowerCase().includes("already been acknowledged"));

      if (alreadyAck) {
        return { success: true, message: "Already deferred" };
      }

      this.logger.Error("Defer failed", { error });
      return { success: false, message: "Failed to defer" };
    }
  }

  /**
   * Replies immediately, runs the action, then optionally edits with follow-up content.
   *
   * @param options - Interaction, initial message, action, and optional follow-up (string or function)
   */
  async WithAction(options: ResponseActionOptions): Promise<void> {
    await this.Reply(
      options.interaction,
      typeof options.message === "string"
        ? { content: options.message }
        : { ...options.message, ephemeral: false }
    );

    await options.action();

    if (options.followUp) {
      const followUp =
        typeof options.followUp === "function"
          ? options.followUp()
          : options.followUp;
      await this.Edit(
        options.interaction,
        typeof followUp === "string"
          ? { content: followUp }
          : { ...followUp, ephemeral: false }
      );
    }
  }

  /**
   * Sends a DM to a user.
   *
   * @param user - Target user
   * @param message - Text to send
   * @returns true if sent, false on failure (e.g. DMs disabled)
   */
  async SendDm(user: User, message: string): Promise<boolean> {
    try {
      await user.send(message);
      return true;
    } catch (error) {
      this.logger.Error("DM failed", { error });
      return false;
    }
  }
}
