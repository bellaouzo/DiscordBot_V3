import { describe, expect, it, vi } from "vitest";
import { MessageFlags } from "discord.js";
import { PaginatedResponder } from "@responders/PaginatedResponder";
import { createMockLogger } from "../helpers";

vi.mock("@shared/Paginator", () => {
  const instances: Array<{
    Start: ReturnType<typeof vi.fn>;
    Dispose: ReturnType<typeof vi.fn>;
  }> = [];

  class MockPaginator {
    Start = vi.fn().mockResolvedValue(undefined);
    Dispose = vi.fn();

    constructor() {
      instances.push(this);
    }
  }

  return {
    CreatePaginator: vi.fn(() => new MockPaginator()),
    __mockInstances: instances,
  };
});

describe("PaginatedResponder", () => {
  it("starts a paginator and tracks it by interaction id", async () => {
    const interactionResponder = {
      Reply: vi.fn(),
      Edit: vi.fn(),
    };
    const buttonResponder = { DeferUpdate: vi.fn() };
    const componentRouter = { RegisterButton: vi.fn() };
    const responder = new PaginatedResponder(
      interactionResponder as never,
      buttonResponder as never,
      componentRouter as never,
      createMockLogger(),
    );

    const interaction = { id: "interaction-99", user: { id: "user-1" } };
    await responder.Send({
      interaction: interaction as never,
      pages: [{ content: "Page 1" }],
      flags: MessageFlags.Ephemeral,
    });

    const paginatorModule = await import("@shared/Paginator");
    const instances = (
      paginatorModule as {
        __mockInstances: Array<{ Start: ReturnType<typeof vi.fn> }>;
      }
    ).__mockInstances;
    expect(instances.at(-1)?.Start).toHaveBeenCalled();
  });

  it("disposes active paginator when cancelled", async () => {
    const interactionResponder = { Reply: vi.fn(), Edit: vi.fn() };
    const responder = new PaginatedResponder(
      interactionResponder as never,
      { DeferUpdate: vi.fn() } as never,
      { RegisterButton: vi.fn() } as never,
      createMockLogger(),
    );
    const interaction = { id: "interaction-cancel", user: { id: "user-1" } };

    await responder.Send({
      interaction: interaction as never,
      pages: [{ content: "Page 1" }],
    });

    const paginatorModule = await import("@shared/Paginator");
    const instances = (
      paginatorModule as {
        __mockInstances: Array<{ Dispose: ReturnType<typeof vi.fn> }>;
      }
    ).__mockInstances;
    const instance = instances.at(-1);
    expect(instance).toBeDefined();

    responder.Cancel(interaction as never);
    expect(instance?.Dispose).toHaveBeenCalled();
  });

  it("logs and cleans up when paginator start fails", async () => {
    const logger = createMockLogger();
    const paginatorModule = await import("@shared/Paginator");
    const { CreatePaginator } = paginatorModule;
    vi.mocked(CreatePaginator).mockImplementationOnce(
      () =>
        ({
          Start: vi.fn().mockRejectedValue(new Error("start failed")),
          Dispose: vi.fn(),
        }) as never,
    );

    const responder = new PaginatedResponder(
      { Reply: vi.fn(), Edit: vi.fn() } as never,
      { DeferUpdate: vi.fn() } as never,
      { RegisterButton: vi.fn() } as never,
      logger,
    );

    await responder.Send({
      interaction: { id: "interaction-fail", user: { id: "user-1" } } as never,
      pages: [{ content: "Page 1" }],
    });

    expect(logger.Error).toHaveBeenCalledWith(
      "Failed to start paginator",
      expect.objectContaining({ error: expect.any(Error) }),
    );
  });
});
