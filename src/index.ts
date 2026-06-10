import "module-alias/register";
import {
  Bootstrap,
  SetupGracefulShutdown,
  SetupGlobalErrorHandlers,
} from "./Bootstrap";
import { CreateConsoleLogger } from "@shared/Logger";

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
