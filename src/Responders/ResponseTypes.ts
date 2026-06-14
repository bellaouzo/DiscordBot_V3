import type {
  ActionRowData,
  ChatInputCommandInteraction,
  MessageCreateOptions,
  MessageEditOptions,
  ActionRowComponentData,
} from "discord.js";
import { MessageFlags } from "discord.js";
import type { Logger } from "@shared/Logger";
import { CreateConsoleLogger } from "@shared/Logger";

export type ResponderMessageOptions = Pick<
  MessageCreateOptions,
  "content" | "embeds" | "files"
> & {
  readonly flags?: MessageFlags | MessageFlags[];
  readonly components?: ActionRowData<ActionRowComponentData>[];
};

export type ResponderEditOptions = Pick<
  MessageEditOptions,
  "content" | "embeds" | "files" | "components"
>;

export type ResponseOptions = ResponderMessageOptions;

export interface ResponseResult {
  readonly success: boolean;
  readonly message?: string;
}

export interface ResponseActionOptions {
  readonly interaction: ChatInputCommandInteraction;
  readonly message: string | ResponseOptions;
  readonly followUp?:
    | string
    | ResponseOptions
    | (() => string | ResponseOptions);
  readonly error?: string | ResponseOptions;
  readonly action: () => Promise<void>;
}

export interface ResponderDependencies {
  readonly logger?: Logger;
}

export function ResolveResponderLogger(
  dependencies?: ResponderDependencies,
): Logger {
  return dependencies?.logger ?? CreateConsoleLogger();
}

export function ConvertToInteractionFlags(
  options: ResponderMessageOptions,
): MessageFlags.Ephemeral | undefined {
  if (!options.flags) {
    return undefined;
  }

  const flags = Array.isArray(options.flags) ? options.flags : [options.flags];
  return flags.includes(MessageFlags.Ephemeral)
    ? MessageFlags.Ephemeral
    : undefined;
}
