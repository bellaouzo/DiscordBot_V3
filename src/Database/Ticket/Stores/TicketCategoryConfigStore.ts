import Database from "better-sqlite3";
import { MapTicketCategoryConfig } from "@database/Ticket/Mappers";
import {
  TICKET_CATEGORIES,
  TicketCategoryConfig,
} from "@database/Ticket/Types";

export class TicketCategoryConfigStore {
  constructor(private readonly db: Database.Database) {}

  EnsureCategoryConfigs(guild_id: string): TicketCategoryConfig[] {
    const existing = this.GetCategoryConfigs(guild_id);
    if (existing.length > 0) {
      return existing;
    }

    const insert = this.db.prepare(`
      INSERT INTO ticket_category_configs (guild_id, value, label, description, emoji, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    TICKET_CATEGORIES.forEach((category, index) => {
      insert.run(
        guild_id,
        category.value,
        category.label,
        category.description,
        category.emoji,
        index,
      );
    });

    return this.GetCategoryConfigs(guild_id);
  }

  GetCategoryConfigs(guild_id: string): TicketCategoryConfig[] {
    const stmt = this.db.prepare(
      "SELECT * FROM ticket_category_configs WHERE guild_id = ? ORDER BY sort_order ASC, id ASC",
    );
    const rows = stmt.all(guild_id) as Record<string, unknown>[];
    return rows.map((row) => MapTicketCategoryConfig(row));
  }

  GetCategoryConfig(
    guild_id: string,
    value: string,
  ): TicketCategoryConfig | null {
    const stmt = this.db.prepare(
      "SELECT * FROM ticket_category_configs WHERE guild_id = ? AND value = ?",
    );
    const row = stmt.get(guild_id, value) as
      | Record<string, unknown>
      | undefined;
    return row ? MapTicketCategoryConfig(row) : null;
  }

  AddCategoryConfig(data: {
    guild_id: string;
    value: string;
    label: string;
    description: string;
    emoji: string;
    sort_order?: number;
  }): TicketCategoryConfig {
    const configs = this.GetCategoryConfigs(data.guild_id);
    const sortOrder = data.sort_order ?? configs.length;
    const stmt = this.db.prepare(`
      INSERT INTO ticket_category_configs (guild_id, value, label, description, emoji, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const id = stmt.run(
      data.guild_id,
      data.value.trim().toLowerCase(),
      data.label.trim(),
      data.description.trim(),
      data.emoji.trim(),
      sortOrder,
    ).lastInsertRowid as number;

    const config = this.db
      .prepare("SELECT * FROM ticket_category_configs WHERE id = ?")
      .get(id) as Record<string, unknown>;

    return MapTicketCategoryConfig(config);
  }

  UpdateCategoryConfig(
    guild_id: string,
    value: string,
    updates: {
      label?: string;
      description?: string;
      emoji?: string;
      sort_order?: number;
    },
  ): TicketCategoryConfig | null {
    const existing = this.GetCategoryConfig(guild_id, value);
    if (!existing) {
      return null;
    }

    const stmt = this.db.prepare(`
      UPDATE ticket_category_configs
      SET label = ?, description = ?, emoji = ?, sort_order = ?
      WHERE guild_id = ? AND value = ?
    `);

    stmt.run(
      updates.label ?? existing.label,
      updates.description ?? existing.description,
      updates.emoji ?? existing.emoji,
      updates.sort_order ?? existing.sort_order,
      guild_id,
      value,
    );

    return this.GetCategoryConfig(guild_id, value);
  }

  RemoveCategoryConfig(guild_id: string, value: string): boolean {
    const stmt = this.db.prepare(
      "DELETE FROM ticket_category_configs WHERE guild_id = ? AND value = ?",
    );
    const result = stmt.run(guild_id, value);
    return result.changes > 0;
  }
}
