import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { TicketDatabase } from "@database/TicketDatabase";
import { TICKET_CATEGORIES } from "@database/Ticket/Types";
import { createMockLogger } from "../helpers";

describe("TicketDatabase core operations", () => {
  let db: TicketDatabase;
  let tempDir: string;
  let originalDataDir: string | undefined;

  beforeEach(() => {
    originalDataDir = process.env.DATA_DIR;
    tempDir = mkdtempSync(join(tmpdir(), "ticket-db-core-"));
    process.env.DATA_DIR = tempDir;
    db = new TicketDatabase(createMockLogger());
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

  it("creates, fetches, and closes tickets", () => {
    const ticket = db.CreateTicket({
      user_id: "user-1",
      guild_id: "guild-1",
      channel_id: "channel-1",
      category: "general",
    });

    expect(ticket.id).toBeGreaterThan(0);
    expect(ticket.status).toBe("open");
    expect(ticket.channel_id).toBe("channel-1");

    const fetched = db.GetTicket(ticket.id);
    expect(fetched?.user_id).toBe("user-1");

    const byChannel = db.GetTicketByChannel("channel-1");
    expect(byChannel?.id).toBe(ticket.id);

    expect(db.GetActiveUserTickets("user-1", "guild-1")).toHaveLength(1);
    expect(db.CloseTicket(ticket.id, "mod-1")).toBe(true);

    const closed = db.GetTicket(ticket.id);
    expect(closed?.status).toBe("closed");
    expect(closed?.claimed_by).toBe("mod-1");
    expect(closed?.closed_at).not.toBeNull();
    expect(db.GetActiveUserTickets("user-1", "guild-1")).toHaveLength(0);
    expect(db.GetGuildTickets("guild-1", "closed")).toHaveLength(1);
  });

  it("manages tags for a ticket", () => {
    const ticket = db.CreateTicket({
      user_id: "user-1",
      guild_id: "guild-1",
      channel_id: null,
      category: "general",
    });

    expect(db.AddTicketTag(ticket.id, "Billing")).toBe(true);
    expect(db.AddTicketTag(ticket.id, "billing")).toBe(false);
    expect(db.ListTicketTags(ticket.id)).toEqual(["billing"]);

    const second = db.CreateTicket({
      user_id: "user-2",
      guild_id: "guild-1",
      channel_id: null,
      category: "technical",
    });
    db.AddTicketTag(second.id, "urgent");

    expect(db.GetTagsForTickets([ticket.id, second.id])).toEqual({
      [ticket.id]: ["billing"],
      [second.id]: ["urgent"],
    });

    expect(db.RemoveTicketTag(ticket.id, "BILLING")).toBe(true);
    expect(db.ListTicketTags(ticket.id)).toEqual([]);
  });

  it("tracks participant add and remove history", () => {
    const ticket = db.CreateTicket({
      user_id: "user-1",
      guild_id: "guild-1",
      channel_id: null,
      category: "general",
    });

    const participant = db.AddParticipant(ticket.id, "user-2", "user-1");
    expect(participant.user_id).toBe("user-2");
    expect(db.GetActiveParticipants(ticket.id)).toHaveLength(1);

    expect(db.RemoveParticipant(ticket.id, "user-2", "mod-1")).toBe(true);
    expect(db.GetActiveParticipants(ticket.id)).toHaveLength(0);

    const history = db.GetParticipantHistory(ticket.id);
    expect(history).toHaveLength(1);
    expect(history[0].removed_by).toBe("mod-1");
    expect(history[0].removed_at).not.toBeUndefined();
  });

  it("seeds default and custom category configs per guild", () => {
    const seeded = db.EnsureCategoryConfigs("guild-1");
    expect(seeded).toHaveLength(TICKET_CATEGORIES.length);
    expect(seeded[0].value).toBe("general");

    const cached = db.EnsureCategoryConfigs("guild-1");
    expect(cached).toHaveLength(TICKET_CATEGORIES.length);

    const custom = db.AddCategoryConfig({
      guild_id: "guild-1",
      value: "vip",
      label: "VIP Support",
      description: "Priority support",
      emoji: "⭐",
      sort_order: 99,
    });
    expect(custom.value).toBe("vip");

    const updated = db.UpdateCategoryConfig("guild-1", "vip", {
      label: "VIP Priority",
    });
    expect(updated?.label).toBe("VIP Priority");

    expect(db.RemoveCategoryConfig("guild-1", "vip")).toBe(true);
    expect(db.GetCategoryConfig("guild-1", "vip")).toBeNull();
    expect(db.GetCategoryConfigs("guild-1")).toHaveLength(
      TICKET_CATEGORIES.length,
    );
  });
});
