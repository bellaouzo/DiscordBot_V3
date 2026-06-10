import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessageFlags } from "discord.js";
import { Paginator } from "@shared/Paginator";
import { createMockLogger } from "../helpers";

describe("Paginator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createOptions(overrides?: {
    pages?: Array<{ content: string }>;
    ownerId?: string;
  }) {
    const interactionResponder = {
      Reply: vi.fn().mockResolvedValue({ success: true }),
      Edit: vi.fn().mockResolvedValue({ success: true }),
    };
    const buttonResponder = {
      DeferUpdate: vi.fn().mockResolvedValue({ success: true }),
    };
    const registrations: Array<{
      customId: string;
      handler: (interaction: { user: { id: string } }) => Promise<void>;
      dispose: ReturnType<typeof vi.fn>;
    }> = [];
    const componentRouter = {
      RegisterButton: vi.fn((options) => {
        const entry = {
          customId: options.customId,
          handler: options.handler,
          dispose: vi.fn(),
        };
        registrations.push(entry);
        return entry;
      }),
    };

    const interaction = {
      id: "interaction-1",
      user: { id: "owner-1" },
    };

    return {
      interaction,
      interactionResponder,
      buttonResponder,
      componentRouter,
      registrations,
      paginator: new Paginator({
        interaction: interaction as never,
        pages: overrides?.pages ?? [{ content: "Page 1" }, { content: "Page 2" }],
        interactionResponder: interactionResponder as never,
        buttonResponder: buttonResponder as never,
        componentRouter: componentRouter as never,
        logger: createMockLogger(),
        flags: MessageFlags.Ephemeral,
        ownerId: overrides?.ownerId,
        timeoutMs: 1000,
        idleTimeoutMs: 500,
      }),
    };
  }

  it("replies when there are no pages", async () => {
    const { paginator, interactionResponder, interaction } = createOptions({
      pages: [],
    });

    await paginator.Start();

    expect(interactionResponder.Reply).toHaveBeenCalledWith(interaction, {
      content: "No content available",
      flags: MessageFlags.Ephemeral,
    });
  });

  it("registers navigation buttons and replies with the first page", async () => {
    const { paginator, componentRouter, interactionResponder } = createOptions();

    await paginator.Start();

    expect(componentRouter.RegisterButton).toHaveBeenCalledTimes(4);
    expect(interactionResponder.Reply).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        content: "Page 1",
        components: expect.any(Array),
      }),
    );
  });

  it("navigates to the next page when next button is pressed", async () => {
    const {
      paginator,
      registrations,
      interactionResponder,
      buttonResponder,
    } = createOptions();

    await paginator.Start();
    const next = registrations.find((entry) => entry.customId.endsWith(":next"));
    expect(next).toBeDefined();

    await next?.handler({ user: { id: "owner-1" } } as never);

    expect(buttonResponder.DeferUpdate).toHaveBeenCalled();
    expect(interactionResponder.Edit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ content: "Page 2" }),
    );
  });

  it("stops pagination and clears components when stop is pressed", async () => {
    const { paginator, registrations, interactionResponder } = createOptions();

    await paginator.Start();
    const stop = registrations.find((entry) => entry.customId.endsWith(":stop"));
    expect(stop).toBeDefined();

    await stop?.handler({ user: { id: "owner-1" } } as never);

    expect(interactionResponder.Edit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ components: [] }),
    );
  });

  it("normalizes previous navigation on the first page", async () => {
    const { paginator, registrations, interactionResponder } = createOptions();

    await paginator.Start();
    const prev = registrations.find((entry) => entry.customId.endsWith(":prev"));
    await prev?.handler({ user: { id: "owner-1" } } as never);

    expect(interactionResponder.Edit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ content: "Page 1" }),
    );
  });

  it("ignores navigation after pagination is stopped", async () => {
    const {
      paginator,
      registrations,
      interactionResponder,
      buttonResponder,
    } = createOptions();

    await paginator.Start();
    const stop = registrations.find((entry) => entry.customId.endsWith(":stop"));
    await stop?.handler({ user: { id: "owner-1" } } as never);

    const next = registrations.find((entry) => entry.customId.endsWith(":next"));
    await next?.handler({ user: { id: "owner-1" } } as never);

    expect(buttonResponder.DeferUpdate).toHaveBeenCalledTimes(2);
    expect(interactionResponder.Edit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ components: [] }),
    );
  });

  it("expires idle paginations and clears components", async () => {
    const { paginator, interactionResponder } = createOptions();

    await paginator.Start();
    vi.advanceTimersByTime(1500);

    expect(interactionResponder.Edit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ components: [] }),
    );
  });
});
