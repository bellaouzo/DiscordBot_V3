export interface Logger {
  Info(message: string, context?: Record<string, unknown>): void
  Warn(message: string, context?: Record<string, unknown>): void
  Error(message: string, context?: Record<string, unknown>): void
  Debug(message: string, context?: Record<string, unknown>): void
}

class ConsoleLogger implements Logger {
  Info(message: string, context?: Record<string, unknown>): void {
    this.LogToConsole('info', message, context)
  }

  Warn(message: string, context?: Record<string, unknown>): void {
    this.LogToConsole('warn', message, context)
  }

  Error(message: string, context?: Record<string, unknown>): void {
    this.LogToConsole('error', message, context)
  }

  Debug(message: string, context?: Record<string, unknown>): void {
    this.LogToConsole('debug', message, context)
  }

  private LogToConsole(level: 'info' | 'warn' | 'error' | 'debug', message: string, context?: Record<string, unknown>) {
    if (context) {
      console[level](message, context)
      return
    }
    console[level](message)
  }
}

export function CreateConsoleLogger(): Logger {
  return new ConsoleLogger()
}

