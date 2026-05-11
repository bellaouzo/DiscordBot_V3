import Database from "better-sqlite3";
import {
  Appeal,
  AppealActionType,
  AppealStatus,
} from "@database/Moderation/Types";
import { MapAppeal } from "@database/Moderation/Mappers";

export class AppealStore {
  constructor(private readonly db: Database.Database) {}

  AddAppeal(data: {
    guild_id: string;
    user_id: string;
    action_type: AppealActionType;
    action_ref?: string | null;
    reason: string;
    evidence?: string | null;
    review_channel_id?: string | null;
    review_message_id?: string | null;
  }): Appeal {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO appeals (
        guild_id,
        user_id,
        action_type,
        action_ref,
        reason,
        evidence,
        status,
        review_channel_id,
        review_message_id,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)
    `);

    const id = stmt.run(
      data.guild_id,
      data.user_id,
      data.action_type,
      data.action_ref ?? null,
      data.reason.trim(),
      data.evidence?.trim() ?? null,
      data.review_channel_id ?? null,
      data.review_message_id ?? null,
      now,
      now
    ).lastInsertRowid as number;

    const appeal = this.GetAppealById(id);
    if (!appeal) {
      throw new Error("Failed to create appeal");
    }

    return appeal;
  }

  GetAppealById(id: number): Appeal | null {
    const stmt = this.db.prepare("SELECT * FROM appeals WHERE id = ?");
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? MapAppeal(row) : null;
  }

  ListAppeals(options: {
    guild_id: string;
    user_id?: string;
    status?: AppealStatus;
    action_type?: AppealActionType;
    limit?: number;
  }): Appeal[] {
    const conditions = ["guild_id = ?"];
    const params: (string | number)[] = [options.guild_id];

    if (options.user_id) {
      conditions.push("user_id = ?");
      params.push(options.user_id);
    }

    if (options.status) {
      conditions.push("status = ?");
      params.push(options.status);
    }

    if (options.action_type) {
      conditions.push("action_type = ?");
      params.push(options.action_type);
    }

    let query = `
      SELECT *
      FROM appeals
      WHERE ${conditions.join(" AND ")}
      ORDER BY created_at DESC
    `;

    if (options.limit && options.limit > 0) {
      query += " LIMIT ?";
      params.push(options.limit);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as Record<string, unknown>[];
    return rows.map((row) => MapAppeal(row));
  }

  UpdateAppealReviewMessage(data: {
    id: number;
    review_channel_id: string;
    review_message_id: string;
  }): boolean {
    const updated_at = Date.now();
    const stmt = this.db.prepare(
      `
      UPDATE appeals
      SET review_channel_id = ?, review_message_id = ?, updated_at = ?
      WHERE id = ?
    `
    );
    const result = stmt.run(
      data.review_channel_id,
      data.review_message_id,
      updated_at,
      data.id
    );
    return result.changes > 0;
  }

  ResolveAppeal(data: {
    id: number;
    status: Exclude<AppealStatus, "open">;
    resolved_by: string;
    resolved_reason?: string | null;
  }): Appeal | null {
    const now = Date.now();
    const stmt = this.db.prepare(
      `
      UPDATE appeals
      SET status = ?, resolved_by = ?, resolved_reason = ?, resolved_at = ?, updated_at = ?
      WHERE id = ? AND status = 'open'
    `
    );

    const result = stmt.run(
      data.status,
      data.resolved_by,
      data.resolved_reason ?? null,
      now,
      now,
      data.id
    );

    if (result.changes === 0) {
      return null;
    }

    return this.GetAppealById(data.id);
  }
}
