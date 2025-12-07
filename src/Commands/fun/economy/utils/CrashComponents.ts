import {
  ActionRowComponentData,
  ActionRowData,
  ButtonStyle,
  ComponentType,
  InteractionButtonComponentData,
} from "discord.js";
import { AllowedButtonStyle } from "../types";

interface CrashButtonIds {
  cashout: string;
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

export function BuildCrashButtons(
  customIds: CrashButtonIds
): ActionRowData<ActionRowComponentData> {
  return {
    type: ComponentType.ActionRow,
    components: [
      BuildButton({
        customId: customIds.cashout,
        label: "Cash Out",
        emoji: "💸",
        style: ButtonStyle.Success,
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

export function BuildDisabledCrashButtons(
  customIds: CrashButtonIds
): ActionRowData<ActionRowComponentData> {
  return {
    type: ComponentType.ActionRow,
    components: [
      BuildButton({
        customId: customIds.cashout,
        label: "Cash Out",
        emoji: "💸",
        style: ButtonStyle.Success,
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
