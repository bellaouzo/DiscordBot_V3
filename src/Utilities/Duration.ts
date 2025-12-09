export type DurationUnit = "seconds" | "minutes" | "hours" | "days";

export function ConvertDurationToMs(
  length: number,
  unit: DurationUnit
): number {
  switch (unit) {
    case "seconds":
      return length * 1000;
    case "minutes":
      return length * 60 * 1000;
    case "hours":
      return length * 60 * 60 * 1000;
    case "days":
      return length * 24 * 60 * 60 * 1000;
    default:
      return 0;
  }
}

export function FormatDuration(length: number, unit: DurationUnit): string {
  const isPlural = length !== 1;
  const unitMap: Record<DurationUnit, string> = {
    seconds: isPlural ? "seconds" : "second",
    minutes: isPlural ? "minutes" : "minute",
    hours: isPlural ? "hours" : "hour",
    days: isPlural ? "days" : "day",
  };

  return `${length} ${unitMap[unit]}`;
}

/**
 * Parse a human-readable duration string into milliseconds.
 * Supports formats like: 30s, 30m, 2h, 1d, 1w
 * Also supports compound: 1d12h, 2h30m
 * @returns milliseconds or null if invalid
 */
export function ParseDuration(input: string): number | null {
  if (!input || typeof input !== "string") {
    return null;
  }

  const cleaned = input.toLowerCase().trim();
  
  const simpleMatch = cleaned.match(/^(\d+)(s|m|h|d|w)$/);
  if (simpleMatch) {
    const value = parseInt(simpleMatch[1], 10);
    const unit = simpleMatch[2];
    
    switch (unit) {
      case "s": return value * 1000;
      case "m": return value * 60 * 1000;
      case "h": return value * 60 * 60 * 1000;
      case "d": return value * 24 * 60 * 60 * 1000;
      case "w": return value * 7 * 24 * 60 * 60 * 1000;
    }
  }

  const compoundPattern = /(\d+)(s|m|h|d|w)/g;
  let total = 0;
  let hasMatch = false;
  let match;

  while ((match = compoundPattern.exec(cleaned)) !== null) {
    hasMatch = true;
    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case "s": total += value * 1000; break;
      case "m": total += value * 60 * 1000; break;
      case "h": total += value * 60 * 60 * 1000; break;
      case "d": total += value * 24 * 60 * 60 * 1000; break;
      case "w": total += value * 7 * 24 * 60 * 60 * 1000; break;
    }
  }

  return hasMatch && total > 0 ? total : null;
}
