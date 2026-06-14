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
import { SETUP_STEP_COUNT } from "@systems/Setup/constants";

function createSetupIds(interactionId: string): NavigationIds {
  const prefix = `setup:${interactionId}`;
  return {
    adminSelect: `${prefix}:admin`,
    modSelect: `${prefix}:mod`,
    ticketSelect: `${prefix}:ticket`,
    appealSelect: `${prefix}:appeal`,
    commandLogSelect: `${prefix}:cmdlog`,
    ticketLogSelect: `${prefix}:ticketlog`,
    deleteLogSelect: `${prefix}:deletelog`,
    productionLogSelect: `${prefix}:prodlog`,
    announcementSelect: `${prefix}:announce`,
    welcomeSelect: `${prefix}:welcome`,
    starboardChannelSelect: `${prefix}:starboard`,
    levelUpChannelSelect: `${prefix}:levelup`,
    verificationChannelSelect: `${prefix}:verifychannel`,
    unverifiedRoleSelect: `${prefix}:unverifiedrole`,
    verifiedRoleSelect: `${prefix}:verifiedrole`,
    featureToggleIds: {
      economy: `${prefix}:feat:economy`,
      leveling: `${prefix}:feat:leveling`,
      starboard: `${prefix}:feat:starboard`,
      verification: `${prefix}:feat:verification`,
      giveaways: `${prefix}:feat:giveaways`,
    },
    next: `${prefix}:next`,
    back: `${prefix}:back`,
    saveAndQuit: `${prefix}:savequit`,
    cancel: `${prefix}:cancel`,
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
    economyEnabled: true,
    levelingEnabled: false,
    starboardEnabled: false,
    verificationEnabled: false,
    giveawaysEnabled: true,
    starboardChannelId: null,
    levelUpChannelId: null,
    verificationChannelId: null,
    unverifiedRoleId: null,
    verifiedRoleId: null,
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
    economy_enabled: draft.economyEnabled,
    giveaways_enabled: draft.giveawaysEnabled,
    verification_enabled: draft.verificationEnabled,
    starboard_channel_id: draft.starboardChannelId,
    verification_channel_id: draft.verificationChannelId,
    unverified_role_id: draft.unverifiedRoleId,
    verified_role_id: draft.verifiedRoleId,
    autorole_id: null,
    starboard_emoji: "⭐",
    starboard_threshold: 3,
    roblox_linked_discord_user_id: null,
    roblox_linked_at: null,
    verification_min_account_age_days: 0,
    created_at: Date.now(),
    updated_at: Date.now(),
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

  it("next stops at the final setup step", async () => {
    const stepState: StepState = { current: SETUP_STEP_COUNT };
    const draft = createEmptyDraft();
    const { componentRouter, ids } = registerSetupButtons(stepState, draft);

    await componentRouter.HandleButton(createButtonInteraction(ids.next));

    expect(stepState.current).toBe(SETUP_STEP_COUNT);
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

  it("save and finish persists settings and shows completion embed", async () => {
    const stepState: StepState = { current: SETUP_STEP_COUNT };
    const draft = createEmptyDraft();
    const { componentRouter, buttonResponder, ids, databases } =
      registerSetupButtons(stepState, draft);
    const editSpy = vi.spyOn(buttonResponder, "EditReply");

    const handled = await componentRouter.HandleButton(
      createButtonInteraction(ids.saveAndQuit),
    );

    expect(handled).toBe(true);
    expect(databases.serverDb.UpsertGuildSettings).toHaveBeenCalled();
    expect(databases.serverDb.UpsertGuildXpSettings).toHaveBeenCalled();
    expect(editSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: "Setup Complete" }),
        ]),
      }),
    );
  });
});
