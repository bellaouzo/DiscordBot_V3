import { Router } from "express";
import { ChannelType } from "discord.js";
import type { Client } from "discord.js";
import type { DatabaseSet, Warning } from "@database";
import { AllCommands } from "@commands/registry";
import { IsAdmin } from "@utilities/StaffPermissions";
import { createVerifyAdmin } from "../middleware/auth";

export function createApiRouter(
  client: Client,
  databases: DatabaseSet,
): Router {
  const router = Router();
  const verifyAdmin = createVerifyAdmin(client, databases);

  // API to fetch current user
  router.get("/@me", (req, res) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.json(req.user);
  });

  router.get("/commands", (_req, res) => {
    const commands = AllCommands().map((c) => ({
      name: c.data.name,
      description: c.data.description,
      group: c.group,
    }));
    res.json(commands);
  });

  router.get("/guilds", async (req, res) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = req.user as any;
    if (!user.guilds) {
      res.json([]);
      return;
    }

    const botGuilds = client.guilds.cache;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mutualGuildsRaw = user.guilds.filter((g: any) => botGuilds.has(g.id));

    const mutualGuilds = [];
    for (const g of mutualGuildsRaw) {
      const guild = botGuilds.get(g.id);
      if (!guild) continue;

      let isAdmin = false;

      try {
        if (g.owner) {
          isAdmin = true;
        } else if (g.permissions) {
          const perms = BigInt(g.permissions);
          const administrator = 8n;
          const manageGuild = 32n;
          if (
            (perms & administrator) === administrator ||
            (perms & manageGuild) === manageGuild
          ) {
            isAdmin = true;
          }
        }

        if (!isAdmin) {
          const member = guild.members.cache.get(user.id);
          if (member) {
            const settings = databases.serverDb.GetGuildSettings(g.id);
            isAdmin = IsAdmin(member, settings);
          }
        }

        mutualGuilds.push({
          id: g.id,
          name: g.name,
          icon: g.icon,
          isAdmin,
        });
      } catch (err) {
        console.error("Error computing mutual guilds", err);
      }
    }

    res.json(mutualGuilds);
  });

  router.get("/tickets/:guildId", (req, res) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = req.user as any;
    const guildId = req.params.guildId as string;
    const tickets = databases.ticketDb.GetUserTickets(user.id, guildId);
    res.json(tickets);
  });

  router.get("/tickets/:guildId/:ticketId", async (req, res) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = req.user as any;
    const guildId = req.params.guildId as string;
    const ticketId = parseInt(req.params.ticketId as string);

    const ticket = databases.ticketDb.GetTicket(ticketId);
    if (!ticket || ticket.guild_id !== guildId) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    let hasAccess = false;
    if (ticket.user_id === user.id) hasAccess = true;
    else {
      const participants = databases.ticketDb.GetActiveParticipants(ticketId);
      if (participants.some((p) => p.user_id === user.id)) hasAccess = true;
      else {
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
          const member = guild.members.cache.get(user.id);
          if (member) {
            const settings = databases.serverDb.GetGuildSettings(guild.id);
            if (IsAdmin(member, settings)) hasAccess = true;
          }
        }
      }
    }

    if (!hasAccess) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const messages = databases.ticketDb.GetTicketMessages(ticketId);

    const userIds = new Set<string>();
    userIds.add(ticket.user_id);
    if (ticket.claimed_by) {
      userIds.add(ticket.claimed_by);
    }
    for (const msg of messages) {
      userIds.add(msg.user_id);
    }

    const usernameMap = new Map<string, string>();
    await Promise.all(
      Array.from(userIds).map(async (uid) => {
        try {
          const cached = client.users.cache.get(uid);
          if (cached) {
            usernameMap.set(uid, cached.username);
          } else {
            const fetched = await client.users.fetch(uid);
            usernameMap.set(uid, fetched.username);
          }
        } catch {
          usernameMap.set(uid, "Unknown User");
        }
      }),
    );

    const enrichedTicket = {
      ...ticket,
      creator_username: usernameMap.get(ticket.user_id) || "Unknown User",
      closed_by_username: ticket.claimed_by
        ? usernameMap.get(ticket.claimed_by) || "Unknown User"
        : null,
    };

    const enrichedMessages = messages.map((m) => ({
      ...m,
      username: usernameMap.get(m.user_id) || "Unknown User",
    }));

    res.json({ ticket: enrichedTicket, messages: enrichedMessages });
  });

  router.get("/infractions/:guildId", (req, res) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = req.user as any;
    const guildId = req.params.guildId as string;

    const kicks = databases.moderationDb.ListModerationEvents({
      guild_id: guildId,
      user_id: user.id,
      action: "kick",
    });
    const bans = databases.moderationDb.ListModerationEvents({
      guild_id: guildId,
      user_id: user.id,
      action: "ban",
    });
    const mutes = databases.moderationDb.ListUserTempActions({
      guild_id: guildId,
      user_id: user.id,
      action: "mute",
    });

    res.json({ kicks, bans, mutes });
  });

  // --- Admin Endpoints ---

  router.get("/admin/tickets/:guildId", verifyAdmin, (req, res) => {
    const guildId = req.params.guildId as string;
    const openTickets = databases.ticketDb.GetGuildTickets(guildId, "open");
    const closedTickets = databases.ticketDb.GetGuildTickets(guildId, "closed");
    res.json(
      [...openTickets, ...closedTickets].sort(
        (a, b) => a.created_at - b.created_at,
      ),
    );
  });

  router.get("/admin/infractions/:guildId", verifyAdmin, (req, res) => {
    const guildId = req.params.guildId as string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (databases.moderationDb as any).db;
    try {
      const events = db
        .prepare(
          "SELECT * FROM moderation_events WHERE guild_id = ? ORDER BY created_at DESC LIMIT 100",
        )
        .all(guildId);
      const tempActions = db
        .prepare(
          "SELECT * FROM temp_actions WHERE guild_id = ? ORDER BY created_at DESC LIMIT 100",
        )
        .all(guildId);
      res.json({ events, tempActions });
    } catch {
      res.json({ events: [], tempActions: [] });
    }
  });

  router.post(
    "/admin/tickets/:guildId/close/:ticketId",
    verifyAdmin,
    (req, res) => {
      const ticketId = parseInt(req.params.ticketId as string);
      const reason = req.body?.reason || null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const user = req.user as any;
      const success = databases.ticketDb.CloseTicket(ticketId, user.id, reason);
      res.json({ success });
    },
  );

  router.get("/admin/users/:guildId", verifyAdmin, async (req, res) => {
    const guildId = req.params.guildId as string;
    const query = (req.query.q as string) || "";
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      res.status(404).json({ error: "Guild not found" });
      return;
    }

    try {
      let members;
      if (query.trim() === "") {
        members = await guild.members.fetch({ limit: 50 });
      } else {
        members = await guild.members.fetch({ query, limit: 50 });
      }

      const result = members.map((m) => ({
        id: m.id,
        username: m.user.username,
        avatarUrl: m.user.displayAvatarURL({ size: 64 }),
      }));

      res.json(result);
    } catch {
      res.status(500).json({ error: "Failed to fetch members" });
    }
  });

  router.get("/admin/user/:guildId/:userId", verifyAdmin, async (req, res) => {
    const guildId = req.params.guildId as string;
    const userId = req.params.userId as string;

    let userProfile = null;
    try {
      const discordUser = await client.users.fetch(userId);
      userProfile = {
        id: discordUser.id,
        username: discordUser.username,
        avatarUrl: discordUser.displayAvatarURL({ size: 128 }),
      };
    } catch {
      // If fetch fails, we just won't have the rich discord profile
    }

    // Fetch warnings history
    let warnings: Warning[] = [];
    try {
      warnings = databases.userDb.GetWarnings(userId, guildId);
    } catch {
      // Ignore warnings error
    }

    const kicks = databases.moderationDb.ListModerationEvents({
      guild_id: guildId,
      user_id: userId,
      action: "kick",
    });
    const bans = databases.moderationDb.ListModerationEvents({
      guild_id: guildId,
      user_id: userId,
      action: "ban",
    });
    const mutes = databases.moderationDb.ListUserTempActions({
      guild_id: guildId,
      user_id: userId,
      action: "mute",
    });

    const tickets = databases.ticketDb.GetUserTickets(userId, guildId);

    // Resolve Guild Member details (roles, join date, nickname)
    let memberDetails = null;
    const guild = client.guilds.cache.get(guildId);
    if (guild) {
      try {
        const member = await guild.members.fetch(userId);
        memberDetails = {
          nickname: member.nickname,
          joinedAt: member.joinedAt ? member.joinedAt.getTime() : null,
          createdAt: member.user.createdAt.getTime(),
          roles: member.roles.cache
            .filter((r) => r.name !== "@everyone")
            .map((r) => ({ id: r.id, name: r.name, color: r.hexColor })),
        };
      } catch {
        if (userProfile) {
          try {
            const u = await client.users.fetch(userId);
            memberDetails = {
              nickname: null,
              joinedAt: null,
              createdAt: u.createdAt.getTime(),
              roles: [],
            };
          } catch {
            // Ignore fetch error
          }
        }
      }
    }

    res.json({
      profile: userProfile,
      member: memberDetails,
      infractions: { kicks, bans, mutes, warnings },
      tickets: tickets.sort((a, b) => a.created_at - b.created_at),
    });
  });

  // --- Admin Settings Config Endpoints ---

  router.get("/admin/settings/:guildId", verifyAdmin, (req, res) => {
    const guildId = req.params.guildId as string;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      res.status(404).json({ error: "Guild not found" });
      return;
    }

    const settings = databases.serverDb.GetGuildSettings(guildId) || {};

    // Format list of channels (text channels and categories)
    const channels = guild.channels.cache
      .filter(
        (c) =>
          c.type === ChannelType.GuildText ||
          c.type === ChannelType.GuildCategory,
      )
      .map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type === ChannelType.GuildCategory ? "category" : "text",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Format list of roles
    const roles = guild.roles.cache
      .filter((r) => r.name !== "@everyone")
      .map((r) => ({
        id: r.id,
        name: r.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({ settings, channels, roles });
  });

  router.post("/admin/settings/:guildId", verifyAdmin, (req, res) => {
    const guildId = req.params.guildId as string;
    const body = req.body;

    const parseRoles = (val: unknown): string[] => {
      if (Array.isArray(val)) return val.map(String);
      if (typeof val === "string")
        return val
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      return [];
    };

    const settingsToSave = {
      guild_id: guildId,
      admin_role_ids: parseRoles(body.admin_role_ids),
      mod_role_ids: parseRoles(body.mod_role_ids),
      ticket_category_id: body.ticket_category_id || null,
      appeal_review_category_id: body.appeal_review_category_id || null,
      command_log_channel_id: body.command_log_channel_id || null,
      ticket_log_channel_id: body.ticket_log_channel_id || null,
      announcement_channel_id: body.announcement_channel_id || null,
      delete_log_channel_id: body.delete_log_channel_id || null,
      production_log_channel_id: body.production_log_channel_id || null,
      welcome_channel_id: body.welcome_channel_id || null,
      autorole_id: body.autorole_id || null,
      starboard_channel_id: body.starboard_channel_id || null,
      starboard_emoji: body.starboard_emoji || null,
      starboard_threshold:
        typeof body.starboard_threshold === "number"
          ? body.starboard_threshold
          : body.starboard_threshold
            ? parseInt(String(body.starboard_threshold))
            : null,
      verification_enabled: Boolean(body.verification_enabled),
      unverified_role_id: body.unverified_role_id || null,
      verified_role_id: body.verified_role_id || null,
      verification_min_account_age_days:
        typeof body.verification_min_account_age_days === "number"
          ? body.verification_min_account_age_days
          : body.verification_min_account_age_days
            ? parseInt(String(body.verification_min_account_age_days))
            : 0,
      verification_channel_id: body.verification_channel_id || null,
      economy_enabled: Boolean(body.economy_enabled),
      giveaways_enabled: Boolean(body.giveaways_enabled),
    };

    try {
      databases.serverDb.UpsertGuildSettings(settingsToSave);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to save settings" });
    }
  });

  return router;
}
