import { CreateBot } from "@bot/CreateBot";
import { CreateCommandDeployer } from "@bot/CreateCommandDeployer";
import { CreateCommandLoader } from "@bot/CreateCommandLoader";
import {
  CreateAutocompleteExecutor,
  CreateCommandExecutor,
  CreateContextMenuExecutor,
} from "@bot/ExecuteCommand";
import { CreateEventLoader } from "@bot/CreateEventLoader";
import { RegisterEvents } from "@bot/RegisterEvents";
import { ReplaceCommands, ReplaceContextMenus } from "@commands";
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
import { FindBlocklistMatch } from "@middleware/BlocklistMiddleware";
import { TempActionScheduler } from "@systems/Moderation/TempActionScheduler";
import { RaidModeScheduler } from "@systems/Moderation/RaidModeScheduler";
import { GiveawayScheduler } from "@systems/Giveaway/GiveawayScheduler";
import { EventScheduler } from "@systems/Event/EventScheduler";
import { LotteryScheduler } from "@systems/Economy/LotteryScheduler";
import { RegisterAllSystems } from "./Bootstrap/SystemRegistry";
import { WebServer } from "./Web/WebServer";
import type { Client } from "discord.js";

/**
 * A long-running component started after login and stopped on shutdown.
 */
export interface BackgroundService {
  Start(): void;
  Stop(): void;
}

export interface AppResources {
  client: Client;
  databases: DatabaseSet;
  /** Started in order after login; stopped in reverse order on shutdown. */
  services: readonly BackgroundService[];
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

  await RegisterAllSystems({
    responders,
    logger: logger.Child({ phase: "systems" }),
    databases,
    appConfig: config,
  });

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
  const executeContextMenu = CreateContextMenuExecutor({
    databases,
    appConfig: config,
  });
  const executeAutocomplete = CreateAutocompleteExecutor({
    databases,
    appConfig: config,
  });
  const services: BackgroundService[] = [
    new TempActionScheduler({
      client: bot.client,
      db: databases.moderationDb,
      logger: logger.Child({ phase: "temp-actions" }),
    }),
    new RaidModeScheduler({
      client: bot.client,
      db: databases.moderationDb,
      logger: logger.Child({ phase: "raid-mode" }),
    }),
    new GiveawayScheduler(
      bot.client,
      databases.userDb,
      logger.Child({ phase: "giveaways" }),
    ),
    new EventScheduler(
      bot.client,
      databases.serverDb,
      logger.Child({ phase: "events" }),
    ),
    new LotteryScheduler(
      bot.client,
      databases.userDb,
      databases.serverDb,
      logger.Child({ phase: "lottery" }),
    ),
    new WebServer(
      bot.client,
      config,
      databases,
      logger.Child({ phase: "web" }),
    ),
  ];

  const loadedCommands = await loadCommands();
  ReplaceCommands(loadedCommands.definitions);
  ReplaceContextMenus(loadedCommands.contextMenus);
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
    findBlocklistMatch: (userId, guildId) =>
      FindBlocklistMatch({
        userId,
        guildId,
        serverDb: databases.serverDb,
        appConfig: config,
      }),
  });

  RegisterCommandHandler({
    client: bot.client,
    executeCommand,
    executeAutocomplete,
    executeContextMenu,
    responders,
    logger,
  });

  await deployCommands(loadedCommands.slashData);
  await bot.Start(config.discord.token);
  for (const service of services) {
    service.Start();
  }

  return {
    client: bot.client,
    databases,
    services,
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

    // Each step is isolated so one failure doesn't leave later resources open.
    const steps: Array<() => unknown> = [
      ...[...resources.services]
        .reverse()
        .map((service) => () => service.Stop()),
      ...Object.values(resources.databases).map((db) => () => db.Close()),
      () => resources.client.destroy(),
    ];

    for (const step of steps) {
      try {
        await step();
      } catch (error) {
        logger.Error("Error during shutdown", { error, phase: "shutdown" });
      }
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
