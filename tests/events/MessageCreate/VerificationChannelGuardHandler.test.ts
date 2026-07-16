import { describe, expect, it, vi } from "vitest";
import { VerificationChannelGuardHandler } from "@events/MessageCreate/VerificationChannelGuardHandler";
import { createMockLogger, createMockDatabaseSet } from "../../helpers";

function createContext(settings: unknown) {
  const databases = createMockDatabaseSet();
  vi.mocked(databases.serverDb.GetGuildSettings).mockReturnValue(
    settings as never,
  );

  return {
    logger: createMockLogger(),
    databases,
  };
}

describe("VerificationChannelGuardHandler", () => {
  it("continues when the channel is not the verification channel", async () => {
    const context = createContext({
      verification_enabled: true,
      verification_channel_id: "verify-1",
    });
    const msg = {
      guild: { id: "guild-1" },
      channelId: "general-1",
      delete: vi.fn(),
    };

    await expect(
      VerificationChannelGuardHandler.execute(context as never, msg as never),
    ).resolves.toBe("continue");
    expect(msg.delete).not.toHaveBeenCalled();
  });

  it("continues when verification is disabled", async () => {
    const context = createContext({
      verification_enabled: false,
      verification_channel_id: "verify-1",
    });
    const msg = {
      guild: { id: "guild-1" },
      channelId: "verify-1",
      delete: vi.fn(),
    };

    await expect(
      VerificationChannelGuardHandler.execute(context as never, msg as never),
    ).resolves.toBe("continue");
    expect(msg.delete).not.toHaveBeenCalled();
  });

  it("deletes member messages in the verification channel", async () => {
    const context = createContext({
      verification_enabled: true,
      verification_channel_id: "verify-1",
    });
    const msg = {
      guild: { id: "guild-1" },
      channelId: "verify-1",
      id: "msg-1",
      delete: vi.fn().mockResolvedValue(undefined),
    };

    await expect(
      VerificationChannelGuardHandler.execute(context as never, msg as never),
    ).resolves.toBe("stop");
    expect(msg.delete).toHaveBeenCalledOnce();
  });

  it("stops even when delete fails", async () => {
    const context = createContext({
      verification_enabled: true,
      verification_channel_id: "verify-1",
    });
    const msg = {
      guild: { id: "guild-1" },
      channelId: "verify-1",
      id: "msg-1",
      delete: vi.fn().mockRejectedValue(new Error("missing permissions")),
    };

    await expect(
      VerificationChannelGuardHandler.execute(context as never, msg as never),
    ).resolves.toBe("stop");
    expect(context.logger.Warn).toHaveBeenCalled();
  });
});
