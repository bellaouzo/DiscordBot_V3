import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InteractiveSession } from "@shared/InteractiveSession";
import { ComponentRouter } from "@shared/ComponentRouter";
import { createMockLogger } from "../helpers";

function CreateSession(onTimeout = vi.fn()) {
  const router = new ComponentRouter(createMockLogger());
  const session = new InteractiveSession({
    componentRouter: router,
    ownerId: "owner",
    timeoutMs: 1000,
    onTimeout,
  });
  return { router, session, onTimeout };
}

describe("InteractiveSession", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("registers owner-only buttons that expire with the session", async () => {
    const { router, session } = CreateSession();
    const handler = vi.fn();
    const customId = session.RegisterButton(handler);

    const reply = vi.fn().mockResolvedValue(undefined);
    await router.HandleButton({
      customId,
      user: { id: "someone-else" },
      deferred: false,
      replied: false,
      reply,
    } as never);

    expect(handler).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalled();
  });

  it("resolves once and disposes its buttons", () => {
    const { router, session } = CreateSession();
    session.RegisterButton(vi.fn());
    session.RegisterButton(vi.fn());

    expect(session.Resolve()).toBe(true);
    expect(session.Resolve()).toBe(false);
    expect(session.IsResolved).toBe(true);
    expect(router.Size).toBe(0);
  });

  it("times out once after Start when not resolved", () => {
    const { session, onTimeout } = CreateSession();
    session.Start();

    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(5000);

    expect(onTimeout).toHaveBeenCalledOnce();
    expect(session.IsResolved).toBe(true);
  });

  it("does not time out after it has been resolved", () => {
    const { session, onTimeout } = CreateSession();
    session.Start();
    session.Resolve();

    vi.advanceTimersByTime(5000);

    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("stops the timeout without ending the session", () => {
    const { session, onTimeout } = CreateSession();
    session.Start();
    session.StopTimer();

    vi.advanceTimersByTime(5000);

    expect(onTimeout).not.toHaveBeenCalled();
    expect(session.IsResolved).toBe(false);
    expect(session.Resolve()).toBe(true);
  });

  it("does not start a timeout for an already-resolved session", () => {
    const { session, onTimeout } = CreateSession();
    session.Resolve();
    session.Start();

    vi.advanceTimersByTime(5000);

    expect(onTimeout).not.toHaveBeenCalled();
  });
});
