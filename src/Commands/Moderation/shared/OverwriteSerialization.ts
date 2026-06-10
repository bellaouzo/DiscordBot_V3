import type { OverwriteResolvable } from "discord.js";
import { OverwriteType } from "discord.js";
import { SafeParseJson } from "@utilities";

export type StoredOverwrite = {
  id: string;
  allow: string;
  deny: string;
  type: OverwriteType;
};

function isStoredOverwriteArray(data: unknown): data is StoredOverwrite[] {
  if (!Array.isArray(data)) return false;
  return data.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      "id" in item &&
      "allow" in item &&
      "deny" in item &&
      "type" in item,
  );
}

function toBigInt(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  const bitfield = (value as { bitfield?: unknown })?.bitfield;
  return typeof bitfield === "bigint" ? bitfield : 0n;
}

export function SerializeOverwrites(
  overwrites: Iterable<OverwriteResolvable>,
): string {
  const serialized: StoredOverwrite[] = [];

  for (const overwrite of overwrites) {
    const data = overwrite as Partial<{
      id: string;
      allow: unknown;
      deny: unknown;
      type: OverwriteType;
    }>;

    if (typeof data.id !== "string") {
      continue;
    }

    serialized.push({
      id: data.id,
      allow: toBigInt(data.allow).toString(),
      deny: toBigInt(data.deny).toString(),
      type: data.type ?? OverwriteType.Role,
    });
  }

  return JSON.stringify(serialized);
}

export function ParseOverwrites(serialized: string): OverwriteResolvable[] {
  const result = SafeParseJson(serialized, isStoredOverwriteArray);
  if (!result.success || !result.data) {
    return [];
  }
  return result.data.map((entry) => ({
    id: entry.id,
    allow: BigInt(entry.allow),
    deny: BigInt(entry.deny),
    type: entry.type,
  }));
}
