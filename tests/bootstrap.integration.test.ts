import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockLogger } from "./helpers";

const {
  botStartMock,
  mockClient,
  deployCommandsMock,
  registerEventsMock,
  registerInteractionHandlersMock,
  registerCommandHandlerMock,
  tempSchedulerStartMock,
  raidSchedulerStartMock,
  giveawaySchedulerStartMock,
  eventSchedulerStartMock,
  lotterySchedulerStartMock,
  loadCommandsMock,
  loadEventsMock,
} = vi.hoisted(() => {
  const startMock = vi.fn().mockResolvedValue(undefined);
  const client = {
    on: vi.fn(),
    once: vi.fn(),
    destroy: vi.fn(),
  };

  return {
    botStartMock: startMock,
    mockClient: client,
    deployCommandsMock: vi.fn().mockResolvedValue(undefined),
    registerEventsMock: vi.fn(),
    registerInteractionHandlersMock: vi.fn(),
    registerCommandHandlerMock: vi.fn(),
    tempSchedulerStartMock: vi.fn(),
    raidSchedulerStartMock: vi.fn(),
    giveawaySchedulerStartMock: vi.fn(),
    eventSchedulerStartMock: vi.fn(),
    lotterySchedulerStartMock: vi.fn(),
    loadCommandsMock: vi.fn().mockResolvedValue({
      definitions: [],
      slashData: [],
      errors: [],
    }),
    loadEventsMock: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("@bot/CreateBot", () => ({
  CreateBot: vi.fn(() => ({
    client: mockClient,
    Start: botStartMock,
  })),
}));

vi.mock("@bot/CreateCommandDeployer", () => ({
  CreateCommandDeployer: vi.fn(() => deployCommandsMock),
}));

vi.mock("@bot/CreateCommandLoader", () => ({
  CreateCommandLoader: vi.fn(() => loadCommandsMock),
}));

vi.mock("@bot/CreateEventLoader", () => ({
  CreateEventLoader: vi.fn(() => loadEventsMock),
}));

vi.mock("@bot/RegisterEvents", () => ({
  RegisterEvents: registerEventsMock,
}));

vi.mock("../src/interaction-handlers", () => ({
  RegisterInteractionHandlers: registerInteractionHandlersMock,
  RegisterCommandHandler: registerCommandHandlerMock,
}));

vi.mock("../src/Moderation/TempActionScheduler", () => ({
  TempActionScheduler: class {
    Start = tempSchedulerStartMock;
    Stop = vi.fn();
  },
}));

vi.mock("../src/Moderation/RaidModeScheduler", () => ({
  RaidModeScheduler: class {
    Start = raidSchedulerStartMock;
    Stop = vi.fn();
  },
}));

vi.mock("@systems/Giveaway/GiveawayScheduler", () => ({
  GiveawayScheduler: class {
    Start = giveawaySchedulerStartMock;
    Stop = vi.fn();
  },
}));

vi.mock("@systems/Event/EventScheduler", () => ({
  EventScheduler: class {
    Start = eventSchedulerStartMock;
    Stop = vi.fn();
  },
}));

vi.mock("@systems/Economy/LotteryScheduler", () => ({
  LotteryScheduler: class {
    Start = lotterySchedulerStartMock;
    Stop = vi.fn();
  },
}));

vi.mock("@database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@database")>();
  class MockDatabase {
    Close = vi.fn();
  }
  return {
    ...actual,
    UserDatabase: MockDatabase,
    ModerationDatabase: MockDatabase,
    ServerDatabase: MockDatabase,
    TicketDatabase: MockDatabase,
  };
});

import { Bootstrap } from "../src/Bootstrap";

describe("Bootstrap integration", () => {
  const previousEnv = {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    CLIENT_ID: process.env.CLIENT_ID,
    GUILD_ID: process.env.GUILD_ID,
    BOT_STRICT_FEATURE_KEYS: process.env.BOT_STRICT_FEATURE_KEYS,
    ROBLOX_BRIDGE_API_URL: process.env.ROBLOX_BRIDGE_API_URL,
    ROBLOX_BRIDGE_API_KEY: process.env.ROBLOX_BRIDGE_API_KEY,
    ROBLOX_BRIDGE_URL_SIGNING_SECRET:
      process.env.ROBLOX_BRIDGE_URL_SIGNING_SECRET,
    API_APOD_KEY: process.env.API_APOD_KEY,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DISCORD_TOKEN = "test-discord-token";
    process.env.CLIENT_ID = "123456789012345678";
    process.env.GUILD_ID = "987654321098765432";
    delete process.env.BOT_STRICT_FEATURE_KEYS;
    delete process.env.ROBLOX_BRIDGE_API_URL;
    delete process.env.ROBLOX_BRIDGE_API_KEY;
    delete process.env.ROBLOX_BRIDGE_URL_SIGNING_SECRET;
    delete process.env.API_APOD_KEY;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("wires registration, deployment, login, and schedulers", async () => {
    const logger = createMockLogger();

    const resources = await Bootstrap(logger);

    expect(registerEventsMock).toHaveBeenCalledOnce();
    expect(registerInteractionHandlersMock).toHaveBeenCalledOnce();
    expect(registerCommandHandlerMock).toHaveBeenCalledOnce();
    expect(deployCommandsMock).toHaveBeenCalledOnce();
    expect(botStartMock).toHaveBeenCalledWith("test-discord-token");
    expect(tempSchedulerStartMock).toHaveBeenCalledOnce();
    expect(raidSchedulerStartMock).toHaveBeenCalledOnce();
    expect(giveawaySchedulerStartMock).toHaveBeenCalledOnce();
    expect(eventSchedulerStartMock).toHaveBeenCalledOnce();
    expect(lotterySchedulerStartMock).toHaveBeenCalledOnce();
    expect(resources.client).toBe(mockClient);
  });

  it("throws before bot start when strict feature keys are violated", async () => {
    process.env.BOT_STRICT_FEATURE_KEYS = "1";
    process.env.ROBLOX_BRIDGE_API_URL = "https://bridge.example";
    process.env.ROBLOX_BRIDGE_API_KEY = "test-key";
    process.env.ROBLOX_BRIDGE_URL_SIGNING_SECRET = "   ";

    await expect(Bootstrap(createMockLogger())).rejects.toThrow(
      "Strict feature key validation failed",
    );

    expect(botStartMock).not.toHaveBeenCalled();
    expect(deployCommandsMock).not.toHaveBeenCalled();
  });

  it("logs missing API keys in non-strict mode", async () => {
    const logger = createMockLogger();

    await Bootstrap(logger);

    expect(logger.Warn).toHaveBeenCalledWith(
      "Required API keys are missing for optional features",
      expect.objectContaining({
        extra: expect.objectContaining({
          missing: expect.arrayContaining([
            expect.objectContaining({ envVar: "API_APOD_KEY" }),
          ]),
        }),
      }),
    );
  });
});
