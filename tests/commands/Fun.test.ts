import { describe, it, expect, vi } from "vitest";
import type { Guild, User } from "discord.js";
import {
  createMockInteraction,
  createMockContext,
  stubInteractionOptions,
} from "../helpers";
import { ApodCommand } from "@commands/Fun/ApodCommand";
import { EconomyCommand } from "@commands/Fun/EconomyCommand";
import { FactCommand } from "@commands/Fun/FactCommand";
import { InsultCommand } from "@commands/Fun/InsultCommand";
import { JokeCommand } from "@commands/Fun/JokeCommand";
import { LeaderboardCommand } from "@commands/Fun/LeaderboardCommand";
import { MemeCommand } from "@commands/Fun/MemeCommand";
import { NewsCommand } from "@commands/Fun/NewsCommand";
import { ProfileCommand } from "@commands/Fun/ProfileCommand";
import { QuoteCommand } from "@commands/Fun/QuoteCommand";
import { RankCommand } from "@commands/Fun/RankCommand";
import { TranslateCommand } from "@commands/Fun/TranslateCommand";
import { TriviaCommand } from "@commands/Fun/TriviaCommand";
import { WeatherCommand } from "@commands/Fun/WeatherCommand";

const funCommands = [
  { name: "ApodCommand", cmd: ApodCommand },
  { name: "EconomyCommand", cmd: EconomyCommand },
  { name: "FactCommand", cmd: FactCommand },
  { name: "InsultCommand", cmd: InsultCommand },
  { name: "JokeCommand", cmd: JokeCommand },
  { name: "LeaderboardCommand", cmd: LeaderboardCommand },
  { name: "MemeCommand", cmd: MemeCommand },
  { name: "NewsCommand", cmd: NewsCommand },
  { name: "ProfileCommand", cmd: ProfileCommand },
  { name: "QuoteCommand", cmd: QuoteCommand },
  { name: "RankCommand", cmd: RankCommand },
  { name: "TranslateCommand", cmd: TranslateCommand },
  { name: "TriviaCommand", cmd: TriviaCommand },
  { name: "WeatherCommand", cmd: WeatherCommand },
];

describe("Fun commands", () => {
  for (const { name, cmd } of funCommands) {
    describe(name, () => {
      it("has valid command definition", () => {
        expect(cmd.data).toBeDefined();
        expect(typeof cmd.data.name).toBe("string");
        expect(cmd.data.name.length).toBeGreaterThan(0);
        expect(typeof cmd.data.description).toBe("string");
        expect(cmd.data.description.length).toBeGreaterThan(0);
        expect(typeof cmd.group).toBe("string");
        expect(cmd.group).toBe("fun");
        expect(typeof cmd.execute).toBe("function");
      });

      it("execute does not throw", async () => {
        const interaction = createMockInteraction({
          guild: {
            members: { fetch: vi.fn().mockResolvedValue(null) },
          } as unknown as Guild,
          user: {
            id: "test-user",
            displayAvatarURL: () => "https://example.com/avatar.png",
            displayName: "TestUser",
          } as unknown as User,
        });
        const context = createMockContext();
        if (cmd === EconomyCommand) {
          stubInteractionOptions(interaction, {
            getSubcommand: () => "balance",
            getSubcommandGroup: () => null,
          });
        }
        if (cmd === NewsCommand || cmd === TranslateCommand) {
          stubInteractionOptions(interaction, {
            getString: () => "tech",
          });
        }
        await expect(cmd.execute(interaction, context)).resolves.not.toThrow();
      });
    });
  }
});
