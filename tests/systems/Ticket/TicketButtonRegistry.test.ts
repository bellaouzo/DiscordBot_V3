import { describe, expect, it, vi } from "vitest";
import { RegisterTicketButtons } from "@systems/Ticket/TicketButtonRegistry";
import { createMockContext, createMockLogger } from "../../helpers";

describe("TicketButtonRegistry", () => {
  it("registers all ticket button prefixes", () => {
    const context = createMockContext();
    const registerPrefix = vi.fn();
    const componentRouter = {
      RegisterButtonPrefix: registerPrefix,
      RegisterButton: vi.fn(),
      HandleButton: vi.fn(),
    };
    context.responders.componentRouter = componentRouter as never;

    RegisterTicketButtons({
      responders: context.responders,
      logger: createMockLogger(),
      databases: context.databases,
    });

    expect(registerPrefix).toHaveBeenCalledTimes(4);
    expect(registerPrefix).toHaveBeenCalledWith(
      "ticket:claim:",
      expect.any(Object),
    );
    expect(registerPrefix).toHaveBeenCalledWith(
      "ticket:add:",
      expect.any(Object),
    );
    expect(registerPrefix).toHaveBeenCalledWith(
      "ticket:remove:",
      expect.any(Object),
    );
    expect(registerPrefix).toHaveBeenCalledWith(
      "ticket:close:",
      expect.any(Object),
    );
  });

  it("skips claim handler when guild is missing", async () => {
    const context = createMockContext();
    let claimHandler: ((interaction: { guild: null }) => Promise<void>) | null =
      null;
    const componentRouter = {
      RegisterButtonPrefix: vi.fn((_prefix, config) => {
        if (_prefix === "ticket:claim:") {
          claimHandler = config.handler;
        }
      }),
      RegisterButton: vi.fn(),
      HandleButton: vi.fn(),
    };
    context.responders.componentRouter = componentRouter as never;

    RegisterTicketButtons({
      responders: context.responders,
      logger: createMockLogger(),
      databases: context.databases,
    });

    expect(claimHandler).not.toBeNull();
    await claimHandler?.({ guild: null });
  });
});
