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
    set deferred(value: boolean) {
      deferred = value;
    },
    reply,
    editReply,
    followUp,
    deferReply,
    options: options as CommandInteractionOptionResolver,
    guildId: overrides.guildId ?? "test-guild-id",
    user: (overrides.user as User) ?? ({} as User),
    guild: (overrides.guild as Guild) ?? null,
    member: (overrides.member as GuildMember) ?? null,
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
    Handle: vi.fn().mockResolvedValue(undefined),
  };
  const selectMenuRouter = {
    Register: vi.fn(),
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

export function createMockDatabaseSet(): DatabaseSet {
  return {
    userDb: {} as DatabaseSet["userDb"],
    moderationDb: {} as DatabaseSet["moderationDb"],
    serverDb: {} as DatabaseSet["serverDb"],
    ticketDb: {} as DatabaseSet["ticketDb"],
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
