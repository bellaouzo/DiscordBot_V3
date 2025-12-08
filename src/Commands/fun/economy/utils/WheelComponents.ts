import {
  ActionRowComponentData,
  ActionRowData,
  ButtonStyle,
  ComponentType,
  InteractionButtonComponentData,
} from "discord.js";
import { AllowedButtonStyle } from "../types";

interface WheelButtonIds {
  spin: string;
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

export function BuildWheelButtons(
  customIds: WheelButtonIds
): ActionRowData<ActionRowComponentData> {
  return {
    type: ComponentType.ActionRow,
    components: [
      BuildButton({
        customId: customIds.spin,
        label: "Spin",
        emoji: "🎡",
        style: ButtonStyle.Primary,
      }),
    ],
  };
}

export function BuildDisabledWheelButtons(
  customIds: WheelButtonIds
): ActionRowData<ActionRowComponentData> {
  return {
    type: ComponentType.ActionRow,
    components: [
      BuildButton({
        customId: customIds.spin,
        label: "Spin",
        emoji: "🎡",
        style: ButtonStyle.Primary,
        disabled: true,
      }),
    ],
  };
}
