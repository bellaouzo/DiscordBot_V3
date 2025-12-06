import { CreateBot } from "./Bot/CreateBot";
import { CreateCommandDeployer } from "./Bot/CreateCommandDeployer";
import { CreateCommandLoader } from "./Bot/CreateCommandLoader";
import { CreateCommandExecutor } from "./Bot/ExecuteCommand";
import { CreateEventLoader } from "./Bot/CreateEventLoader";
import { RegisterEvents } from "./Bot/RegisterEvents";
import { LoadAppConfig } from "./Config/AppConfig";
import { CreateConsoleLogger, Logger } from "./Shared/Logger";
import { CreateResponders } from "./Responders";
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
