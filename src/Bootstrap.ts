import { CreateBot } from "@bot/CreateBot";
import { CreateCommandDeployer } from "@bot/CreateCommandDeployer";
import { CreateCommandLoader } from "@bot/CreateCommandLoader";
import { CreateCommandExecutor } from "@bot/ExecuteCommand";
import { CreateEventLoader } from "@bot/CreateEventLoader";
import { RegisterEvents } from "@bot/RegisterEvents";
import { ReplaceCommands } from "@commands";
import { LoadAppConfig } from "@config/AppConfig";
import {
  ListMissingRequiredFeatureApiKeys,
  ListStrictStartupFeatureViolations,
  StrictFeatureKeysEnabled,
} from "@config/ApiConfig";
import type { DatabaseSet } from "@database";
import {
  ModerationDatabase,
  UserDatabase,
  ServerDatabase,
  TicketDatabase,
} from "@database";
import type { Logger } from "@shared/Logger";
import { CreateResponders } from "@responders";
import {
  RegisterInteractionHandlers,
  RegisterCommandHandler,
} from "./interaction-handlers";
import { ConfigureCooldownPersistence } from "@middleware/CooldownState";
import { TempActionScheduler } from "./Moderation/TempActionScheduler";
import { RaidModeScheduler } from "./Moderation/RaidModeScheduler";
import { GiveawayScheduler } from "@systems/Giveaway/GiveawayScheduler";
import { EventScheduler } from "@systems/Event/EventScheduler";
import { LotteryScheduler } from "@systems/Economy/LotteryScheduler";
import { RegisterAppealPanelButton } from "@commands/Moderation/Appeal/AppealPanelFlow";
import { RegisterTicketButtons } from "@systems/Ticket/TicketButtonRegistry";
import { RegisterTicketPanelButton } from "@systems/Ticket/TicketPanelFlow";
import type { Client } from "discord.js";

export interface AppResources {
  client: Client;
  databases: DatabaseSet;
  tempScheduler: TempActionScheduler;
  raidScheduler: RaidModeScheduler;
  giveawayScheduler: GiveawayScheduler;
  eventScheduler: EventScheduler;
  lotteryScheduler: LotteryScheduler;
}

export async function Bootstrap(rootLogger: Logger): Promise<AppResources> {
  const config = LoadAppConfig();
  const logger = rootLogger.Child({ phase: "bootstrap" });
  const strictFeatureKeys = StrictFeatureKeysEnabled();
  const strictViolations = strictFeatureKeys
    ? ListStrictStartupFeatureViolations()
    : [];
  if (strictFeatureKeys && strictViolations.length > 0) {
    throw new Error(
      `Strict feature key validation failed:\n${strictViolations
        .map((entry) => entry.message)
        .join("\n")}`,
    );
  }

  const missingApiKeys = ListMissingRequiredFeatureApiKeys();
  if (!strictFeatureKeys && missingApiKeys.length > 0) {
    logger.Warn("Required API keys are missing for optional features", {
      extra: {
        missing: missingApiKeys.map((entry) => ({
          feature: entry.feature,
          envVar: entry.envVar,
        })),
      },
    });
  }

  const databases: DatabaseSet = {
    userDb: new UserDatabase(logger.Child({ phase: "user-db" })),
    moderationDb: new ModerationDatabase(logger.Child({ phase: "mod-db" })),
    serverDb: new ServerDatabase(logger.Child({ phase: "server-db" })),
    ticketDb: new TicketDatabase(logger.Child({ phase: "ticket-db" })),
  };

  if (process.env.COOLDOWN_PERSIST === "1") {
    ConfigureCooldownPersistence(databases.serverDb);
    logger.Info("Command cooldown persistence enabled (SQLite)");
  }

  const responders = CreateResponders({ logger });

  RegisterAppealPanelButton({
    responders,
    logger: logger.Child({ phase: "appeal-panel" }),
    databases,
    appConfig: config,
  });

  const ticketContext = {
    responders,
    logger: logger.Child({ phase: "ticket-system" }),
    databases,
    appConfig: config,
  };

  RegisterTicketButtons(ticketContext);
  RegisterTicketPanelButton(ticketContext);

  const bot = CreateBot({ logger });
  const loadCommands = CreateCommandLoader(logger);
  const loadEvents = CreateEventLoader(logger);
  const deployCommands = CreateCommandDeployer({
    deployment: config.deployment,
    token: config.discord.token,
    logger,
  });
  const executeCommand = CreateCommandExecutor({
    databases,
    appConfig: config,
  });
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
    logger.Child({ phase: "giveaways" }),
  );
  const eventScheduler = new EventScheduler(
    bot.client,
    databases.serverDb,
    logger.Child({ phase: "events" }),
  );
  const lotteryScheduler = new LotteryScheduler(
    bot.client,
    databases.userDb,
    logger.Child({ phase: "lottery" }),
  );

  const loadedCommands = await loadCommands();
  ReplaceCommands(loadedCommands.definitions);
  const events = await loadEvents();

  RegisterEvents({
    client: bot.client,
    events,
    logger,
    responders,
    databases,
    appConfig: config,
  });

  RegisterInteractionHandlers({
    client: bot.client,
    logger,
    componentRouter: responders.componentRouter,
    selectMenuRouter: responders.selectMenuRouter,
    userSelectMenuRouter: responders.userSelectMenuRouter,
    modalRouter: responders.modalRouter,
  });

  RegisterCommandHandler({
    client: bot.client,
    executeCommand,
    responders,
    logger,
  });

  await deployCommands(loadedCommands.slashData);
  await bot.Start(config.discord.token);
  tempScheduler.Start();
  raidScheduler.Start();
  giveawayScheduler.Start();
  eventScheduler.Start();
  lotteryScheduler.Start();

  return {
    client: bot.client,
    databases,
    tempScheduler,
    raidScheduler,
    giveawayScheduler,
    eventScheduler,
    lotteryScheduler,
  };
}

export function SetupGracefulShutdown(
  resources: AppResources,
  logger: Logger,
): void {
  let isShuttingDown = false;

  const shutdown = async (): Promise<void> => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.Info("Shutting down gracefully...", {
      phase: "shutdown",
    });

    try {
      resources.tempScheduler.Stop();
      resources.raidScheduler.Stop();
      resources.giveawayScheduler.Stop();
      resources.eventScheduler.Stop();
      resources.lotteryScheduler.Stop();
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

export function SetupGlobalErrorHandlers(logger: Logger): void {
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
