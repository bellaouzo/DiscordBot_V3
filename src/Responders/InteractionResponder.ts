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

export class InteractionResponder {
  constructor(private readonly logger: Logger) {}

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

  async Edit(
    interaction: InteractionLike,
    options: ResponseOptions
  ): Promise<ResponseResult> {
    if (!interaction.replied) {
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

  async Defer(
    interaction: InteractionLike,
    options: ResponderMessageOptions | boolean = false
  ): Promise<ResponseResult> {
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
      this.logger.Error("Defer failed", { error });
      return { success: false, message: "Failed to defer" };
    }
  }

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
