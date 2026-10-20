import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import {
  HasTableColumn,
  RunMigrations,
} from "@database/Migrations/MigrationRunner";
import { ServerMigrations } from "@database/Migrations/server";
import { GuildSettingsStore } from "@database/Server/Stores/GuildSettingsStore";
import {
  GUILD_SETTING_KEYS,
  ParseGuildSettingsInput,
} from "@database/Server/GuildSettingsSchema";
import { createMockLogger } from "../helpers";

function CreateStore(): GuildSettingsStore {
  const db = new Database(":memory:");
  RunMigrations(db, ServerMigrations, createMockLogger());
  return new GuildSettingsStore(db, createMockLogger());
}

describe("GuildSettingsSchema", () => {
  it("has a migrated column for every schema field", () => {
    const db = new Database(":memory:");
    RunMigrations(db, ServerMigrations, createMockLogger());

    const missing = GUILD_SETTING_KEYS.filter(
      (key) => !HasTableColumn(db, "guild_settings", key),
    );
    expect(missing).toEqual([]);
  });

  it("returns schema defaults for a new guild", () => {
    const settings = CreateStore().UpsertGuildSettings({ guild_id: "g1" });

    expect(settings).toMatchObject({
      admin_role_ids: [],
      ticket_category_id: null,
      starboard_emoji: "⭐",
      starboard_threshold: 3,
      verification_enabled: false,
      verification_min_account_age_days: 0,
      economy_enabled: true,
      giveaways_enabled: true,
      roblox_linked_at: null,
    });
  });

  it("keeps omitted fields and normalizes id lists", () => {
    const store = CreateStore();
    store.UpsertGuildSettings({
      guild_id: "g1",
      admin_role_ids: ["a", " a ", "b"],
      starboard_threshold: 7,
    });

    const updated = store.UpsertGuildSettings({
      guild_id: "g1",
      economy_enabled: false,
    });

    expect(updated.admin_role_ids).toEqual(["a", "b"]);
    expect(updated.starboard_threshold).toBe(7);
    expect(updated.economy_enabled).toBe(false);
  });

  it("clears clearable fields on null but keeps non-clearable ones", () => {
    const store = CreateStore();
    store.UpsertGuildSettings({
      guild_id: "g1",
      autorole_id: "role-1",
      ticket_category_id: "cat-1",
    });

    const updated = store.UpsertGuildSettings({
      guild_id: "g1",
      autorole_id: null,
      ticket_category_id: null,
    });

    expect(updated.autorole_id).toBeNull();
    expect(updated.ticket_category_id).toBe("cat-1");
  });

  it("parses dashboard input for editable fields only", () => {
    const update = ParseGuildSettingsInput("g1", {
      admin_role_ids: "a, b",
      starboard_threshold: "5",
      verification_min_account_age_days: "",
      economy_enabled: 0,
      roblox_linked_at: 123,
    });

    expect(update).toMatchObject({
      guild_id: "g1",
      admin_role_ids: ["a", "b"],
      starboard_threshold: 5,
      verification_min_account_age_days: 0,
      economy_enabled: false,
    });
    expect(update).not.toHaveProperty("roblox_linked_at");
  });
});
