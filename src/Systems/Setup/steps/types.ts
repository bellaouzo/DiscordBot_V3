import type {
  ActionRowComponentData,
  ActionRowData,
  ChatInputCommandInteraction,
  Guild,
} from "discord.js";
import type { LoadAppConfig } from "@config/AppConfig";
import type { ServerDatabase } from "@database/ServerDatabase";
import type { CreateChannelManager, EmbedFactory } from "@utilities";
import type { ComponentRouter } from "@shared/ComponentRouter";
import type { SelectMenuRouter } from "@shared/SelectMenuRouter";
import type { ButtonResponder } from "@responders/ButtonResponder";
import type {
  NavigationIds,
  SetupDraft,
  SetupResources,
  StepState,
} from "../state";

export interface SetupContext {
  readonly guild: Guild;
  readonly draft: SetupDraft;
  readonly resources: SetupResources;
  readonly ids: NavigationIds;
  readonly stepState: StepState;
  readonly loggingDefaults: ReturnType<typeof LoadAppConfig>["logging"];
  readonly channelManager: ReturnType<typeof CreateChannelManager>;
  readonly serverDb: ServerDatabase;
  readonly ownerId: string;
  readonly selectMenuRouter: SelectMenuRouter;
  readonly componentRouter: ComponentRouter;
  readonly buttonResponder: ButtonResponder;
  updateMessage: () => Promise<void>;
}

export interface SetupStepDefinition {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  buildEmbed(context: SetupContext): ReturnType<typeof EmbedFactory.Create>;
  buildComponents(
    context: SetupContext,
  ): ActionRowData<ActionRowComponentData>[];
  registerHandlers?(context: SetupContext): void;
}

export function BuildProgressIndicator(step: number, total: number): string {
  return Array.from({ length: total }, (_, index) =>
    index + 1 === step ? "●" : "○",
  ).join(" ");
}

export function BuildStepFooter(
  step: number,
  total: number,
  subtitle: string,
): string {
  return `${BuildProgressIndicator(step, total)}  ·  Step ${step} of ${total} · ${subtitle}`;
}

export type SetupGuild = ChatInputCommandInteraction["guild"];
