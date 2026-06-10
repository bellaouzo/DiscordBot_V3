import { describe, expect, it, vi, beforeEach } from "vitest";
import { DiscordAPIError, Events, MessageFlags } from "discord.js";
import {
  RegisterCommandHandler,
  RegisterInteractionHandlers,
} from "../../src/interaction-handlers";
import { createMockLogger, createMockResponderSet } from "../helpers";

const resolveCommandMock = vi.fn();

vi.mock("@commands", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@commands")>();
  return {
    ...actual,
    ResolveCommand: (...args: unknown[]) => resolveCommandMock(...args),
  };
});

function createMockClient() {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => Promise<void>) => {
      handlers.set(event, handler);
    }),
    emitInteraction: async (interaction: unknown) => {
      const handler = handlers.get(Events.InteractionCreate);
      if (handler) {
        await handler(interaction);
      }
    },
  };
}

function createComponentInteraction(type: "button" | "select" | "userSelect" | "modal") {
  const reply = vi.fn().mockResolvedValue(undefined);
  return {
    customId: "test:interaction",
    deferred: false,
    replied: false,
    reply,
    isButton: () => type === "button",
    isStringSelectMenu: () => type === "select",
    isUserSelectMenu: () => type === "userSelect",
    isModalSubmit: () => type === "modal",
    isChatInputCommand: () => false,
  };
}

