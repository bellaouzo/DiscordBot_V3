import {
  ActionRowComponentData,
  ActionRowData,
  ButtonStyle,
  ComponentType,
  InteractionButtonComponentData,
} from "discord.js";
import { AllowedButtonStyle } from "../types";

interface RpsButtonIds {
  rock: string;
  paper: string;
  scissors: string;
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

export function BuildRpsButtons(
  customIds: RpsButtonIds
): ActionRowData<ActionRowComponentData> {
  return {
    type: ComponentType.ActionRow,
    components: [
      BuildButton({
        customId: customIds.rock,
        label: "Rock",
        emoji: "🪨",
        style: ButtonStyle.Primary,
      }),
      BuildButton({
        customId: customIds.paper,
        label: "Paper",
        emoji: "📄",
        style: ButtonStyle.Primary,
      }),
      BuildButton({
        customId: customIds.scissors,
        label: "Scissors",
        emoji: "✂️",
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

export function BuildDisabledRpsButtons(
  customIds: RpsButtonIds
): ActionRowData<ActionRowComponentData> {
  return {
    type: ComponentType.ActionRow,
    components: [
      BuildButton({
        customId: customIds.rock,
        label: "Rock",
        emoji: "🪨",
        style: ButtonStyle.Primary,
        disabled: true,
      }),
      BuildButton({
        customId: customIds.paper,
        label: "Paper",
        emoji: "📄",
        style: ButtonStyle.Primary,
        disabled: true,
      }),
      BuildButton({
        customId: customIds.scissors,
        label: "Scissors",
        emoji: "✂️",
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
