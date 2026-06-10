import { describe, expect, it, vi, beforeEach } from "vitest";

const loginMock = vi.fn().mockResolvedValue(undefined);
const clientConstructor = vi.fn();

vi.mock("discord.js", () => ({
  Client: class MockClient {
    login = loginMock;
    constructor(public readonly options: { intents: number[] }) {
      clientConstructor(options);
    }
  },
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    MessageContent: 4,
    GuildMembers: 8,
    GuildPresences: 16,
  },
}));

import { CreateBot } from "@bot/CreateBot";
import { GatewayIntentBits } from "discord.js";
import { createMockLogger } from "../helpers";

describe("CreateBot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a client with default intents", () => {
    const bot = CreateBot({ logger: createMockLogger() });

    expect(bot.client).toBeDefined();
    expect(clientConstructor).toHaveBeenCalledWith({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
      ],
    });
  });

  it("allows custom intents", () => {
    CreateBot({
      logger: createMockLogger(),
      intents: [GatewayIntentBits.Guilds],
    });

    expect(clientConstructor).toHaveBeenCalledWith({
      intents: [GatewayIntentBits.Guilds],
    });
  });

  it("logs in with the provided token", async () => {
    const bot = CreateBot({ logger: createMockLogger() });

    await bot.Start("test-token");

    expect(loginMock).toHaveBeenCalledWith("test-token");
  });
});
