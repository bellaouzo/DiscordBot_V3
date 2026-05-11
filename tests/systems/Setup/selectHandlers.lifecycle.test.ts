import { describe, expect, it, vi } from "vitest";
import type { StringSelectMenuInteraction } from "discord.js";
import { CreateSelectMenuRouter } from "@shared/SelectMenuRouter";
import { RegisterSelectHandlers } from "@systems/Setup/handlers/selectHandlers";
import type { NavigationIds, SetupDraft } from "@systems/Setup/state";
import {
  createMockInteraction,
  createMockLogger,
  createMockAppConfig,
} from "../../helpers";

describe("Setup select handlers lifecycle", () => {
  it("admin role select updates draft and calls updateMessage", async () => {
    const logger = createMockLogger();
    const selectMenuRouter = CreateSelectMenuRouter(logger);
    const updateMessage = vi.fn().mockResolvedValue(undefined);

    const interactionId = "111222333444555666";
    const interaction = createMockInteraction({
      id: interactionId,
      user: { id: "setup-owner", username: "Owner" } as never,
    });

    const draft: SetupDraft = {
      adminRoleIds: [],
      modRoleIds: [],
      ticketCategoryId: null,
      commandLogChannelId: null,
      announcementChannelId: null,
      deleteLogChannelId: null,
      productionLogChannelId: null,
      welcomeChannelId: null,
    };

    const ids: NavigationIds = {
      adminSelect: `setup:${interactionId}:admin`,
      modSelect: `setup:${interactionId}:mod`,
      ticketSelect: `setup:${interactionId}:ticket`,
      commandLogSelect: `setup:${interactionId}:cmdlog`,
      deleteLogSelect: `setup:${interactionId}:deletelog`,
      productionLogSelect: `setup:${interactionId}:prodlog`,
      announcementSelect: `setup:${interactionId}:announce`,
      welcomeSelect: `setup:${interactionId}:welcome`,
      next: `setup:${interactionId}:next`,
      back: `setup:${interactionId}:back`,
      save: `setup:${interactionId}:save`,
      saveAndQuit: `setup:${interactionId}:savequit`,
      cancel: `setup:${interactionId}:cancel`,
    };

    RegisterSelectHandlers({
      interaction,
      draft,
      resources: { roles: [], categories: [], textChannels: [] },
      ids,
      loggingDefaults: createMockAppConfig().logging,
      channelManager: {} as never,
      selectMenuRouter,
      updateMessage,
    });

    let selectDeferred = false;
    const selectInteraction = {
      customId: ids.adminSelect,
      values: ["role-a", "role-b"],
      user: { id: "setup-owner" },
      get deferred() {
        return selectDeferred;
      },
      replied: false,
      reply: vi.fn(),
      deferUpdate: vi.fn(async () => {
        selectDeferred = true;
      }),
    } as unknown as StringSelectMenuInteraction;

    const handled = await selectMenuRouter.HandleSelectMenu(selectInteraction);

    expect(handled).toBe(true);
    expect(draft.adminRoleIds).toEqual(["role-a", "role-b"]);
    expect(updateMessage).toHaveBeenCalledTimes(1);
  });
});
