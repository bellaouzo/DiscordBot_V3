import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CreateCommandLoader } from "@bot/CreateCommandLoader";
import { LoadAppConfig } from "@config/AppConfig";
import { createMockLogger } from "./helpers";

describe("Bootstrap smoke", () => {
  const previousEnv = {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    CLIENT_ID: process.env.CLIENT_ID,
    GUILD_ID: process.env.GUILD_ID,
  };

  beforeEach(() => {
    process.env.DISCORD_TOKEN = "test-discord-token";
    process.env.CLIENT_ID = "123456789012345678";
    process.env.GUILD_ID = "987654321098765432";
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

  it("loads app config when required env vars are present", () => {
    const config = LoadAppConfig();
    expect(config.discord.token).toBe("test-discord-token");
    expect(config.deployment.clientId).toBe("123456789012345678");
    expect(config.deployment.guildId).toBe("987654321098765432");
  });

  it("loads the full command registry without duplicates", async () => {
    const loadCommands = CreateCommandLoader(createMockLogger());
    const result = await loadCommands();

    expect(result.errors).toHaveLength(0);
    expect(result.definitions.length).toBeGreaterThanOrEqual(45);

    const names = result.definitions.map((command) => command.data.name);
    expect(new Set(names).size).toBe(names.length);
  }, 60_000);
});
