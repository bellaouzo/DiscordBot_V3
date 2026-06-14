import { welcomeStep, staffStep, featuresStep } from "./welcomeStaffFeatures";
import { supportLoggingStep } from "./supportLoggingStep";
import { communityStep } from "./communityStep";
import { reviewStep } from "./reviewStep";
import type { SetupStepDefinition } from "./types";

export const SETUP_STEPS: readonly SetupStepDefinition[] = [
  welcomeStep,
  staffStep,
  featuresStep,
  supportLoggingStep,
  communityStep,
  reviewStep,
];

export { SETUP_STEP_COUNT } from "../constants";

export function GetSetupStep(stepNumber: number): SetupStepDefinition {
  const step = SETUP_STEPS[stepNumber - 1];
  if (!step) {
    throw new Error(`Invalid setup step: ${stepNumber}`);
  }
  return step;
}

export function BuildSetupEmbed(context: import("./types").SetupContext) {
  return GetSetupStep(context.stepState.current).buildEmbed(context);
}

export function BuildStepComponents(context: import("./types").SetupContext) {
  return GetSetupStep(context.stepState.current).buildComponents(context);
}
