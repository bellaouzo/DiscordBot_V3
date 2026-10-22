import type {
  ActionRowComponentData,
  ActionRowData,
  InteractionButtonComponentData,
} from "discord.js";
import { ButtonStyle, ComponentType } from "discord.js";
import type { AllowedButtonStyle } from "../types";

type ButtonRow = ActionRowData<ActionRowComponentData>;

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

/**
 * Answer buttons for a work task. Once answered, every button is disabled, the correct one
 * turns green and a wrong pick turns red.
 */
export function BuildWorkButtons(options: {
  customIds: readonly string[];
  labels: readonly string[];
  answered?: { chosenIndex: number; correctIndex: number };
}): ButtonRow {
  return {
    type: ComponentType.ActionRow,
    components: options.labels.map((label, index) => {
      let style: AllowedButtonStyle = ButtonStyle.Secondary;
      if (options.answered?.correctIndex === index) {
        style = ButtonStyle.Success;
      } else if (options.answered?.chosenIndex === index) {
        style = ButtonStyle.Danger;
      }
      return BuildButton({
        customId: options.customIds[index],
        label,
        style,
        disabled: options.answered !== undefined,
      });
    }),
  };
}

export function BuildFishCastButton(options: {
  castId: string;
  disabled?: boolean;
}): ButtonRow {
  return {
    type: ComponentType.ActionRow,
    components: [
      BuildButton({
        customId: options.castId,
        label: "Cast",
        emoji: "🎣",
        style: ButtonStyle.Primary,
        disabled: options.disabled,
      }),
    ],
  };
}

export type FishReelState = "waiting" | "bite" | "done";

export function BuildFishReelButton(options: {
  reelId: string;
  state: FishReelState;
}): ButtonRow {
  return {
    type: ComponentType.ActionRow,
    components: [
      BuildButton({
        customId: options.reelId,
        label: "Reel",
        emoji: "🪝",
        style:
          options.state === "bite"
            ? ButtonStyle.Success
            : ButtonStyle.Secondary,
        disabled: options.state === "done",
      }),
    ],
  };
}
