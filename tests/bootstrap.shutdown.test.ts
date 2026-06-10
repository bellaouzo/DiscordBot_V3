import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SetupGlobalErrorHandlers,
  SetupGracefulShutdown,
} from "../src/Bootstrap";
import { createMockLogger } from "./helpers";

describe("Bootstrap shutdown helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stops schedulers and closes databases on SIGTERM", async () => {
    const tempStop = vi.fn();
    const raidStop = vi.fn();
    const giveawayStop = vi.fn();
    const close = vi.fn();
    const destroy = vi.fn();
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);

    const resources = {
      tempScheduler: { Stop: tempStop },
      raidScheduler: { Stop: raidStop },
      giveawayScheduler: { Stop: giveawayStop },
      databases: {
        userDb: { Close: close },
        moderationDb: { Close: close },
        serverDb: { Close: close },
        ticketDb: { Close: close },
      },
      client: { destroy },
    };

    SetupGracefulShutdown(resources as never, createMockLogger());
    process.emit("SIGTERM");

    await vi.waitFor(() => {
      expect(tempStop).toHaveBeenCalledOnce();
      expect(raidStop).toHaveBeenCalledOnce();
      expect(giveawayStop).toHaveBeenCalledOnce();
      expect(close).toHaveBeenCalledTimes(4);
      expect(destroy).toHaveBeenCalledOnce();
      expect(exitSpy).toHaveBeenCalledWith(0);
    });
  });

  it("logs global unhandled rejections", () => {
    const logger = createMockLogger();
    SetupGlobalErrorHandlers(logger);

    const reason = new Error("async failure");
    process.emit("unhandledRejection", reason, Promise.resolve());

    expect(logger.Error).toHaveBeenCalledWith(
      "Unhandled promise rejection",
      expect.objectContaining({ error: reason }),
    );
  });
});
