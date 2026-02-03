import { describe, it, expect } from "vitest";
import { BanCommand } from "@commands/Moderation/BanCommand";
import { BanListCommand } from "@commands/Moderation/BanListCommand";
import { CasefileCommand } from "@commands/Moderation/CasefileCommand";
import { EconomyAdminCommand } from "@commands/Moderation/EconomyAdminCommand";
import { KickCommand } from "@commands/Moderation/KickCommand";
import { LinkFilterCommand } from "@commands/Moderation/LinkFilterCommand";
import { LockdownCommand } from "@commands/Moderation/LockdownCommand";
import { MuteCommand } from "@commands/Moderation/MuteCommand";
import { NoteCommand } from "@commands/Moderation/NoteCommand";
import { PurgeCommand } from "@commands/Moderation/PurgeCommand";
import { RaidModeCommand } from "@commands/Moderation/RaidModeCommand";
import { SlowmodeCommand } from "@commands/Moderation/SlowmodeCommand";
import { TempActionsCommand } from "@commands/Moderation/TempActionsCommand";
import { UnbanCommand } from "@commands/Moderation/UnbanCommand";
import { WarnCommand } from "@commands/Moderation/WarnCommand";

const moderationCommands = [
  { name: "BanCommand", cmd: BanCommand },
  { name: "BanListCommand", cmd: BanListCommand },
  { name: "CasefileCommand", cmd: CasefileCommand },
  { name: "EconomyAdminCommand", cmd: EconomyAdminCommand },
  { name: "KickCommand", cmd: KickCommand },
  { name: "LinkFilterCommand", cmd: LinkFilterCommand },
  { name: "LockdownCommand", cmd: LockdownCommand },
  { name: "MuteCommand", cmd: MuteCommand },
  { name: "NoteCommand", cmd: NoteCommand },
  { name: "PurgeCommand", cmd: PurgeCommand },
  { name: "RaidModeCommand", cmd: RaidModeCommand },
  { name: "SlowmodeCommand", cmd: SlowmodeCommand },
  { name: "TempActionsCommand", cmd: TempActionsCommand },
  { name: "UnbanCommand", cmd: UnbanCommand },
  { name: "WarnCommand", cmd: WarnCommand },
];

describe("Moderation commands", () => {
  for (const { name, cmd } of moderationCommands) {
    describe(name, () => {
      it("has valid command definition", () => {
        expect(cmd.data).toBeDefined();
        expect(typeof cmd.data.name).toBe("string");
        expect(cmd.data.name.length).toBeGreaterThan(0);
        expect(typeof cmd.data.description).toBe("string");
        expect(cmd.data.description.length).toBeGreaterThan(0);
        expect(typeof cmd.group).toBe("string");
        expect(cmd.group).toBe("moderation");
        expect(typeof cmd.execute).toBe("function");
      });
    });
  }
});
