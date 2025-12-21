import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import { Config } from "@middleware";
import { EmbedFactory } from "@utilities";
import { RequestJson } from "@utilities/ApiClient";
import { LoadApiConfig } from "@config/ApiConfig";

interface ComplimentResponse {
  readonly compliment?: string;
  readonly text?: string;
}

const COMPLIMENT_FALLBACKS = [
  "you're absolutely amazing!",
  "you have such a wonderful personality!",
  "you bring joy to everyone around you!",
  "you're incredibly talented!",
  "you have a beautiful heart!",
  "you're so kind and thoughtful!",
  "you make the world a better place!",
  "you're truly special!",
  "you have an amazing sense of humor!",
  "you're incredibly smart!",
  "you're so creative and inspiring!",
  "you have such a positive energy!",
  "you're absolutely wonderful!",
  "you're one of a kind!",
  "you're so genuine and authentic!",
];

const apiConfig = LoadApiConfig();

function GetRandomCompliment(): string {
  return COMPLIMENT_FALLBACKS[
    Math.floor(Math.random() * COMPLIMENT_FALLBACKS.length)
  ];
}

async function FetchCompliment(
  logger: CommandContext["logger"]
): Promise<string> {
  const response = await RequestJson<ComplimentResponse>(
    apiConfig.compliment.url,
    {
      timeoutMs: apiConfig.compliment.timeoutMs,
    }
  );

  if (response.ok && response.data) {
    const compliment = response.data.compliment ?? response.data.text;
    if (compliment && compliment.trim().length > 0) {
      return compliment.trim();
    }
  } else if (!response.ok && response.error) {
    logger.Warn("Compliment API request failed", { error: response.error });
  }

  return GetRandomCompliment();
}

async function ExecuteCompliment(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const targetUser = interaction.options.getUser("user", true);

  const compliment = await FetchCompliment(context.logger);

  const embed = EmbedFactory.Create({
    title: "💝 Random Compliment",
    description: `${targetUser}, ${compliment}`,
  });

  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed],
  });
}

export const ComplimentCommand = CreateCommand({
  name: "compliment",
  description: "Get a random compliment",
  group: "fun",
  config: Config.utility(3),
  configure: (builder) => {
    builder.addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to compliment")
        .setRequired(true)
    );
  },
  execute: ExecuteCompliment,
});
