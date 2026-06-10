import type { ServerDatabase } from "@database/ServerDatabase";

export interface CooldownStateStore {
  Get(key: string): number | undefined;
  Set(key: string, expiresAt: number): void;
  Prune(now: number): void;
  Clear(): void;
}

class InMemoryCooldownStateStore implements CooldownStateStore {
  private readonly entries = new Map<string, number>();

  Get(key: string): number | undefined {
    return this.entries.get(key);
  }

  Set(key: string, expiresAt: number): void {
    this.entries.set(key, expiresAt);
  }

  Prune(now: number): void {
    if (this.entries.size <= 100) {
      return;
    }

    for (const [key, expiry] of this.entries.entries()) {
      if (now >= expiry) {
        this.entries.delete(key);
      }
    }
  }

  Clear(): void {
    this.entries.clear();
  }
}

class SqliteCooldownStateStore implements CooldownStateStore {
  constructor(private readonly serverDb: ServerDatabase) {}

  Get(key: string): number | undefined {
    const [userId, commandName] = key.split(":");
    if (!userId || !commandName) {
      return undefined;
    }
    return this.serverDb.GetCommandCooldownExpiry(userId, commandName);
  }

  Set(key: string, expiresAt: number): void {
    const [userId, commandName] = key.split(":");
    if (!userId || !commandName) {
      return;
    }
    this.serverDb.SetCommandCooldownExpiry(userId, commandName, expiresAt);
  }

  Prune(now: number): void {
    this.serverDb.PruneExpiredCommandCooldowns(now);
  }

  Clear(): void {
    this.serverDb.PruneExpiredCommandCooldowns(0);
  }
}

let activeStore: CooldownStateStore = new InMemoryCooldownStateStore();

export function GetCooldownStateStore(): CooldownStateStore {
  return activeStore;
}

export function ConfigureCooldownPersistence(serverDb: ServerDatabase): void {
  activeStore = new SqliteCooldownStateStore(serverDb);
}

export function ResetCooldownStoreForTesting(): void {
  activeStore = new InMemoryCooldownStateStore();
}
