import {
  ActionRowComponentData,
  ActionRowData,
  ButtonStyle,
  ComponentType,
  InteractionButtonComponentData,
} from "discord.js";
import { AllowedButtonStyle } from "../types";

interface ScratchButtonIds {
  slots: string[];
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

export function BuildScratchButtons(
  customIds: ScratchButtonIds,
  labels: string[],
  columns = 3,
  disabledIndices: Set<number> = new Set()
): ActionRowData<ActionRowComponentData>[] {
  const rows: ActionRowData<ActionRowComponentData>[] = [];

  for (let i = 0; i < customIds.slots.length; i += columns) {
    rows.push({
      type: ComponentType.ActionRow,
      components: customIds.slots.slice(i, i + columns).map((id, idx) =>
        BuildButton({
          customId: id,
          label: labels[i + idx] ?? `Scratch ${i + idx + 1}`,
          emoji: "🎟️",
          style: ButtonStyle.Primary,
          disabled: disabledIndices.has(i + idx),
        })
      ),
    });
  }

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

export function BuildDisabledScratchButtons(
  customIds: ScratchButtonIds,
  labels: string[],
  columns = 3
): ActionRowData<ActionRowComponentData>[] {
  const rows: ActionRowData<ActionRowComponentData>[] = [];

  for (let i = 0; i < customIds.slots.length; i += columns) {
    rows.push({
      type: ComponentType.ActionRow,
      components: customIds.slots.slice(i, i + columns).map((id, idx) =>
        BuildButton({
          customId: id,
          label: labels[i + idx] ?? `Scratch ${i + idx + 1}`,
          emoji: "🎟️",
          style: ButtonStyle.Primary,
          disabled: true,
        })
      ),
    });
  }

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

