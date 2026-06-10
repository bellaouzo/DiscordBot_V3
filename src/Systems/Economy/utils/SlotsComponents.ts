import type {
  ActionRowComponentData,
  ActionRowData,
  InteractionButtonComponentData,
} from "discord.js";
import { ButtonStyle, ComponentType } from "discord.js";
import type { AllowedButtonStyle } from "../types";

interface SlotsButtonIds {
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

export function BuildSlotsButtons(
  customIds: SlotsButtonIds,
): ActionRowData<ActionRowComponentData> {
  return {
    type: ComponentType.ActionRow,
    components: [
      BuildButton({
        customId: customIds.spin,
        label: "Spin",
        emoji: "🎰",
        style: ButtonStyle.Success,
      }),
    ],
  };
}

export function BuildDisabledSlotsButtons(
  customIds: SlotsButtonIds,
): ActionRowData<ActionRowComponentData> {
  return {
    type: ComponentType.ActionRow,
    components: [
      BuildButton({
        customId: customIds.spin,
        label: "Spin",
        emoji: "🎰",
        style: ButtonStyle.Success,
        disabled: true,
      }),
    ],
  };
}
