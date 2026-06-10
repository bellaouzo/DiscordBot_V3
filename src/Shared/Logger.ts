export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogContext {
  readonly phase?: string;
  readonly timestamp?: string;
  readonly command?: string;
  readonly interactionId?: string;
  readonly guildId?: string;
  readonly userId?: string;
  readonly error?: unknown;
  readonly extra?: Record<string, unknown>;

  readonly targetUserId?: string;
  readonly reason?: string;
  readonly name?: string;
  readonly group?: string;
  readonly file?: string;
  readonly tag?: string;
  readonly id?: string;
}

export interface Logger {
  Info(message: string, context?: LogContext): void;
  Warn(message: string, context?: LogContext): void;
  Error(message: string, context?: LogContext): void;
  Debug(message: string, context?: LogContext): void;
  Child(context: LogContext): Logger;
}

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function ResolveMinLogLevel(): LogLevel {
  if (process.env.LOG_DEBUG === "true") {
    return "debug";
  }

  const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  if (raw in LEVEL_RANK) {
    return raw as LogLevel;
  }

  return "info";
}

const MIN_LOG_LEVEL = ResolveMinLogLevel();

function ReadErrorCause(error: Error): unknown {
  if (!("cause" in error)) {
    return undefined;
  }

  return (error as Error & { cause?: unknown }).cause;
}

function SerializeLogValue(value: unknown): unknown {
  if (value instanceof Error) {
    const cause = ReadErrorCause(value);

    return {
      name: value.name,
      message: value.message,
      ...(value.stack ? { stack: value.stack } : {}),
      ...(cause !== undefined ? { cause: SerializeLogValue(cause) } : {}),
    };
  }

  if (Array.isArray(value)) {
    return value.map(SerializeLogValue);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        SerializeLogValue(entry),
      ]),
    );
  }

  return value;
}

function FormatContextForOutput(context: Record<string, unknown>): string {
  const serialized = Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      key,
      SerializeLogValue(value),
    ]),
  );

  return JSON.stringify(serialized)
    .replace(/"/g, "")
    .replace(/:/g, ": ")
    .replace(/,/g, ", ");
}

class ConsoleLogger implements Logger {
  constructor(private readonly baseContext: LogContext = {}) {}

  Info(message: string, context?: LogContext): void {
    this.LogToConsole("info", message, context);
  }

  Warn(message: string, context?: LogContext): void {
    this.LogToConsole("warn", message, context);
  }

  Error(message: string, context?: LogContext): void {
    this.LogToConsole("error", message, context);
  }

  Debug(message: string, context?: LogContext): void {
    this.LogToConsole("debug", message, context);
  }

  Child(context: LogContext): Logger {
    return new ConsoleLogger({ ...this.baseContext, ...context });
  }

  private LogToConsole(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): void {
    if (LEVEL_RANK[level] < LEVEL_RANK[MIN_LOG_LEVEL]) {
      return;
    }

    const timestamp = context?.timestamp ?? new Date().toISOString();
    const mergedContext = { ...this.baseContext, ...context };

    const { extra, error, ...regularFields } = mergedContext;
    const regularEntries = Object.entries(regularFields).filter(
      ([, value]) => value !== undefined,
    );
    const hasExtra = extra && Object.keys(extra).length > 0;

    const levelColor = this.GetLevelColor(level);
    const levelText = `[${level.toUpperCase()}]`;

    let output = `[${timestamp}] ${levelColor}${levelText}\x1b[0m ${message}`;

    const contextForOutput: Record<string, unknown> = {
      ...Object.fromEntries(regularEntries),
      ...(error !== undefined ? { error: SerializeLogValue(error) } : {}),
    };

    if (Object.keys(contextForOutput).length > 0) {
      output += ` \x1b[36m${FormatContextForOutput(contextForOutput)}\x1b[0m`;
    }

    if (hasExtra) {
      output += ` \x1b[32m${FormatContextForOutput({ extra })}\x1b[0m`;
    }

    console[level](output);

    if (level === "error" && error !== undefined) {
      this.PrintErrorDetails(error);
    }
  }

  private PrintErrorDetails(error: unknown): void {
    const serialized = SerializeLogValue(error);

    if (
      serialized &&
      typeof serialized === "object" &&
      "message" in serialized &&
      typeof serialized.message === "string" &&
      serialized.message.length > 0
    ) {
      console.error(`\x1b[31m  Caused by: ${serialized.message}\x1b[0m`);

      if (
        "stack" in serialized &&
        typeof serialized.stack === "string" &&
        serialized.stack.length > 0
      ) {
        console.error(
          `\x1b[90m${serialized.stack
            .split("\n")
            .slice(1)
            .map((line) => `  ${line}`)
            .join("\n")}\x1b[0m`,
        );
      }

      return;
    }

    console.error(`\x1b[31m  Caused by: ${String(error)}\x1b[0m`);
  }

  private GetLevelColor(level: LogLevel): string {
    switch (level) {
      case "error":
        return "\x1b[31m";
      case "warn":
        return "\x1b[33m";
      case "info":
        return "\x1b[34m";
      case "debug":
        return "\x1b[90m";
      default:
        return "\x1b[0m";
    }
  }
}

export function CreateConsoleLogger(context?: LogContext): Logger {
  return new ConsoleLogger(context);
}
