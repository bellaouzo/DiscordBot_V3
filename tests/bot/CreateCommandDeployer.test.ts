import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockLogger } from "../helpers";

const {
  putMock,
  setTokenMock,
  applicationGuildCommandsMock,
  applicationCommandsMock,
} = vi.hoisted(() => {
  const put = vi.fn();
  return {
    putMock: put,
    setTokenMock: vi.fn().mockReturnValue({ put }),
    applicationGuildCommandsMock: vi
      .fn()
      .mockReturnValue("guild-commands-route"),
    applicationCommandsMock: vi.fn().mockReturnValue("global-commands-route"),
  };
});

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
      applicationCommands: applicationCommandsMock,
    },
  };
});

import { CreateCommandDeployer } from "@bot/CreateCommandDeployer";

describe("CreateCommandDeployer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    putMock.mockResolvedValue(undefined);
  });

  it("deploys slash commands globally by default scope", async () => {
    const logger = createMockLogger();
    const deploy = CreateCommandDeployer({
      deployment: {
        clientId: "123456789012345678",
        deployScope: "global",
      },
      token: "deploy-token",
      logger,
    });

    const commands = [{ name: "ping" }] as never;
    await deploy(commands);

    expect(setTokenMock).toHaveBeenCalledWith("deploy-token");
    expect(applicationCommandsMock).toHaveBeenCalledWith("123456789012345678");
    expect(applicationGuildCommandsMock).not.toHaveBeenCalled();
    expect(putMock).toHaveBeenCalledWith("global-commands-route", {
      body: commands,
    });
    expect(putMock).toHaveBeenCalledTimes(1);
    expect(logger.Info).toHaveBeenCalledWith(
      "Deploying slash commands",
      expect.objectContaining({
        extra: expect.objectContaining({ deployScope: "global" }),
      }),
    );
  });

  it("clears guild commands when deploying globally with a guild id", async () => {
    const logger = createMockLogger();
    const deploy = CreateCommandDeployer({
      deployment: {
        clientId: "123456789012345678",
        deployScope: "global",
        guildId: "987654321098765432",
      },
      token: "deploy-token",
      logger,
    });

    const commands = [{ name: "ping" }] as never;
    await deploy(commands);

    expect(putMock).toHaveBeenNthCalledWith(1, "global-commands-route", {
      body: commands,
    });
    expect(putMock).toHaveBeenNthCalledWith(2, "guild-commands-route", {
      body: [],
    });
    expect(applicationGuildCommandsMock).toHaveBeenCalledWith(
      "123456789012345678",
      "987654321098765432",
    );
  });

  it("deploys slash commands to the configured guild when scope is guild", async () => {
    const logger = createMockLogger();
    const deploy = CreateCommandDeployer({
      deployment: {
        clientId: "123456789012345678",
        deployScope: "guild",
        guildId: "987654321098765432",
      },
      token: "deploy-token",
      logger,
    });

    const commands = [{ name: "ping" }] as never;
    await deploy(commands);

    expect(applicationGuildCommandsMock).toHaveBeenCalledWith(
      "123456789012345678",
      "987654321098765432",
    );
    expect(applicationCommandsMock).toHaveBeenCalledWith("123456789012345678");
    expect(putMock).toHaveBeenNthCalledWith(1, "guild-commands-route", {
      body: commands,
    });
    expect(putMock).toHaveBeenNthCalledWith(2, "global-commands-route", {
      body: [],
    });
  });

  it("logs deployment failures without throwing", async () => {
    const logger = createMockLogger();
    putMock.mockRejectedValue(new Error("Discord API unavailable"));

    const deploy = CreateCommandDeployer({
      deployment: {
        clientId: "123456789012345678",
        deployScope: "global",
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
