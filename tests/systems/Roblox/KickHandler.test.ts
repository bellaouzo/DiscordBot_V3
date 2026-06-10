import { afterEach, describe, expect, it, vi } from "vitest";
import * as RobloxBridge from "@systems/Roblox/bridge";
import { ExecuteKickSubcommand } from "@systems/Roblox/handlers/KickHandler";
import {
  createMockContext,
  createMockInteraction,
  stubInteractionOptions,
} from "../../helpers";
import type { RobloxBridgeSettings } from "@systems/Roblox/types";

const settings: RobloxBridgeSettings = {
  url: "https://bridge.test",
  apiKey: "bridge-key",
  urlSigningSecret: "signing-secret",
  timeoutMs: 5000,
};

function createKickInteraction() {
  const interaction = createMockInteraction({
    guildId: "guild-1",
    guild: { id: "guild-1" } as never,
    user: {
      id: "mod-1",
      username: "Moderator",
      tag: "Moderator#0001",
      globalName: "Moderator",
    } as never,
  });
  stubInteractionOptions(interaction, {
    getString: (name: string) => {
      if (name === "player") return "TargetPlayer";
      if (name === "reason") return "Rule violation";
      return null;
    },
  });
  return interaction;
}

function installWithActionMock(context: ReturnType<typeof createMockContext>) {
  context.responders.interactionResponder.WithAction = vi
    .fn()
    .mockImplementation(
      async (opts: {
        action?: () => Promise<void>;
        followUp?: () => { embeds: unknown[] };
        interaction: unknown;
      }) => {
        if (opts.action) {
          await opts.action();
        }
        if (opts.followUp) {
          const followUp = opts.followUp();
          await context.responders.interactionResponder.Edit(
            opts.interaction as never,
            followUp,
          );
        }
      },
    );
}

describe("ExecuteKickSubcommand", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports player not found when presence has no server", async () => {
    vi.spyOn(RobloxBridge, "FindPlayerPresence").mockResolvedValue(null);

    const interaction = createKickInteraction();
    const context = createMockContext();
    installWithActionMock(context);

    await ExecuteKickSubcommand(interaction, context, settings);

    expect(context.responders.interactionResponder.Edit).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: "Player Not In Server" }),
        ]),
      }),
    );
  });

  it("reports kick success after polling completes", async () => {
    vi.spyOn(RobloxBridge, "FindPlayerPresence").mockResolvedValue({
      serverId: "server-1",
    });
    vi.spyOn(RobloxBridge, "PostKickCommand").mockResolvedValue("cmd-99");
    vi.spyOn(RobloxBridge, "PollKickResult").mockResolvedValue({
      kind: "success",
      code: "ACKNOWLEDGED",
      message: "Kick accepted",
      commandId: "cmd-99",
    });

    const interaction = createKickInteraction();
    const context = createMockContext();
    installWithActionMock(context);

    await ExecuteKickSubcommand(interaction, context, settings);

    expect(context.responders.interactionResponder.Edit).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: "Roblox Kick Succeeded" }),
        ]),
      }),
    );
  });

  it("reports poll failure outcomes", async () => {
    vi.spyOn(RobloxBridge, "FindPlayerPresence").mockResolvedValue({
      serverId: "server-1",
    });
    vi.spyOn(RobloxBridge, "PostKickCommand").mockResolvedValue("cmd-99");
    vi.spyOn(RobloxBridge, "PollKickResult").mockResolvedValue({
      kind: "failure",
      code: "KICK_FAILED",
      message: "Player could not be kicked",
      commandId: "cmd-99",
    });

    const interaction = createKickInteraction();
    const context = createMockContext();
    installWithActionMock(context);

    await ExecuteKickSubcommand(interaction, context, settings);

    expect(context.responders.interactionResponder.Edit).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: "Roblox Kick Failed" }),
        ]),
      }),
    );
  });
});
