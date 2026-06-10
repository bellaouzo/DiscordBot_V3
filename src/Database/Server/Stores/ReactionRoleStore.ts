import type Database from "better-sqlite3";
import type {
  ReactionRoleMapping,
  ReactionRolePanel,
} from "@database/Server/Types";

type PanelRow = {
  id: number;
  guild_id: string;
  channel_id: string;
  message_id: string;
  created_by: string;
  created_at: number;
};

type MappingRow = {
  id: number;
  panel_id: number;
  emoji: string;
  role_id: string;
};

function MapPanel(row: PanelRow): ReactionRolePanel {
  return {
    id: row.id,
    guild_id: row.guild_id,
    channel_id: row.channel_id,
    message_id: row.message_id,
    created_by: row.created_by,
    created_at: row.created_at,
  };
}

function MapMapping(row: MappingRow): ReactionRoleMapping {
  return {
    id: row.id,
    panel_id: row.panel_id,
    emoji: row.emoji,
    role_id: row.role_id,
  };
}

export class ReactionRoleStore {
  constructor(private readonly db: Database.Database) {}

  CreatePanel(data: {
    guild_id: string;
    channel_id: string;
    message_id: string;
    created_by: string;
  }): ReactionRolePanel {
    const created_at = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO reaction_role_panels (guild_id, channel_id, message_id, created_by, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const id = stmt.run(
      data.guild_id,
      data.channel_id,
      data.message_id,
      data.created_by,
      created_at,
    ).lastInsertRowid as number;

    const row = this.db
      .prepare("SELECT * FROM reaction_role_panels WHERE id = ?")
      .get(id) as PanelRow;

    return MapPanel(row);
  }

  GetPanelById(guild_id: string, panel_id: number): ReactionRolePanel | null {
    const row = this.db
      .prepare(
        "SELECT * FROM reaction_role_panels WHERE guild_id = ? AND id = ?",
      )
      .get(guild_id, panel_id) as PanelRow | undefined;

    return row ? MapPanel(row) : null;
  }

  GetPanelByMessage(
    guild_id: string,
    message_id: string,
  ): ReactionRolePanel | null {
    const row = this.db
      .prepare(
        "SELECT * FROM reaction_role_panels WHERE guild_id = ? AND message_id = ?",
      )
      .get(guild_id, message_id) as PanelRow | undefined;

    return row ? MapPanel(row) : null;
  }

  ListPanels(guild_id: string): ReactionRolePanel[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM reaction_role_panels WHERE guild_id = ? ORDER BY created_at DESC",
      )
      .all(guild_id) as PanelRow[];

    return rows.map(MapPanel);
  }

  ListPanelsByChannel(
    guild_id: string,
    channel_id: string,
  ): ReactionRolePanel[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM reaction_role_panels WHERE guild_id = ? AND channel_id = ? ORDER BY created_at DESC",
      )
      .all(guild_id, channel_id) as PanelRow[];

    return rows.map(MapPanel);
  }

  DeletePanel(id: number): boolean {
    const result = this.db
      .prepare("DELETE FROM reaction_role_panels WHERE id = ?")
      .run(id);

    return result.changes > 0;
  }

  AddMapping(data: {
    panel_id: number;
    emoji: string;
    role_id: string;
  }): ReactionRoleMapping {
    const stmt = this.db.prepare(`
      INSERT INTO reaction_role_mappings (panel_id, emoji, role_id)
      VALUES (?, ?, ?)
    `);
    const id = stmt.run(data.panel_id, data.emoji, data.role_id)
      .lastInsertRowid as number;

    const row = this.db
      .prepare("SELECT * FROM reaction_role_mappings WHERE id = ?")
      .get(id) as MappingRow;

    return MapMapping(row);
  }

  RemoveMapping(id: number): boolean {
    const result = this.db
      .prepare("DELETE FROM reaction_role_mappings WHERE id = ?")
      .run(id);

    return result.changes > 0;
  }

  GetMappingByPanelAndEmoji(
    panel_id: number,
    emoji: string,
  ): ReactionRoleMapping | null {
    const row = this.db
      .prepare(
        "SELECT * FROM reaction_role_mappings WHERE panel_id = ? AND emoji = ?",
      )
      .get(panel_id, emoji) as MappingRow | undefined;

    return row ? MapMapping(row) : null;
  }

  RemoveMappingByPanelAndEmoji(
    panel_id: number,
    emoji: string,
  ): ReactionRoleMapping | null {
    const mapping = this.GetMappingByPanelAndEmoji(panel_id, emoji);
    if (!mapping) {
      return null;
    }

    this.db
      .prepare("DELETE FROM reaction_role_mappings WHERE id = ?")
      .run(mapping.id);

    return mapping;
  }

  ListMappings(panel_id: number): ReactionRoleMapping[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM reaction_role_mappings WHERE panel_id = ? ORDER BY id ASC",
      )
      .all(panel_id) as MappingRow[];

    return rows.map(MapMapping);
  }

  GetMappingByEmoji(
    guild_id: string,
    message_id: string,
    emoji: string,
  ): (ReactionRoleMapping & { panel_id: number }) | null {
    const row = this.db
      .prepare(
        `
        SELECT m.*
        FROM reaction_role_mappings m
        INNER JOIN reaction_role_panels p ON p.id = m.panel_id
        WHERE p.guild_id = ? AND p.message_id = ? AND m.emoji = ?
      `,
      )
      .get(guild_id, message_id, emoji) as MappingRow | undefined;

    return row ? MapMapping(row) : null;
  }

  ListAllMappings(guild_id: string): Array<
    ReactionRoleMapping & {
      message_id: string;
      channel_id: string;
    }
  > {
    const rows = this.db
      .prepare(
        `
        SELECT m.id, m.panel_id, m.emoji, m.role_id, p.message_id, p.channel_id
        FROM reaction_role_mappings m
        INNER JOIN reaction_role_panels p ON p.id = m.panel_id
        WHERE p.guild_id = ?
        ORDER BY m.id ASC
      `,
      )
      .all(guild_id) as Array<
      MappingRow & { message_id: string; channel_id: string }
    >;

    return rows.map((row) => ({
      id: row.id,
      panel_id: row.panel_id,
      emoji: row.emoji,
      role_id: row.role_id,
      message_id: row.message_id,
      channel_id: row.channel_id,
    }));
  }
}
