import {
  ActionRowData,
  ChatInputCommandInteraction,
  MessageCreateOptions,
  MessageEditOptions,
  ActionRowComponentData,
  MessageFlags,
} from "discord.js";
import { CreateConsoleLogger, Logger } from "../Shared/Logger";

export type ResponderMessageOptions = Pick<
  MessageCreateOptions,
  "content" | "embeds" | "files"
> & {
  readonly ephemeral?: boolean;
  readonly flags?: MessageFlags[];
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
  if (options.flags?.includes(MessageFlags.Ephemeral)) {
    return MessageFlags.Ephemeral;
  }

  return options.ephemeral ? MessageFlags.Ephemeral : undefined;
}
