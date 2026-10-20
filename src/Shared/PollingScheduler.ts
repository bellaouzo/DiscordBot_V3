import type { Logger } from "./Logger";

export interface PollingSchedulerOptions {
  /** Name used in log messages, e.g. "GiveawayScheduler". */
  readonly name: string;
  readonly intervalMs: number;
  readonly logger: Logger;
  /** Logged at Error level when a poll throws. */
  readonly failureMessage: string;
}

/**
 * Base for background jobs that poll on a fixed interval. Runs once immediately on Start,
 * never overlaps polls, and logs (rather than propagates) poll failures.
 */
export abstract class PollingScheduler {
  private interval: NodeJS.Timeout | null = null;
  private isPolling = false;

  protected constructor(private readonly polling: PollingSchedulerOptions) {}

  Start(): void {
    if (this.interval) {
      this.polling.logger.Warn(`${this.polling.name} already running`);
      return;
    }

    this.interval = setInterval(() => {
      void this.RunPoll();
    }, this.polling.intervalMs);

    void this.RunPoll();
  }

  Stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /** One unit of scheduled work. Throwing is safe; the error is logged. */
  protected abstract Poll(): Promise<void>;

  private async RunPoll(): Promise<void> {
    if (this.isPolling) {
      return;
    }
    this.isPolling = true;

    try {
      await this.Poll();
    } catch (error) {
      this.polling.logger.Error(this.polling.failureMessage, { error });
    } finally {
      this.isPolling = false;
    }
  }
}
