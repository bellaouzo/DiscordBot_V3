import { vi } from "vitest";
import type {
  ChatInputCommandInteraction,
  Guild,
  User,
  GuildMember,
  CommandInteractionOptionResolver,
} from "discord.js";
import type { CommandContext } from "@commands/CommandFactory";
import type { ResponderSet } from "@responders";
import type { DatabaseSet } from "@database";
import type { Logger } from "@shared/Logger";
import type { AppConfig } from "@config/AppConfig";

export interface MockInteractionOverrides {
  createdTimestamp?: number;
  replied?: boolean;
  deferred?: boolean;
  options?: Partial<CommandInteractionOptionResolver>;
  guildId?: string | null;
  user?: Partial<User>;
  guild?: Partial<Guild> | null;
  member?: Partial<GuildMember> | null;
  client?: { uptime?: number };
}

export function createMockInteraction(
  overrides: MockInteractionOverrides = {}
): ChatInputCommandInteraction {
  const createdTimestamp = overrides.createdTimestamp ?? Date.now();
  let replied = overrides.replied ?? false;
  let deferred = overrides.deferred ?? false;

  const reply = vi.fn().mockImplementation(async () => {
    replied = true;
    return {} as Awaited<ReturnType<ChatInputCommandInteraction["reply"]>>;
  });
  const editReply = vi.fn().mockImplementation(async () => {
    return {} as Awaited<ReturnType<ChatInputCommandInteraction["editReply"]>>;
  });
  const followUp = vi.fn().mockImplementation(async () => {
    return {} as Awaited<ReturnType<ChatInputCommandInteraction["followUp"]>>;
  });
  const deferReply = vi.fn().mockImplementation(async () => {
    deferred = true;
    return {} as Awaited<ReturnType<ChatInputCommandInteraction["deferReply"]>>;
  });

  const options = overrides.options ?? {
    getString: vi.fn().mockReturnValue(null),
    getInteger: vi.fn().mockReturnValue(null),
    getNumber: vi.fn().mockReturnValue(null),
    getBoolean: vi.fn().mockReturnValue(null),
    getUser: vi.fn().mockReturnValue(null),
    getMember: vi.fn().mockReturnValue(null),
    getChannel: vi.fn().mockReturnValue(null),
    getRole: vi.fn().mockReturnValue(null),
    getMentionable: vi.fn().mockReturnValue(null),
    getAttachment: vi.fn().mockReturnValue(null),
    getSubcommand: vi.fn().mockReturnValue(null),
    getSubcommandGroup: vi.fn().mockReturnValue(null),
  };

  return {
    createdTimestamp,
    get replied() {
      return replied;
    },
    set replied(value: boolean) {
      replied = value;
    },
    get deferred() {
      return deferred;
    },
    reply,
    editReply,
    followUp,
    deferReply,
    options: options as CommandInteractionOptionResolver,
    guildId: "guildId" in overrides ? overrides.guildId : "test-guild-id",
    user: (overrides.user as User) ?? ({} as User),
    guild: (overrides.guild as Guild) ?? null,
    member: (overrides.member as GuildMember) ?? null,
    client: overrides.client ?? undefined,
  } as unknown as ChatInputCommandInteraction;
}

export function createMockLogger(): Logger {
  return {
    Info: vi.fn(),
    Warn: vi.fn(),
    Error: vi.fn(),
    Debug: vi.fn(),
    Child: vi.fn().mockImplementation(function (this: Logger) {
      return this;
    }),
  } as unknown as Logger;
}

