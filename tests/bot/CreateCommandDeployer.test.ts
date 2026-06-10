import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockLogger } from "../helpers";

const { putMock, setTokenMock, applicationGuildCommandsMock } = vi.hoisted(
  () => {
    const put = vi.fn();
    return {
      putMock: put,
      setTokenMock: vi.fn().mockReturnValue({ put }),
      applicationGuildCommandsMock: vi
        .fn()
        .mockReturnValue("guild-commands-route"),
    };
  },
);

vi.mock("discord.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("discord.js")>();
  class MockREST {
    setToken = setTokenMock;
  }
  return {
    ...actual,
    REST: MockREST,
    Routes: {
      ...actual.Routes,
      applicationGuildCommands: applicationGuildCommandsMock,
    },
  };
});

import { CreateCommandDeployer } from "@bot/CreateCommandDeployer";

describe("CreateCommandDeployer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    putMock.mockResolvedValue(undefined);
  });

  it("deploys slash commands to the configured guild", async () => {
    const logger = createMockLogger();
    const deploy = CreateCommandDeployer({
      deployment: {
        clientId: "123456789012345678",
        guildId: "987654321098765432",
      },
      token: "deploy-token",
      logger,
    });

    const commands = [{ name: "ping" }] as never;
    await deploy(commands);

    expect(setTokenMock).toHaveBeenCalledWith("deploy-token");
    expect(applicationGuildCommandsMock).toHaveBeenCalledWith(
      "123456789012345678",
      "987654321098765432",
    );
    expect(putMock).toHaveBeenCalledWith("guild-commands-route", {
      body: commands,
    });
  });

  it("logs deployment failures without throwing", async () => {
    const logger = createMockLogger();
    putMock.mockRejectedValue(new Error("Discord API unavailable"));

    const deploy = CreateCommandDeployer({
      deployment: {
        clientId: "123456789012345678",
        guildId: "987654321098765432",
      },
      token: "deploy-token",
      logger,
    });

    await expect(deploy([])).resolves.toBeUndefined();

    expect(logger.Error).toHaveBeenCalledWith(
      "Failed to deploy commands",
      expect.objectContaining({
        error: expect.any(Error),
      }),
    );
  });
});
