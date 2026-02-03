import { describe, it, expect, vi } from "vitest";
import type { Guild, User } from "discord.js";
import {
  createMockInteraction,
  createMockContext,
  stubInteractionOptions,
} from "../helpers";
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

      it("execute does not throw", async () => {
        const mockUser = { id: "mod-user", username: "ModUser" };
        const kickableMember = {
          kick: vi.fn().mockResolvedValue(undefined),
          kickable: true,
        };
        const interaction = createMockInteraction({
          guild: {
            members: {
              cache: { get: vi.fn().mockReturnValue(undefined) },
              fetch: vi.fn().mockResolvedValue(kickableMember),
              unban: vi.fn().mockResolvedValue(undefined),
            },
            bans: {
              fetch: vi.fn().mockResolvedValue({
                values: () => [],
                user: { tag: "BannedUser#1234" },
              }),
            },
            channels: { cache: { get: vi.fn().mockReturnValue(null) } },
          } as unknown as Guild,
          user: mockUser as unknown as User,
        });
        if (cmd === KickCommand) {
          stubInteractionOptions(interaction, {
            getUser: () => ({ id: "target-id", username: "KickTarget" }),
          });
        }
        if (cmd === UnbanCommand) {
          stubInteractionOptions(interaction, {
            getString: () => "user-id-123",
          });
        }
        const context = createMockContext();
        await expect(cmd.execute(interaction, context)).resolves.not.toThrow();
      });
    });
  }
});
