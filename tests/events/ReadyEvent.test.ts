import { describe, expect, it, vi } from "vitest";
import { ReadyEvent } from "@events/Client/ReadyEvent";
import {
  createMockAppConfig,
  createMockDatabaseSet,
  createMockLogger,
  createMockResponderSet,
} from "../helpers";

describe("ReadyEvent", () => {
  it("logs when the bot is online and ready", async () => {
    const logger = createMockLogger();
    const setPresence = vi.fn().mockResolvedValue(undefined);

    await ReadyEvent.execute({
      client: {
        user: { tag: "Bot#1234", setPresence },
        guilds: { cache: { size: 3 } },
        ws: { ping: 55 },
      } as never,
      logger,
      responders: createMockResponderSet(),
      databases: createMockDatabaseSet(),
      appConfig: createMockAppConfig(),
    });

    expect(logger.Info).toHaveBeenCalledWith(
      "Bot is online and ready",
      expect.objectContaining({
        extra: expect.objectContaining({
          tag: "Bot#1234",
          guilds: 3,
          apiLatencyMs: 55,
        }),
      }),
    );
    expect(setPresence).toHaveBeenCalledOnce();
  });
});
