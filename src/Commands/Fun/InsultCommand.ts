import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import { Config } from "@middleware";
import { EmbedFactory } from "@utilities";
import { RequestJson } from "@utilities/ApiClient";
import { LoadApiConfig } from "@config/ApiConfig";

interface InsultResponse {
  readonly insult?: string;
}

const apiConfig = LoadApiConfig();

async function ExecuteInsult(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const targetUser = interaction.options.getUser("user", true);

  const response = await RequestJson<InsultResponse>(apiConfig.insult.url, {
    query: { lang: "en", type: "json" },
    timeoutMs: apiConfig.insult.timeoutMs,
  });

  if (!response.ok || !response.data) {
    throw new Error(response.error ?? "Insult API request failed");
  }

  const insult = response.data.insult;
  if (!insult) {
    throw new Error("The insult service returned an empty response");
  }

  const embed = EmbedFactory.Create({
    title: "💀 Random Insult",
    description: `${targetUser}, ${insult}`,
  });

  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed],
  });
}

export const InsultCommand = CreateCommand({
  name: "insult",
  description: "Get a random insult",
  group: "fun",
  config: Config.utility(3),
  configure: (builder) => {
    builder.addUserOption((option) =>
      option.setName("user").setDescription("User to insult").setRequired(true)
    );
  },
  execute: ExecuteInsult,
});
