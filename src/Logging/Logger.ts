export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface LogContext {
  readonly phase?: string
  readonly timestamp?: string
  readonly command?: string
  readonly interactionId?: string
  readonly guildId?: string
  readonly userId?: string
  readonly error?: unknown
  readonly extra?: Record<string, unknown>
  
  // Common logging fields for better autocomplete
  readonly targetUserId?: string
  readonly reason?: string
  readonly name?: string
  readonly group?: string
  readonly file?: string
  readonly tag?: string
  readonly id?: string
}

export interface Logger {
  Info(message: string, context?: LogContext): void
  Warn(message: string, context?: LogContext): void
  Error(message: string, context?: LogContext): void
  Debug(message: string, context?: LogContext): void
  Child(context: LogContext): Logger
}

class ConsoleLogger implements Logger {
  constructor(private readonly baseContext: LogContext = {}) {}

  Info(message: string, context?: LogContext): void {
    this.LogToConsole('info', message, context)
  }

  Warn(message: string, context?: LogContext): void {
    this.LogToConsole('warn', message, context)
  }

  Error(message: string, context?: LogContext): void {
    this.LogToConsole('error', message, context)
  }

  Debug(message: string, context?: LogContext): void {
    this.LogToConsole('debug', message, context)
  }

  Child(context: LogContext): Logger {
    return new ConsoleLogger({ ...this.baseContext, ...context })
  }

  private LogToConsole(level: LogLevel, message: string, context?: LogContext): void {
    const timestamp = context?.timestamp ?? new Date().toISOString()
    const mergedContext = { ...this.baseContext, ...context }
    
    // Separate regular fields from extra for better formatting
    const { extra, ...regularFields } = mergedContext
    const regularEntries = Object.entries(regularFields).filter(([, value]) => value !== undefined)
    const hasExtra = extra && Object.keys(extra).length > 0
    
    let output = `[${timestamp}] [${level.toUpperCase()}] ${message}`
    
    // Add regular context fields with spacing
    if (regularEntries.length > 0) {
      const regularContext = Object.fromEntries(regularEntries)
      output += ` \x1b[36m${JSON.stringify(regularContext).replace(/"/g, '').replace(/:/g, ': ').replace(/,/g, ', ')}\x1b[0m`
    }
    
    // Add extra fields with spacing
    if (hasExtra) {
      output += ` \x1b[32m${JSON.stringify({ extra }).replace(/"/g, '').replace(/:/g, ': ').replace(/,/g, ', ')}\x1b[0m`
    }
    
    console[level](output)
  }
}

export function CreateConsoleLogger(context?: LogContext): Logger {
  return new ConsoleLogger(context)
}

