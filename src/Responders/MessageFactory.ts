import { ResponseOptions } from "./ResponseTypes";
import { EmbedFactory } from "../Utilities/EmbedBuilder";

interface ErrorMessageOptions {
  readonly title: string;
  readonly description: string;
  readonly hint?: string;
}

export function CreateErrorMessage(
  options: ErrorMessageOptions,
): ResponseOptions {
  const embed = EmbedFactory.CreateError({
    title: options.title,
    description: options.description,
    footer: options.hint,
  });

  return {
    embeds: [embed.toJSON()],
  };
}
