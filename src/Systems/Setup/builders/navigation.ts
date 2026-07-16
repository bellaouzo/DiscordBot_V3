import type { ActionRowComponentData, ActionRowData } from "discord.js";
import { ButtonStyle } from "discord.js";
import { ComponentFactory } from "@utilities";
import type { NavigationIds } from "../state";
import { SETUP_STEP_COUNT } from "../constants";

export function BuildNavigationRow(options: {
  step: number;
  ids: NavigationIds;
}): ActionRowData<ActionRowComponentData> {
  const { step, ids } = options;
  const isWelcomeStep = step === 1;
  const isFinalStep = step >= SETUP_STEP_COUNT;
  const buttons: Array<{
    label: string;
    style: ButtonStyle;
    emoji?: string;
    disabled?: boolean;
  }> = [];
  const customIds: string[] = [];

  if (!isWelcomeStep) {
    buttons.push({
      label: "Back",
      style: ButtonStyle.Secondary,
      emoji: "◀",
      disabled: false,
    });
    customIds.push(ids.back);
  }

  if (!isFinalStep) {
    buttons.push({
      label: isWelcomeStep ? "Get Started" : "Next",
      style: ButtonStyle.Primary,
      emoji: isWelcomeStep ? "🚀" : "▶",
    });
    customIds.push(ids.next);
  }

  buttons.push({
    label: isFinalStep ? "Save & Finish" : "Save",
    style: ButtonStyle.Success,
    emoji: "💾",
  });
  customIds.push(ids.saveAndQuit);

  buttons.push({
    label: "Cancel",
    style: ButtonStyle.Danger,
    emoji: "✖",
  });
  customIds.push(ids.cancel);

  return ComponentFactory.CreateActionRow({
    buttons,
    customIds,
  }).toJSON() as ActionRowData<ActionRowComponentData>;
}