export function createMockResponderSet(): ResponderSet {
  const interactionResponder = {
    Reply: vi.fn().mockResolvedValue({ success: true, message: "Reply sent" }),
    Edit: vi.fn().mockResolvedValue({ success: true, message: "Reply edited" }),
    FollowUp: vi
      .fn()
      .mockResolvedValue({ success: true, message: "Follow-up sent" }),
    Defer: vi.fn().mockResolvedValue({ success: true }),
    WithAction: vi
      .fn()
      .mockImplementation(async (opts: { action?: () => Promise<void> }) => {
        if (opts?.action) await opts.action();
      }),
  };
  const buttonResponder = {
    Register: vi.fn(),
    Handle: vi.fn().mockResolvedValue(undefined),
  };
  const paginatedResponder = {
    SendPaginated: vi.fn().mockResolvedValue(undefined),
  };
  const componentRouter = {
    Register: vi.fn(),
    RegisterButton: vi.fn(),
    Handle: vi.fn().mockResolvedValue(undefined),
  };
  const selectMenuRouter = {
    Register: vi.fn(),
    RegisterSelectMenu: vi.fn(),
    Handle: vi.fn().mockResolvedValue(undefined),
  };
  const userSelectMenuRouter = {
    Register: vi.fn(),
    Handle: vi.fn().mockResolvedValue(undefined),
  };

  return {
    interactionResponder:
      interactionResponder as unknown as ResponderSet["interactionResponder"],
    buttonResponder:
      buttonResponder as unknown as ResponderSet["buttonResponder"],
    paginatedResponder:
      paginatedResponder as unknown as ResponderSet["paginatedResponder"],
    componentRouter:
      componentRouter as unknown as ResponderSet["componentRouter"],
    selectMenuRouter:
      selectMenuRouter as unknown as ResponderSet["selectMenuRouter"],
    userSelectMenuRouter:
      userSelectMenuRouter as unknown as ResponderSet["userSelectMenuRouter"],
  };
}

function createStubbableDb<T>(
  defaultStubs: Record<string, ReturnType<typeof vi.fn>>
): T {
  return new Proxy(defaultStubs, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      const stub = vi.fn().mockReturnValue(undefined);
      (target as Record<string, unknown>)[prop] = stub;
      return stub;
    },
  }) as unknown as T;
}

export function createMockDatabaseSet(): DatabaseSet {
  const userDbStubs: Record<string, ReturnType<typeof vi.fn>> = {
    GetBalance: vi.fn().mockReturnValue({
      user_id: "u",
      guild_id: "g",
      balance: 100,
      updated_at: Date.now(),
    }),
    EnsureBalance: vi.fn().mockReturnValue({
      user_id: "u",
      guild_id: "g",
      balance: 100,
      updated_at: Date.now(),
    }),
    AdjustBalance: vi.fn().mockReturnValue({
      user_id: "u",
      guild_id: "g",
      balance: 100,
      updated_at: Date.now(),
    }),
    ClaimDaily: vi.fn().mockReturnValue({
      success: true,
      balance: {
        user_id: "u",
        guild_id: "g",
        balance: 100,
        updated_at: Date.now(),
      },
      nextAvailableAt: Date.now() + 86400000,
    }),
    GetUserXp: vi.fn().mockReturnValue({
      user_id: "u",
      guild_id: "g",
      xp: 0,
      level: 1,
      total_xp_earned: 0,
      updated_at: Date.now(),
    }),
    EnsureUserXp: vi.fn().mockReturnValue({
      user_id: "u",
      guild_id: "g",
      xp: 0,
      level: 1,
      total_xp_earned: 0,
      updated_at: Date.now(),
    }),
    AddXp: vi.fn().mockReturnValue({
      leveledUp: false,
      userXp: {
        user_id: "u",
        guild_id: "g",
        xp: 0,
        level: 1,
        total_xp_earned: 0,
        updated_at: Date.now(),
      },
      previousLevel: 1,
    }),
    GetXpForNextLevel: vi.fn().mockReturnValue(100),
    GetInventory: vi.fn().mockReturnValue([]),
    GetMarketRotation: vi.fn().mockReturnValue(null),
    GetTopBalances: vi.fn().mockReturnValue([]),
    GetXpLeaderboard: vi.fn().mockReturnValue([]),
    GetWarnings: vi.fn().mockReturnValue([]),
    GetNotes: vi.fn().mockReturnValue([]),
    AddNote: vi.fn().mockReturnValue(undefined),
    CreateGiveaway: vi.fn().mockReturnValue(undefined),
    GetActiveGiveaways: vi.fn().mockReturnValue([]),
    Close: vi.fn(),
  };
  const moderationDbStubs: Record<string, ReturnType<typeof vi.fn>> = {
    AddTempAction: vi.fn().mockReturnValue(undefined),
    GetPendingTempActions: vi.fn().mockReturnValue([]),
    ListPendingTempActions: vi.fn().mockReturnValue([]),
    ListModerationEvents: vi.fn().mockReturnValue([]),
    ListUserTempActions: vi.fn().mockReturnValue([]),
    GetActiveLockdown: vi.fn().mockReturnValue(null),
    GetActiveRaidMode: vi.fn().mockReturnValue(null),
    Close: vi.fn(),
  };
  const serverDbStubs: Record<string, ReturnType<typeof vi.fn>> = {
    GetGuildSettings: vi.fn().mockReturnValue(null),
    UpsertGuildSettings: vi.fn().mockReturnValue(undefined),
    ListUpcomingEvents: vi.fn().mockReturnValue([]),
    CreateEvent: vi.fn().mockReturnValue(undefined),
    Close: vi.fn(),
  };
  const ticketDbStubs: Record<string, ReturnType<typeof vi.fn>> = {
    GetUserTickets: vi.fn().mockReturnValue([]),
    CreateTicket: vi.fn().mockReturnValue(1),
    GetTicket: vi.fn().mockReturnValue(null),
    GetGuildTickets: vi.fn().mockReturnValue([]),
    CloseTicket: vi.fn().mockReturnValue(true),
    UpdateTicketStatus: vi.fn().mockReturnValue(true),
    Close: vi.fn(),
  };
  return {
    userDb: createStubbableDb<DatabaseSet["userDb"]>(userDbStubs),
    moderationDb:
      createStubbableDb<DatabaseSet["moderationDb"]>(moderationDbStubs),
    serverDb: createStubbableDb<DatabaseSet["serverDb"]>(serverDbStubs),
    ticketDb: createStubbableDb<DatabaseSet["ticketDb"]>(ticketDbStubs),
  };
}

