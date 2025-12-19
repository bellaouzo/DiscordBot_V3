import "module-alias/register";
import { CreateBot } from "@bot/CreateBot";
import { CreateCommandDeployer } from "@bot/CreateCommandDeployer";
import { CreateCommandLoader } from "@bot/CreateCommandLoader";
import { CreateCommandExecutor } from "@bot/ExecuteCommand";
import { CreateEventLoader } from "@bot/CreateEventLoader";
import { RegisterEvents } from "@bot/RegisterEvents";
import { LoadAppConfig } from "@config/AppConfig";
import {
  ModerationDatabase,
  UserDatabase,
  ServerDatabase,
  TicketDatabase,
  DatabaseSet,
} from "@database";
import { CreateConsoleLogger, Logger } from "@shared/Logger";
import { CreateResponders } from "@responders";
import { RegisterInteractionHandlers } from "./interaction-handlers";
import { TempActionScheduler } from "./Moderation/TempActionScheduler";
import { RaidModeScheduler } from "./Moderation/RaidModeScheduler";
import { GiveawayScheduler } from "@systems/giveaway/GiveawayScheduler";
import { Client } from "discord.js";

interface AppResources {
  client: Client;
  databases: DatabaseSet;
  tempScheduler: TempActionScheduler;
  raidScheduler: RaidModeScheduler;
  giveawayScheduler: GiveawayScheduler;
}

async function Bootstrap(rootLogger: Logger): Promise<AppResources> {
  const config = LoadAppConfig();
  const logger = rootLogger.Child({ phase: "bootstrap" });

  // Create shared database instances
  const databases: DatabaseSet = {
    userDb: new UserDatabase(logger.Child({ phase: "user-db" })),
    moderationDb: new ModerationDatabase(logger.Child({ phase: "mod-db" })),
    serverDb: new ServerDatabase(logger.Child({ phase: "server-db" })),
    ticketDb: new TicketDatabase(logger.Child({ phase: "ticket-db" })),
  };

  const responders = CreateResponders({ logger });
  const bot = CreateBot({ logger });
  const loadCommands = CreateCommandLoader(logger);
  const loadEvents = CreateEventLoader(logger);
  const deployCommands = CreateCommandDeployer({
    deployment: config.deployment,
    token: config.discord.token,
    logger,
  });
  const executeCommand = CreateCommandExecutor({ databases });
  const tempScheduler = new TempActionScheduler({
    client: bot.client,
    db: databases.moderationDb,
    logger: logger.Child({ phase: "temp-actions" }),
  });
  const raidScheduler = new RaidModeScheduler({
    client: bot.client,
    db: databases.moderationDb,
    logger: logger.Child({ phase: "raid-mode" }),
  });
  const giveawayScheduler = new GiveawayScheduler(
    bot.client,
    databases.userDb,
    logger.Child({ phase: "giveaways" })
  );

  const { commands, modules } = await loadCommands();
  const events = await loadEvents();

  RegisterEvents({
    client: bot.client,
    events,
    logger,
    responders,
    databases,
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
  tempScheduler.Start();
  raidScheduler.Start();
  giveawayScheduler.Start();

  return {
    client: bot.client,
    databases,
    tempScheduler,
    raidScheduler,
    giveawayScheduler,
  };
}

function SetupGracefulShutdown(resources: AppResources, logger: Logger): void {
  let isShuttingDown = false;

  const shutdown = async (): Promise<void> => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    // logger.Info(`Received ${signal}, shutting down gracefully...`, {
    //   phase: "shutdown",
    // });

    try {
      resources.tempScheduler.Stop();
      resources.raidScheduler.Stop();
      resources.giveawayScheduler.Stop();
      resources.databases.userDb.Close();
      resources.databases.moderationDb.Close();
      resources.databases.serverDb.Close();
      resources.databases.ticketDb.Close();
      resources.client.destroy();
    } catch (error) {
      logger.Error("Error during shutdown", { error, phase: "shutdown" });
    }

    process.exit(0);
  };

  process.on("SIGINT", () => shutdown());
  process.on("SIGTERM", () => shutdown());
}

function SetupGlobalErrorHandlers(logger: Logger): void {
  process.on("unhandledRejection", (reason, promise) => {
    logger.Error("Unhandled promise rejection", {
      error: reason,
      extra: { promise: String(promise) },
      phase: "error",
    });
  });

  process.on("uncaughtException", (error) => {
    logger.Error("Uncaught exception", { error, phase: "error" });
    process.exit(1);
  });
}

const bootstrapLogger = CreateConsoleLogger();

SetupGlobalErrorHandlers(bootstrapLogger);

Bootstrap(bootstrapLogger)
  .then((resources) => {
    SetupGracefulShutdown(resources, bootstrapLogger);
  })
  .catch((error) => {
    bootstrapLogger.Error("Failed to start bot", {
      error,
      phase: "bootstrap",
    });
    process.exit(1);
  });
