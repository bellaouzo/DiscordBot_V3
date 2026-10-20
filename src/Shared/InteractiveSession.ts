import type { ButtonInteraction } from "discord.js";
import type { ComponentRouter } from "./ComponentRouter";

export interface InteractiveSessionOptions {
  readonly componentRouter: ComponentRouter;
  /** Only this user may press the session's buttons. */
  readonly ownerId: string;
  /** How long the session waits for input before timing out. */
  readonly timeoutMs: number;
  /** Runs once if the session times out before it is resolved (e.g. refund and disable buttons). */
  readonly onTimeout: () => Promise<void> | void;
}

/**
 * The lifecycle shared by multi-step button flows (games, prompts): owner-only buttons,
 * one timeout, and a single resolution that cleans everything up.
 *
 * Usage: register buttons, send the reply, then call `Start()`. In a handler that ends the
 * flow, call `Resolve()` first and stop if it returns false (the flow already ended).
 */
export class InteractiveSession {
  private readonly registrations: Array<{ dispose: () => void }> = [];
  private timeoutHandle: NodeJS.Timeout | null = null;
  private resolved = false;

  constructor(private readonly options: InteractiveSessionOptions) {}

  get IsResolved(): boolean {
    return this.resolved;
  }

  /**
   * Registers an owner-only button that expires with the session.
   *
   * @returns The button's custom ID.
   */
  RegisterButton(
    handler: (interaction: ButtonInteraction) => Promise<void> | void,
  ): string {
    const registration = this.options.componentRouter.RegisterButton({
      ownerId: this.options.ownerId,
      expiresInMs: this.options.timeoutMs,
      handler,
    });
    this.registrations.push(registration);
    return registration.customId;
  }

  /** Starts the timeout. Call once the session's message has been sent. */
  Start(): void {
    if (this.resolved || this.timeoutHandle) {
      return;
    }
    this.timeoutHandle = setTimeout(() => {
      if (this.Resolve()) {
        void this.options.onTimeout();
      }
    }, this.options.timeoutMs);
  }

  /**
   * Cancels the pending timeout without ending the session, for flows that keep running
   * after the user commits (e.g. an animated race that resolves itself later).
   */
  StopTimer(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }

  /**
   * Ends the session: clears the timeout and disposes every button.
   *
   * @returns True the first time; false if the session had already ended.
   */
  Resolve(): boolean {
    if (this.resolved) {
      return false;
    }
    this.resolved = true;
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
    this.registrations.forEach((registration) => registration.dispose());
    return true;
  }
}
