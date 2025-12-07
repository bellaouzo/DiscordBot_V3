import {
  ActionRowComponentData,
  ActionRowData,
  ButtonStyle,
  ComponentType,
  InteractionButtonComponentData,
} from "discord.js";
import { AllowedButtonStyle } from "../types";

interface FlipButtonIds {
  heads: string;
  tails: string;
  cancel: string;
}

function BuildButton(options: {
  customId: string;
  label: string;
  emoji?: string;
  style: AllowedButtonStyle;
  disabled?: boolean;
}): InteractionButtonComponentData {
  return {
    type: ComponentType.Button,
    customId: options.customId,
    label: options.label,
    style: options.style,
    disabled: options.disabled ?? false,
    emoji: options.emoji ? { name: options.emoji } : undefined,
  };
}

export function BuildFlipButtons(
  customIds: FlipButtonIds
): ActionRowData<ActionRowComponentData> {
  return {
    type: ComponentType.ActionRow,
    components: [
      BuildButton({
        customId: customIds.heads,
        label: "Heads",
        emoji: "🪙",
        style: ButtonStyle.Primary,
      }),
      BuildButton({
        customId: customIds.tails,
        label: "Tails",
        emoji: "🎲",
        style: ButtonStyle.Primary,
      }),
      BuildButton({
        customId: customIds.cancel,
        label: "Cancel",
        emoji: "🛑",
        style: ButtonStyle.Secondary,
      }),
    ],
  };
}

export function BuildDisabledFlipButtons(
  customIds: FlipButtonIds
): ActionRowData<ActionRowComponentData> {
  return {
    type: ComponentType.ActionRow,
    components: [
      BuildButton({
        customId: customIds.heads,
        label: "Heads",
        emoji: "🪙",
        style: ButtonStyle.Primary,
        disabled: true,
      }),
      BuildButton({
        customId: customIds.tails,
        label: "Tails",
        emoji: "🎲",
        style: ButtonStyle.Primary,
        disabled: true,
      }),
      BuildButton({
        customId: customIds.cancel,
        label: "Cancel",
        emoji: "🛑",
        style: ButtonStyle.Secondary,
        disabled: true,
      }),
    ],
  };
}
