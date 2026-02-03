import { describe, it, expect } from "vitest";
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

  describe("PingCommand execute", () => {
    it("replies and edits with latency", async () => {
      const interaction = createMockInteraction({
        createdTimestamp: Date.now() - 50,
      });
      const context = createMockContext();
      await PingCommand.execute(interaction, context);
      expect(context.responders.interactionResponder.Reply).toHaveBeenCalled();
      expect(context.responders.interactionResponder.Edit).toHaveBeenCalled();
    });
  });
});
