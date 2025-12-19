import {
  ActionRowComponentData,
  ActionRowData,
  ButtonStyle,
  ComponentType,
  InteractionButtonComponentData,
} from "discord.js";
import { AllowedButtonStyle } from "../types";

interface HorseButtonIds {
  horses: string[];
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

export function BuildHorseButtons(
  customIds: HorseButtonIds,
  horseLabels: string[]
): ActionRowData<ActionRowComponentData>[] {
  const rows: ActionRowData<ActionRowComponentData>[] = [];

  const horseButtons = horseLabels.map((label, index) =>
    BuildButton({
      customId: customIds.horses[index],
      label,
      emoji: "🏇",
      style: ButtonStyle.Primary,
    })
  );

  // One row for horses (up to 4 fits in one row)
  rows.push({
    type: ComponentType.ActionRow,
    components: horseButtons,
  });

  // Cancel row
  rows.push({
    type: ComponentType.ActionRow,
    components: [
      BuildButton({
        customId: customIds.cancel,
        label: "Cancel",
        emoji: "🛑",
        style: ButtonStyle.Secondary,
      }),
    ],
  });

  return rows;
}

export function BuildDisabledHorseButtons(
  customIds: HorseButtonIds,
  horseLabels: string[]
): ActionRowData<ActionRowComponentData>[] {
  const rows: ActionRowData<ActionRowComponentData>[] = [];

  const horseButtons = horseLabels.map((label, index) =>
    BuildButton({
      customId: customIds.horses[index],
      label,
      emoji: "🏇",
      style: ButtonStyle.Primary,
      disabled: true,
    })
  );

  rows.push({
    type: ComponentType.ActionRow,
    components: horseButtons,
  });

  rows.push({
    type: ComponentType.ActionRow,
    components: [
      BuildButton({
        customId: customIds.cancel,
        label: "Cancel",
        emoji: "🛑",
        style: ButtonStyle.Secondary,
        disabled: true,
      }),
    ],
  });

  return rows;
}

