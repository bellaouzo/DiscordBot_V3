import {
  ActionRowComponentData,
  ActionRowData,
  ButtonStyle,
  ComponentType,
  InteractionButtonComponentData,
} from "discord.js";
import { AllowedButtonStyle } from "../types";

interface BlackjackButtonIds {
  hit: string;
  stand: string;
  double: string;
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

export function BuildBlackjackButtons(
  customIds: BlackjackButtonIds,
  options?: { canDouble: boolean; disabled?: boolean }
): ActionRowData<ActionRowComponentData> {
  const disabledAll = options?.disabled ?? false;
  const canDouble = options?.canDouble ?? false;

  return {
    type: ComponentType.ActionRow,
    components: [
      BuildButton({
        customId: customIds.hit,
        label: "Hit",
        emoji: "🃏",
        style: ButtonStyle.Primary,
        disabled: disabledAll,
      }),
      BuildButton({
        customId: customIds.stand,
        label: "Stand",
        emoji: "✋",
        style: ButtonStyle.Secondary,
        disabled: disabledAll,
      }),
      BuildButton({
        customId: customIds.double,
        label: "Double",
        emoji: "💰",
        style: ButtonStyle.Success,
        disabled: disabledAll || !canDouble,
      }),
      BuildButton({
        customId: customIds.cancel,
        label: "Cancel",
        emoji: "🛑",
        style: ButtonStyle.Danger,
        disabled: disabledAll,
      }),
    ],
  };
}

export function BuildDisabledBlackjackButtons(
  customIds: BlackjackButtonIds
): ActionRowData<ActionRowComponentData> {
  return BuildBlackjackButtons(customIds, { canDouble: false, disabled: true });
}

