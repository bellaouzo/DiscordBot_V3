import { describe, expect, it, vi } from "vitest";
import { RegisterEvents } from "@bot/RegisterEvents";
import { createMockAppConfig, createMockDatabaseSet, createMockLogger, createMockResponderSet } from "../helpers";

describe("RegisterEvents", () => {
  it("registers and executes event handlers with context", async () => {
    const on = vi.fn();
    const once = vi.fn();
    const client = { on, once } as never;
    const logger = createMockLogger();
    const execute = vi.fn().mockResolvedValue(undefined);
    const event = {
      name: "messageCreate",
      once: false,
      execute,
    } as never;
    const responders = createMockResponderSet();
    const databases = createMockDatabaseSet();
    const appConfig = createMockAppConfig();

    RegisterEvents({
      client,
      events: [event],
      logger,
      responders,
      databases,
      appConfig,
    });

    expect(on).toHaveBeenCalledTimes(1);
    const handler = on.mock.calls[0][1] as (...args: unknown[]) => Promise<void>;
    const payload = { id: "message-1" };

    await handler(payload);

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        responders,
        databases,
        appConfig,
      }),
      payload
    );
  });

  it("logs event handler exceptions without throwing", async () => {
    const on = vi.fn();
    const client = { on, once: vi.fn() } as never;
    const logger = createMockLogger();
    const execute = vi.fn().mockRejectedValue(new Error("boom"));
    const event = {
      name: "messageDelete",
      once: false,
      execute,
    } as never;

    RegisterEvents({
      client,
      events: [event],
      logger,
      responders: createMockResponderSet(),
      databases: createMockDatabaseSet(),
      appConfig: createMockAppConfig(),
    });

    const handler = on.mock.calls[0][1] as (...args: unknown[]) => Promise<void>;
    await expect(handler({ id: "msg-1" })).resolves.toBeUndefined();
    expect(logger.Error).toHaveBeenCalledWith(
      "Event handler failed",
      expect.objectContaining({ error: expect.any(Error) })
    );
  });
});