describe("RegisterInteractionHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes handled button interactions without replying", async () => {
    const client = createMockClient();
    const logger = createMockLogger();
    const componentRouter = {
      HandleButton: vi.fn().mockResolvedValue(true),
      HandleModal: vi.fn(),
      RegisterButton: vi.fn(),
      RegisterButtonPrefix: vi.fn(),
    };
    const selectMenuRouter = { HandleSelectMenu: vi.fn() };
    const userSelectMenuRouter = { HandleUserSelectMenu: vi.fn() };
    const modalRouter = { HandleModal: vi.fn() };

    RegisterInteractionHandlers({
      client: client as never,
      logger,
      componentRouter: componentRouter as never,
      selectMenuRouter: selectMenuRouter as never,
      userSelectMenuRouter: userSelectMenuRouter as never,
      modalRouter: modalRouter as never,
    });

    const interaction = createComponentInteraction("button");
    await client.emitInteraction(interaction);

    expect(componentRouter.HandleButton).toHaveBeenCalledWith(interaction);
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it("replies ephemerally when button interaction is unhandled", async () => {
    const client = createMockClient();
    const logger = createMockLogger();
    const componentRouter = {
      HandleButton: vi.fn().mockResolvedValue(false),
    };

    RegisterInteractionHandlers({
      client: client as never,
      logger,
      componentRouter: componentRouter as never,
      selectMenuRouter: { HandleSelectMenu: vi.fn() } as never,
      userSelectMenuRouter: { HandleUserSelectMenu: vi.fn() } as never,
      modalRouter: { HandleModal: vi.fn() } as never,
    });

    const interaction = createComponentInteraction("button");
    await client.emitInteraction(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: "This interaction is no longer available.",
      flags: MessageFlags.Ephemeral,
    });
    expect(logger.Debug).toHaveBeenCalledWith(
      "Unhandled button interaction",
      expect.objectContaining({
        extra: { customId: "test:interaction" },
      }),
    );
  });

  it.each([
    ["select", "HandleSelectMenu", "Unhandled select menu interaction"] as const,
    [
      "userSelect",
      "HandleUserSelectMenu",
      "Unhandled user select menu interaction",
    ] as const,
    ["modal", "HandleModal", "Unhandled modal interaction"] as const,
  ])(
    "replies when %s interaction is unhandled",
    async (type, _handlerName, logMessage) => {
      const client = createMockClient();
      const logger = createMockLogger();
      const selectMenuRouter = {
        HandleSelectMenu: vi.fn().mockResolvedValue(false),
      };
      const userSelectMenuRouter = {
        HandleUserSelectMenu: vi.fn().mockResolvedValue(false),
      };
      const modalRouter = { HandleModal: vi.fn().mockResolvedValue(false) };

      RegisterInteractionHandlers({
        client: client as never,
        logger,
        componentRouter: { HandleButton: vi.fn() } as never,
        selectMenuRouter: selectMenuRouter as never,
        userSelectMenuRouter: userSelectMenuRouter as never,
        modalRouter: modalRouter as never,
      });

      const interaction = createComponentInteraction(type);
      await client.emitInteraction(interaction);

      expect(interaction.reply).toHaveBeenCalledWith({
        content: "This interaction is no longer available.",
        flags: MessageFlags.Ephemeral,
      });
      expect(logger.Debug).toHaveBeenCalledWith(
        logMessage,
        expect.objectContaining({
          extra: { customId: "test:interaction" },
        }),
      );
    },
  );

  it("skips reply when interaction is already deferred", async () => {
    const client = createMockClient();
    const componentRouter = { HandleButton: vi.fn().mockResolvedValue(false) };

    RegisterInteractionHandlers({
      client: client as never,
      logger: createMockLogger(),
      componentRouter: componentRouter as never,
      selectMenuRouter: { HandleSelectMenu: vi.fn() } as never,
      userSelectMenuRouter: { HandleUserSelectMenu: vi.fn() } as never,
      modalRouter: { HandleModal: vi.fn() } as never,
    });

    const interaction = createComponentInteraction("button");
    interaction.deferred = true;
    await client.emitInteraction(interaction);

    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it("logs expected Discord API errors as debug when reply fails", async () => {
    const client = createMockClient();
    const logger = createMockLogger();
    const componentRouter = { HandleButton: vi.fn().mockResolvedValue(false) };

    RegisterInteractionHandlers({
      client: client as never,
      logger,
      componentRouter: componentRouter as never,
      selectMenuRouter: { HandleSelectMenu: vi.fn() } as never,
      userSelectMenuRouter: { HandleUserSelectMenu: vi.fn() } as never,
      modalRouter: { HandleModal: vi.fn() } as never,
    });

    const interaction = createComponentInteraction("button");
    interaction.reply = vi.fn().mockRejectedValue(
      new DiscordAPIError(
        { message: "Unknown interaction", code: 10062 },
        10062,
        404,
        "POST",
        "https://discord.com/api/v10/interactions/x/callback",
        {},
      ),
    );

    await client.emitInteraction(interaction);

    expect(logger.Debug).toHaveBeenCalledWith(
      "Could not reply to unhandled interaction",
      expect.objectContaining({
        extra: expect.objectContaining({ code: "10062" }),
      }),
    );
  });

  it("logs unexpected reply errors as warnings", async () => {
    const client = createMockClient();
    const logger = createMockLogger();
    const componentRouter = { HandleButton: vi.fn().mockResolvedValue(false) };

    RegisterInteractionHandlers({
      client: client as never,
      logger,
      componentRouter: componentRouter as never,
      selectMenuRouter: { HandleSelectMenu: vi.fn() } as never,
      userSelectMenuRouter: { HandleUserSelectMenu: vi.fn() } as never,
      modalRouter: { HandleModal: vi.fn() } as never,
    });

    const interaction = createComponentInteraction("button");
    interaction.reply = vi.fn().mockRejectedValue(new Error("network failure"));

    await client.emitInteraction(interaction);

    expect(logger.Warn).toHaveBeenCalledWith(
      "Could not reply to unhandled interaction",
      expect.objectContaining({
        error: expect.any(Error),
      }),
    );
  });
});

describe("RegisterCommandHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ignores non-chat-input interactions", async () => {
    const client = createMockClient();
    const executeCommand = vi.fn();

    RegisterCommandHandler({
      client: client as never,
      executeCommand,
      responders: createMockResponderSet(),
      logger: createMockLogger(),
    });

    await client.emitInteraction({
      isChatInputCommand: () => false,
    });

    expect(executeCommand).not.toHaveBeenCalled();
  });

  it("skips unknown commands", async () => {
    const client = createMockClient();
    const executeCommand = vi.fn();
    resolveCommandMock.mockReturnValue(undefined);

    RegisterCommandHandler({
      client: client as never,
      executeCommand,
      responders: createMockResponderSet(),
      logger: createMockLogger(),
    });

    await client.emitInteraction({
      isChatInputCommand: () => true,
      commandName: "missing",
    });

    expect(resolveCommandMock).toHaveBeenCalledWith("missing");
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it("executes resolved slash commands", async () => {
    const client = createMockClient();
    const executeCommand = vi.fn().mockResolvedValue(undefined);
    const logger = createMockLogger();
    const command = {
      data: { name: "ping", description: "Ping" },
      group: "utility",
      execute: vi.fn(),
    };
    resolveCommandMock.mockReturnValue(command);

    RegisterCommandHandler({
      client: client as never,
      executeCommand,
      responders: createMockResponderSet(),
      logger,
    });

    const interaction = {
      isChatInputCommand: () => true,
      commandName: "ping",
      id: "interaction-1",
      guildId: "guild-1",
      user: { id: "user-1" },
    };

    await client.emitInteraction(interaction);

    expect(executeCommand).toHaveBeenCalledWith(
      command,
      interaction,
      expect.any(Object),
      expect.objectContaining({ Child: expect.any(Function) }),
    );
  });
});
