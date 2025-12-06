import "module-alias/register";
import { CreateBot } from "@bot/CreateBot";
import { CreateCommandDeployer } from "@bot/CreateCommandDeployer";
import { CreateCommandLoader } from "@bot/CreateCommandLoader";
import { CreateCommandExecutor } from "@bot/ExecuteCommand";
import { CreateEventLoader } from "@bot/CreateEventLoader";
import { RegisterEvents } from "@bot/RegisterEvents";
import { LoadAppConfig } from "@config/AppConfig";
import { CreateConsoleLogger, Logger } from "@shared/Logger";
import { CreateResponders } from "@responders";
import { RegisterInteractionHandlers } from "./interaction-handlers";

async function Bootstrap(rootLogger: Logger): Promise<void> {
  const config = LoadAppConfig();
  const logger = rootLogger.Child({ phase: "bootstrap" });
  const responders = CreateResponders({ logger });
  const bot = CreateBot({ logger });
  const loadCommands = CreateCommandLoader(logger);
  const loadEvents = CreateEventLoader(logger);
  const deployCommands = CreateCommandDeployer({
    deployment: config.deployment,
    token: config.discord.token,
    logger,
  });
  const executeCommand = CreateCommandExecutor();

  const { commands, modules } = await loadCommands();
  const events = await loadEvents();

  RegisterEvents({
    client: bot.client,
    events,
    logger,
    responders,
  });

  RegisterInteractionHandlers({
    client: bot.client,
    logger,
    componentRouter: responders.componentRouter,
    selectMenuRouter: responders.selectMenuRouter,
    userSelectMenuRouter: responders.userSelectMenuRouter,
  });

  bot.client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = modules.get(interaction.commandName);
    if (!command) {
      return;
    }

    const commandLogger = logger.Child({
      command: command.data.name,
      interactionId: interaction.id,
      guildId: interaction.guildId ?? undefined,
      userId: interaction.user.id,
    });

    await executeCommand(command, interaction, responders, commandLogger);
  });

  await deployCommands(commands);
  await bot.Start(config.discord.token);
}

const bootstrapLogger = CreateConsoleLogger();

Bootstrap(bootstrapLogger).catch((error) => {
  bootstrapLogger.Error("Failed to start bot", {
    error,
    phase: "bootstrap",
  });
});
