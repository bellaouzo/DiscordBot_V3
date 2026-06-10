import { describe, expect, it, vi } from "vitest";
import type { ButtonInteraction } from "discord.js";
import { CreateComponentRouter } from "@shared/ComponentRouter";
import { CreateResponders } from "@responders";
import { RegisterButtonHandlers } from "@systems/Setup/handlers/buttonHandlers";
import type {
  NavigationIds,
  SetupDraft,
  StepState,
} from "@systems/Setup/state";
import { createMockLogger, createMockDatabaseSet } from "../../helpers";

function createSetupIds(interactionId: string): NavigationIds {
  return {
    adminSelect: `setup:${interactionId}:admin`,
    modSelect: `setup:${interactionId}:mod`,
    ticketSelect: `setup:${interactionId}:ticket`,
    appealSelect: `setup:${interactionId}:appeal`,
    commandLogSelect: `setup:${interactionId}:cmdlog`,
    ticketLogSelect: `setup:${interactionId}:ticketlog`,
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
}

function createEmptyDraft(): SetupDraft {
  return {
    adminRoleIds: ["admin-role"],
    modRoleIds: ["mod-role"],
    ticketCategoryId: "cat-1",
    appealReviewCategoryId: null,
    commandLogChannelId: null,
    ticketLogChannelId: null,
    announcementChannelId: null,
    deleteLogChannelId: null,
    productionLogChannelId: null,
    welcomeChannelId: null,
  };
}

function registerSetupButtons(stepState: StepState, draft: SetupDraft) {
  const logger = createMockLogger();
  const componentRouter = CreateComponentRouter(logger);
  const { buttonResponder } = CreateResponders({ logger });
  const databases = createMockDatabaseSet();
  const updateMessage = vi.fn().mockResolvedValue(undefined);
  const interactionId = "111222333444555666";
  const ids = createSetupIds(interactionId);

  (
    databases.serverDb.UpsertGuildSettings as ReturnType<typeof vi.fn>
  ).mockReturnValue({
    guild_id: "guild-1",
    admin_role_ids: draft.adminRoleIds,
    mod_role_ids: draft.modRoleIds,
    ticket_category_id: draft.ticketCategoryId,
    appeal_review_category_id: draft.appealReviewCategoryId,
    command_log_channel_id: draft.commandLogChannelId,
    ticket_log_channel_id: draft.ticketLogChannelId,
    announcement_channel_id: draft.announcementChannelId,
    delete_log_channel_id: draft.deleteLogChannelId,
    production_log_channel_id: draft.productionLogChannelId,
    welcome_channel_id: draft.welcomeChannelId,
  });

  RegisterButtonHandlers({
    ids,
    draft,
    stepState,
    componentRouter,
    buttonResponder,
    serverDb: databases.serverDb,
    guildId: "guild-1",
    ownerId: "setup-owner",
    updateMessage,
  });

  return {
    componentRouter,
    buttonResponder,
    updateMessage,
    ids,
    databases,
  };
}

function createButtonInteraction(
  customId: string,
  editReply = vi.fn().mockResolvedValue(undefined),
) {
  let deferred = false;
  return {
    customId,
    user: { id: "setup-owner" },
    get deferred() {
      return deferred;
    },
    replied: false,
    reply: vi.fn(),
    deferUpdate: vi.fn(async () => {
      deferred = true;
    }),
    editReply,
  } as unknown as ButtonInteraction;
}

describe("Setup button handlers lifecycle", () => {
  it("next advances step and calls updateMessage", async () => {
    const stepState: StepState = { current: 1 };
    const draft = createEmptyDraft();
    const { componentRouter, updateMessage, ids } = registerSetupButtons(
      stepState,
      draft,
    );

    const handled = await componentRouter.HandleButton(
      createButtonInteraction(ids.next),
    );

    expect(handled).toBe(true);
    expect(stepState.current).toBe(2);
    expect(updateMessage).toHaveBeenCalledTimes(1);
  });

  it("back decrements step and calls updateMessage", async () => {
    const stepState: StepState = { current: 2 };
    const draft = createEmptyDraft();
    const { componentRouter, updateMessage, ids } = registerSetupButtons(
      stepState,
      draft,
    );

    const handled = await componentRouter.HandleButton(
      createButtonInteraction(ids.back),
    );

    expect(handled).toBe(true);
    expect(stepState.current).toBe(1);
    expect(updateMessage).toHaveBeenCalledTimes(1);
  });

  it("cancel shows cancelled embed and clears components", async () => {
    const stepState: StepState = { current: 2 };
    const draft = createEmptyDraft();
    const { componentRouter, buttonResponder, ids } = registerSetupButtons(
      stepState,
      draft,
    );
    const editSpy = vi.spyOn(buttonResponder, "EditReply");

    const handled = await componentRouter.HandleButton(
      createButtonInteraction(ids.cancel),
    );

    expect(handled).toBe(true);
    expect(editSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        components: [],
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: "Setup Cancelled" }),
        ]),
      }),
    );
  });

  it("save persists guild settings via serverDb", async () => {
    const stepState: StepState = { current: 3 };
    const draft = createEmptyDraft();
    const { componentRouter, databases, ids } = registerSetupButtons(
      stepState,
      draft,
    );

    const handled = await componentRouter.HandleButton(
      createButtonInteraction(ids.save),
    );

    expect(handled).toBe(true);
    expect(databases.serverDb.UpsertGuildSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        guild_id: "guild-1",
        admin_role_ids: ["admin-role"],
        mod_role_ids: ["mod-role"],
        ticket_category_id: "cat-1",
      }),
    );
  });
});
