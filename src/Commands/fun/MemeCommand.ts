import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import { LoggingMiddleware } from "@middleware/LoggingMiddleware";
import { ErrorMiddleware } from "@middleware/ErrorMiddleware";
import { CooldownMiddleware } from "@middleware/CooldownMiddleware";
import { Config } from "@middleware/CommandConfig";
import { EmbedFactory } from "@utilities";
import { RequestJson } from "@utilities/ApiClient";

interface MemeResponse {
  readonly title?: string;
  readonly url?: string;
  readonly postLink?: string;
  readonly subreddit?: string;
  readonly nsfw?: boolean;
  readonly spoiler?: boolean;
}

function BuildMemeUrl(subreddit?: string | null): string {
  const trimmed = subreddit?.trim();
  if (trimmed && trimmed.length > 0) {
    return `https://meme-api.com/gimme/${encodeURIComponent(trimmed)}`;
  }
  return "https://meme-api.com/gimme";
}

function CreateMemeEmbed(payload: MemeResponse): EmbedBuilder | null {
  if (!payload.url || !payload.title) {
    return null;
  }

  const embed = EmbedFactory.Create({
    title: payload.title,
    description: payload.postLink ? `[Source](${payload.postLink})` : undefined,
    footer: payload.subreddit ? `r/${payload.subreddit}` : undefined,
  });

  embed.setImage(payload.url);
  return embed;
}

async function ExecuteMeme(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  const subreddit = interaction.options.getString("subreddit");

  const response = await RequestJson<MemeResponse>(BuildMemeUrl(subreddit), {
    timeoutMs: 5000,
  });

  if (!response.ok || !response.data) {
    await interactionResponder.Reply(interaction, {
      content: "Could not fetch a meme right now. Try again in a moment.",
      ephemeral: true,
    });
    return;
  }

  if (response.data.nsfw) {
    await interactionResponder.Reply(interaction, {
      content: "Skipped an NSFW meme. Try a different subreddit.",
      ephemeral: true,
    });
    return;
  }

  const embed = CreateMemeEmbed(response.data);
  if (!embed) {
    await interactionResponder.Reply(interaction, {
      content: "Meme response was empty. Try again.",
      ephemeral: true,
    });
    return;
  }

  await interactionResponder.Reply(interaction, {
    embeds: [embed],
  });
}

export const MemeCommand = CreateCommand({
  name: "meme",
  description: "Get a random meme (optionally from a subreddit)",
  group: "fun",
  middleware: {
    before: [LoggingMiddleware, CooldownMiddleware],
    after: [ErrorMiddleware],
  },
  config: Config.utility(3),
  configure: (builder) => {
    builder.addStringOption((option) =>
      option
        .setName("subreddit")
        .setDescription(
          "Fetch from a specific subreddit (e.g., memes, dankmemes)"
        )
        .setRequired(false)
    );
  },
  execute: ExecuteMeme,
});
