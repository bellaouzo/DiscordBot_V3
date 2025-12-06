import { CommandMiddleware } from "./index";

export const LoggingMiddleware: CommandMiddleware = {
  name: "logging",
  execute: async (_context, next) => {
    await next();
  },
};
