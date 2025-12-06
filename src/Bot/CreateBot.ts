import { Client, GatewayIntentBits } from "discord.js";
import { Logger } from "../Shared/Logger";

export interface BotDependencies {
  readonly intents?: number[];
  readonly logger: Logger;
}

export interface BotLifecycle {
  readonly client: Client;
  Start(token: string): Promise<void>;
}

export function CreateBot(dependencies: BotDependencies): BotLifecycle {
  const client = new Client({
    intents: dependencies.intents ?? [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  return {
    client,
    Start: async (token: string) => {
      await client.login(token);
    },
  };
}
