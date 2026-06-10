import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ServerDatabase } from "@database/ServerDatabase";
import { createMockLogger } from "../helpers";

describe("ServerDatabase command cooldowns", () => {
  let db: ServerDatabase;
  let tempDir: string;
  let originalDataDir: string | undefined;

  beforeEach(() => {
    originalDataDir = process.env.DATA_DIR;
    tempDir = mkdtempSync(join(tmpdir(), "server-db-cooldowns-"));
    process.env.DATA_DIR = tempDir;
    db = new ServerDatabase(createMockLogger());
  });

  afterEach(() => {
    db.Close();
    if (originalDataDir === undefined) {
      delete process.env.DATA_DIR;
    } else {
      process.env.DATA_DIR = originalDataDir;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("stores and retrieves command cooldown expiry", () => {
    const expiresAt = Date.now() + 30_000;
    db.SetCommandCooldownExpiry("user-1", "ping", expiresAt);
    expect(db.GetCommandCooldownExpiry("user-1", "ping")).toBe(expiresAt);
  });

  it("updates existing cooldown expiry on conflict", () => {
    db.SetCommandCooldownExpiry("user-1", "ping", Date.now() + 10_000);
    const updated = Date.now() + 60_000;
    db.SetCommandCooldownExpiry("user-1", "ping", updated);
    expect(db.GetCommandCooldownExpiry("user-1", "ping")).toBe(updated);
  });

  it("prunes expired cooldown rows", () => {
    db.SetCommandCooldownExpiry("user-1", "ping", Date.now() - 1_000);
    db.SetCommandCooldownExpiry("user-2", "ping", Date.now() + 60_000);
    db.PruneExpiredCommandCooldowns(Date.now());
    expect(db.GetCommandCooldownExpiry("user-1", "ping")).toBeUndefined();
    expect(db.GetCommandCooldownExpiry("user-2", "ping")).toBeGreaterThan(
      Date.now(),
    );
  });
});
