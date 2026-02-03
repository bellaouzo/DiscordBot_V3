import { describe, it, expect, vi } from "vitest";
import type { Guild, User } from "discord.js";
import { createMockInteraction, createMockContext } from "../helpers";
import { AnnouncementCommand } from "@commands/Utility/AnnouncementCommand";
import { CommandLogsCommand } from "@commands/Utility/CommandLogsCommand";
import { DebugCommand } from "@commands/Utility/DebugCommand";
import { EventCommand } from "@commands/Utility/EventCommand";
import { GiveawayCommand } from "@commands/Utility/GiveawayCommand";
import { HelpCommand } from "@commands/Utility/HelpCommand";
import { PingCommand } from "@commands/Utility/PingCommand";
import { PollCommand } from "@commands/Utility/PollCommand";
import { PresenceCommand } from "@commands/Utility/PresenceCommand";
import { SetupCommand } from "@commands/Utility/SetupCommand";
import { TicketCommand } from "@commands/Utility/TicketCommand";

const utilityCommands = [
  { name: "AnnouncementCommand", cmd: AnnouncementCommand },
  { name: "CommandLogsCommand", cmd: CommandLogsCommand },
  { name: "DebugCommand", cmd: DebugCommand },
  { name: "EventCommand", cmd: EventCommand },
  { name: "GiveawayCommand", cmd: GiveawayCommand },
  { name: "HelpCommand", cmd: HelpCommand },
  { name: "PingCommand", cmd: PingCommand },
  { name: "PollCommand", cmd: PollCommand },
  { name: "PresenceCommand", cmd: PresenceCommand },
  { name: "SetupCommand", cmd: SetupCommand },
  { name: "TicketCommand", cmd: TicketCommand },
];

describe("Utility commands", () => {
  for (const { name, cmd } of utilityCommands) {
    describe(name, () => {
      it("has valid command definition", () => {
        expect(cmd.data).toBeDefined();
        expect(typeof cmd.data.name).toBe("string");
        expect(cmd.data.name.length).toBeGreaterThan(0);
        expect(typeof cmd.data.description).toBe("string");
        expect(cmd.data.description.length).toBeGreaterThan(0);
        expect(typeof cmd.group).toBe("string");
        expect(["utility", "admin"]).toContain(cmd.group);
        expect(typeof cmd.execute).toBe("function");
      });
    });
  }

  for (const { name, cmd } of utilityCommands) {
    describe(`${name} execute`, () => {
      it("does not throw", async () => {
        const emptyArrayLike = {
          size: 0,
          first: () => null,
          filter: () => emptyArrayLike,
          sort: () => emptyArrayLike,
          map: () => [],
        };
        const channelsCache = {
          get: vi.fn().mockReturnValue(null),
          filter: vi.fn().mockReturnValue(emptyArrayLike),
        };
        const emptyCollection = {
          filter: () => [],
          sort: () => [],
          map: () => [],
        };
        const interaction = createMockInteraction({
          guild: {
            members: { fetch: vi.fn().mockResolvedValue(null) },
            channels: { cache: channelsCache },
            roles: { cache: emptyCollection },
          } as unknown as Guild,
          user: { id: "util-user" } as unknown as User,
          ...([DebugCommand, PresenceCommand, SetupCommand].includes(cmd)
            ? { client: { uptime: 0 } }
            : {}),
        });
        const context = createMockContext();
        if (cmd === PingCommand) {
          (interaction as { createdTimestamp: number }).createdTimestamp =
            Date.now() - 50;
        }
        await expect(cmd.execute(interaction, context)).resolves.not.toThrow();
      });
    });
  }
});