export function createMockAppConfig(): AppConfig {
  return {
    discord: { token: "test-token" },
    deployment: { clientId: "test-client", guildId: "test-guild" },
    logging: {
      commandLogChannelName: "logs",
      commandLogCategoryName: "Logs",
      messageDeleteChannelName: "deleted",
      deployLogChannelName: "deploy",
    },
    apiKeys: { openWeatherMapApiKey: null },
  };
}

export function createMockContext(
  overrides: Partial<CommandContext> = {}
): CommandContext {
  return {
    responders: overrides.responders ?? createMockResponderSet(),
    logger: overrides.logger ?? createMockLogger(),
    databases: overrides.databases ?? createMockDatabaseSet(),
    appConfig: overrides.appConfig ?? createMockAppConfig(),
  };
}

export interface MockOptionOverrides {
  getSubcommand?: () => string | null;
  getSubcommandGroup?: () => string | null;
  getString?: (name: string) => string | null;
  getInteger?: (name: string) => number | null;
  getNumber?: (name: string) => number | null;
  getBoolean?: (name: string) => boolean | null;
  getUser?: (name: string) => unknown;
  getMember?: (name: string) => unknown;
  getChannel?: (name: string) => unknown;
  getRole?: (name: string) => unknown;
}

export function stubInteractionOptions(
  interaction: ChatInputCommandInteraction,
  overrides: MockOptionOverrides
): void {
  const opts = interaction.options as unknown as Record<
    string,
    ReturnType<typeof vi.fn>
  >;
  if (overrides.getSubcommand !== undefined)
    opts.getSubcommand.mockImplementation(overrides.getSubcommand);
  if (overrides.getSubcommandGroup !== undefined)
    opts.getSubcommandGroup.mockImplementation(overrides.getSubcommandGroup);
  if (overrides.getString !== undefined)
    opts.getString.mockImplementation(overrides.getString);
  if (overrides.getInteger !== undefined)
    opts.getInteger.mockImplementation(overrides.getInteger);
  if (overrides.getNumber !== undefined)
    opts.getNumber.mockImplementation(overrides.getNumber);
  if (overrides.getBoolean !== undefined)
    opts.getBoolean.mockImplementation(overrides.getBoolean);
  if (overrides.getUser !== undefined)
    opts.getUser.mockImplementation(overrides.getUser);
  if (overrides.getMember !== undefined)
    opts.getMember.mockImplementation(overrides.getMember);
  if (overrides.getChannel !== undefined)
    opts.getChannel.mockImplementation(overrides.getChannel);
  if (overrides.getRole !== undefined)
    opts.getRole.mockImplementation(overrides.getRole);
}
