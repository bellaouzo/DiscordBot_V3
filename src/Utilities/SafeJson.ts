export interface ParseResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
}

export function SafeParseJson<T>(
  raw: string,
  validator?: (data: unknown) => data is T
): ParseResult<T> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (validator && !validator(parsed)) {
      return { success: false, error: "Validation failed" };
    }
    return { success: true, data: parsed as T };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Parse error",
    };
  }
}

export function isStringArray(data: unknown): data is string[] {
  return Array.isArray(data) && data.every((item) => typeof item === "string");
}

export function isRecord(data: unknown): data is Record<string, unknown> {
  return typeof data === "object" && data !== null && !Array.isArray(data);
}

export function isNumber(data: unknown): data is number {
  return typeof data === "number" && !isNaN(data);
}

export function isString(data: unknown): data is string {
  return typeof data === "string";
}
