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
