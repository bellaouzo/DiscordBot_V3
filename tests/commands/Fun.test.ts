import { describe, it, expect } from "vitest";
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
    });
  }
});
