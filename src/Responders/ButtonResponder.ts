import { ButtonInteraction, InteractionUpdateOptions } from "discord.js";
import { Logger } from "../Shared/Logger";
import {
  ResponseOptions,
  ResponseResult,
  ResponderEditOptions,
  ConvertToInteractionFlags,
} from "./ResponseTypes";

export class ButtonResponder {
  constructor(private readonly logger: Logger) {}

  async Update(
    interaction: ButtonInteraction,
    options: InteractionUpdateOptions
  ): Promise<ResponseResult> {
    if (interaction.replied || interaction.deferred) {
      return {
        success: false,
        message: "Already responded to this interaction",
      };
    }

    try {
      await interaction.update(options);

      return { success: true, message: "Button interaction updated" };
    } catch (error) {
      this.logger.Error("Update failed", { error });
      return { success: false, message: "Failed to update" };
    }
  }

  async DeferUpdate(interaction: ButtonInteraction): Promise<ResponseResult> {
    if (interaction.replied || interaction.deferred) {
      return {
        success: false,
        message: "Already responded to this interaction",
      };
    }

    try {
      await interaction.deferUpdate();
      return { success: true, message: "Button interaction deferred" };
    } catch (error) {
      this.logger.Error("DeferUpdate failed", { error });
      return { success: false, message: "Failed to defer update" };
    }
  }

  async EditMessage(
    interaction: ButtonInteraction,
    options: ResponderEditOptions
  ): Promise<ResponseResult> {
    try {
      await interaction.message.edit({
        content: options.content,
        components: options.components,
        embeds: options.embeds,
        files: options.files,
      });

      return { success: true, message: "Message edited" };
    } catch (error) {
      this.logger.Error("EditMessage failed", { error });
      return { success: false, message: "Failed to edit message" };
    }
  }

  async EditReply(
    interaction: ButtonInteraction,
    options: ResponderEditOptions
  ): Promise<ResponseResult> {
    if (!interaction.deferred && !interaction.replied) {
      return {
        success: false,
        message: "Cannot edit reply without deferring first",
      };
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
      this.logger.Error("EditReply failed", { error });
      return { success: false, message: "Failed to edit reply" };
    }
  }

  async Reply(
    interaction: ButtonInteraction,
    options: ResponseOptions
  ): Promise<ResponseResult> {
    if (interaction.replied || interaction.deferred) {
      return {
        success: false,
        message: "Already responded to this interaction",
      };
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

  async FollowUp(
    interaction: ButtonInteraction,
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
      this.logger.Error("FollowUp failed", { error });
      return { success: false, message: "Failed to send follow-up" };
    }
  }
}
