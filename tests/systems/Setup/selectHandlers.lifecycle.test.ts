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

function createEmptyDraft(): SetupDraft {
  return {
    adminRoleIds: [],
    modRoleIds: [],
    ticketCategoryId: null,
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

async function runSelectHandler(options: {
  customId: keyof NavigationIds;
  values: string[];
  channelManager?: {
    GetOrCreateCategory: ReturnType<typeof vi.fn>;
    GetOrCreateTextChannel: ReturnType<typeof vi.fn>;
  };
}) {
  const logger = createMockLogger();
  const selectMenuRouter = CreateSelectMenuRouter(logger);
  const updateMessage = vi.fn().mockResolvedValue(undefined);
  const interactionId = "setup-select-test-id";
  const interaction = createMockInteraction({
    id: interactionId,
    user: { id: "setup-owner", username: "Owner" } as never,
  });
  const draft = createEmptyDraft();
  const ids = createSetupIds(interactionId);
  const channelManager = options.channelManager ?? {
    GetOrCreateCategory: vi.fn().mockResolvedValue(null),
    GetOrCreateTextChannel: vi.fn().mockResolvedValue(null),
  };

  RegisterSelectHandlers({
    interaction,
    draft,
    resources: { roles: [], categories: [], textChannels: [] },
    ids,
    loggingDefaults: createMockAppConfig().logging,
    channelManager: channelManager as never,
    selectMenuRouter,
    updateMessage,
  });

  let selectDeferred = false;
  const selectInteraction = {
    customId: ids[options.customId],
    values: options.values,
    user: { id: "setup-owner" },
    get deferred() {
      return selectDeferred;
    },
    replied: false,
    reply: vi.fn(),
    followUp: vi.fn().mockResolvedValue(undefined),
    deferUpdate: vi.fn(async () => {
      selectDeferred = true;
    }),
  } as unknown as StringSelectMenuInteraction;

  const handled = await selectMenuRouter.HandleSelectMenu(selectInteraction);

  return { handled, draft, updateMessage, selectInteraction, channelManager };
}

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
      appealReviewCategoryId: null,
      commandLogChannelId: null,
      ticketLogChannelId: null,
      announcementChannelId: null,
      deleteLogChannelId: null,
      productionLogChannelId: null,
      welcomeChannelId: null,
    };

    const ids: NavigationIds = {
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

  it("mod role select updates draft and calls updateMessage", async () => {
    const logger = createMockLogger();
    const selectMenuRouter = CreateSelectMenuRouter(logger);
    const updateMessage = vi.fn().mockResolvedValue(undefined);
    const interactionId = "222333444555666777";
    const interaction = createMockInteraction({
      id: interactionId,
      user: { id: "setup-owner", username: "Owner" } as never,
    });

    const draft: SetupDraft = {
      adminRoleIds: [],
      modRoleIds: [],
      ticketCategoryId: null,
      appealReviewCategoryId: null,
      commandLogChannelId: null,
      ticketLogChannelId: null,
      announcementChannelId: null,
      deleteLogChannelId: null,
      productionLogChannelId: null,
      welcomeChannelId: null,
    };

    const ids: NavigationIds = {
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
      customId: ids.modSelect,
      values: ["mod-a"],
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
    expect(draft.modRoleIds).toEqual(["mod-a"]);
    expect(updateMessage).toHaveBeenCalledTimes(1);
  });

  it("ticket select auto clears ticket category", async () => {
    const { handled, draft, updateMessage } = await runSelectHandler({
      customId: "ticketSelect",
      values: ["auto"],
    });

    expect(handled).toBe(true);
    expect(draft.ticketCategoryId).toBeNull();
    expect(updateMessage).toHaveBeenCalledTimes(1);
  });

  it("ticket select create stores created category id", async () => {
    const getOrCreateCategory = vi
      .fn()
      .mockResolvedValue({ id: "cat-new", name: "Tickets" });
    const { handled, draft } = await runSelectHandler({
      customId: "ticketSelect",
      values: ["create"],
      channelManager: {
        GetOrCreateCategory: getOrCreateCategory,
        GetOrCreateTextChannel: vi.fn(),
      },
    });

    expect(handled).toBe(true);
    expect(getOrCreateCategory).toHaveBeenCalled();
    expect(draft.ticketCategoryId).toBe("cat-new");
  });

  it("appeal select stores explicit category id", async () => {
    const { handled, draft } = await runSelectHandler({
      customId: "appealSelect",
      values: ["appeal-cat-1"],
    });

    expect(handled).toBe(true);
    expect(draft.appealReviewCategoryId).toBe("appeal-cat-1");
  });

  it("command log select create stores created channel id", async () => {
    const getOrCreateTextChannel = vi
      .fn()
      .mockResolvedValue({ id: "log-ch-1", name: "command-logs" });
    const { handled, draft } = await runSelectHandler({
      customId: "commandLogSelect",
      values: ["create"],
      channelManager: {
        GetOrCreateCategory: vi.fn(),
        GetOrCreateTextChannel: getOrCreateTextChannel,
      },
    });

    expect(handled).toBe(true);
    expect(draft.commandLogChannelId).toBe("log-ch-1");
  });

  it("welcome select auto clears welcome channel", async () => {
    const { handled, draft } = await runSelectHandler({
      customId: "welcomeSelect",
      values: ["auto"],
    });

    expect(handled).toBe(true);
    expect(draft.welcomeChannelId).toBeNull();
  });

  it("ticket select create failure follows up with permission warning", async () => {
    const { handled, selectInteraction } = await runSelectHandler({
      customId: "ticketSelect",
      values: ["create"],
      channelManager: {
        GetOrCreateCategory: vi.fn().mockResolvedValue(null),
        GetOrCreateTextChannel: vi.fn(),
      },
    });

    expect(handled).toBe(true);
    expect(selectInteraction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("ticket category"),
      }),
    );
  });

  it("delete log select none clears channel id", async () => {
    const { handled, draft } = await runSelectHandler({
      customId: "deleteLogSelect",
      values: ["none"],
    });

    expect(handled).toBe(true);
    expect(draft.deleteLogChannelId).toBeNull();
  });

  it("production log select stores explicit channel id", async () => {
    const { handled, draft } = await runSelectHandler({
      customId: "productionLogSelect",
      values: ["prod-log-1"],
    });

    expect(handled).toBe(true);
    expect(draft.productionLogChannelId).toBe("prod-log-1");
  });

  it("announcement select create stores created channel id", async () => {
    const created = { id: "announce-1", name: "announcements" };
    const { handled, draft } = await runSelectHandler({
      customId: "announcementSelect",
      values: ["create"],
      channelManager: {
        GetOrCreateCategory: vi.fn(),
        GetOrCreateTextChannel: vi.fn().mockResolvedValue(created),
      },
    });

    expect(handled).toBe(true);
    expect(draft.announcementChannelId).toBe("announce-1");
  });

  it("ticket log select create failure follows up with permission warning", async () => {
    const { handled, selectInteraction } = await runSelectHandler({
      customId: "ticketLogSelect",
      values: ["create"],
      channelManager: {
        GetOrCreateCategory: vi.fn(),
        GetOrCreateTextChannel: vi.fn().mockResolvedValue(null),
      },
    });

    expect(handled).toBe(true);
    expect(selectInteraction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("ticket logs channel"),
      }),
    );
  });

  it("appeal select create adds new category to resources", async () => {
    const created = { id: "appeal-cat-new", name: "Appeals" };
    const logger = createMockLogger();
    const selectMenuRouter = CreateSelectMenuRouter(logger);
    const updateMessage = vi.fn().mockResolvedValue(undefined);
    const interactionId = "appeal-create-test";
    const interaction = createMockInteraction({
      id: interactionId,
      user: { id: "setup-owner", username: "Owner" } as never,
    });
    const draft = createEmptyDraft();
    const ids = createSetupIds(interactionId);
    const resources = { roles: [], categories: [], textChannels: [] };
    const channelManager = {
      GetOrCreateCategory: vi.fn().mockResolvedValue(created),
      GetOrCreateTextChannel: vi.fn(),
    };

    RegisterSelectHandlers({
      interaction,
      draft,
      resources,
      ids,
      loggingDefaults: createMockAppConfig().logging,
      channelManager: channelManager as never,
      selectMenuRouter,
      updateMessage,
    });

    let selectDeferred = false;
    const selectInteraction = {
      customId: ids.appealSelect,
      values: ["create"],
      user: { id: "setup-owner" },
      get deferred() {
        return selectDeferred;
      },
      replied: false,
      reply: vi.fn(),
      followUp: vi.fn(),
      deferUpdate: vi.fn(async () => {
        selectDeferred = true;
      }),
    } as unknown as StringSelectMenuInteraction;

    const handled = await selectMenuRouter.HandleSelectMenu(selectInteraction);

    expect(handled).toBe(true);
    expect(draft.appealReviewCategoryId).toBe("appeal-cat-new");
    expect(resources.categories[0]).toEqual(created);
  });

  it("create promotes an existing channel to the front of resources", async () => {
    const existing = { id: "welcome-1", name: "welcome" };
    const other = { id: "other-1", name: "general" };
    const logger = createMockLogger();
    const selectMenuRouter = CreateSelectMenuRouter(logger);
    const updateMessage = vi.fn().mockResolvedValue(undefined);
    const interactionId = "welcome-promote-test";
    const interaction = createMockInteraction({
      id: interactionId,
      user: { id: "setup-owner", username: "Owner" } as never,
    });
    const draft = createEmptyDraft();
    const ids = createSetupIds(interactionId);
    const resources = {
      roles: [],
      categories: [],
      textChannels: [other as never, existing as never],
    };
    const channelManager = {
      GetOrCreateCategory: vi.fn(),
      GetOrCreateTextChannel: vi.fn().mockResolvedValue(existing),
    };

    RegisterSelectHandlers({
      interaction,
      draft,
      resources,
      ids,
      loggingDefaults: createMockAppConfig().logging,
      channelManager: channelManager as never,
      selectMenuRouter,
      updateMessage,
    });

    let selectDeferred = false;
    const selectInteraction = {
      customId: ids.welcomeSelect,
      values: ["create"],
      user: { id: "setup-owner" },
      get deferred() {
        return selectDeferred;
      },
      replied: false,
      reply: vi.fn(),
      followUp: vi.fn(),
      deferUpdate: vi.fn(async () => {
        selectDeferred = true;
      }),
    } as unknown as StringSelectMenuInteraction;

    const handled = await selectMenuRouter.HandleSelectMenu(selectInteraction);

    expect(handled).toBe(true);
    expect(draft.welcomeChannelId).toBe("welcome-1");
    expect(resources.textChannels[0]).toEqual(existing);
    expect(resources.textChannels).toHaveLength(2);
  });
});
