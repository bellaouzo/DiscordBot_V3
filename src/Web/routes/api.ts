import { Router } from "express";
import { ChannelType } from "discord.js";
import type { Client, Guild } from "discord.js";
import type { DatabaseSet, Warning } from "@database";
import { PrimaryCommands } from "@commands/registry";
import { IsAdmin } from "@utilities/StaffPermissions";
import { createVerifyAdmin } from "../middleware/auth";
import type { OAuthGuild } from "../types";
import { ParseGuildSettingsInput } from "@database/Server/GuildSettingsSchema";

export function createApiRouter(
  client: Client,
  databases: DatabaseSet,
): Router {
  const router = Router();
  const verifyAdmin = createVerifyAdmin(client, databases);

  // Owner, Administrator/Manage Guild in OAuth perms, or a configured staff admin role
  function IsGuildAdmin(
    oauthGuild: OAuthGuild,
    guild: Guild,
    userId: string,
  ): boolean {
    if (oauthGuild.owner) return true;
    if (oauthGuild.permissions) {
      const perms = BigInt(oauthGuild.permissions);
      const administrator = 8n;
      const manageGuild = 32n;
      if (
        (perms & administrator) === administrator ||
        (perms & manageGuild) === manageGuild
      ) {
        return true;
      }
    }
    const member = guild.members.cache.get(userId);
    if (!member) return false;
    return IsAdmin(member, databases.serverDb.GetGuildSettings(guild.id));
  }

  async function ResolveUsernames(
    ids: Iterable<string>,
  ): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    await Promise.all(
      Array.from(new Set(ids)).map(async (uid) => {
        try {
          const user =
            client.users.cache.get(uid) ?? (await client.users.fetch(uid));
          names.set(uid, user.username);
        } catch {
          names.set(uid, "Unknown User");
        }
      }),
    );
    return names;
  }

  // API to fetch current user
  router.get("/@me", (req, res) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.json(req.user);
  });

  router.get("/commands", (_req, res) => {
    const commands = PrimaryCommands().map((c) => ({
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

    const user = req.user as Express.User;
    if (!user.guilds) {
      res.json([]);
      return;
    }

    const botGuilds = client.guilds.cache;
    const mutualGuildsRaw = user.guilds.filter((g) => botGuilds.has(g.id));

    const mutualGuilds = [];
    for (const g of mutualGuildsRaw) {
      const guild = botGuilds.get(g.id);
      if (!guild) continue;

      try {
        const isAdmin = IsGuildAdmin(g, guild, user.id);

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
    const user = req.user as Express.User;
    const guildId = req.params.guildId as string;
    const tickets = databases.ticketDb.GetUserTickets(user.id, guildId);
    res.json(tickets);
  });

  router.get("/tickets/:guildId/:ticketId", async (req, res) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const user = req.user as Express.User;
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
    const user = req.user as Express.User;
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

  router.get("/overview/:guildId", async (req, res) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const user = req.user as Express.User;
    const guildId = req.params.guildId as string;
    const oauthGuild = user.guilds?.find((g) => g.id === guildId);
    const guild = client.guilds.cache.get(guildId);
    if (!oauthGuild || !guild) {
      res.status(404).json({ error: "Guild not found" });
      return;
    }

    const isAdmin = IsGuildAdmin(oauthGuild, guild, user.id);
    const settings = databases.serverDb.GetGuildSettings(guildId);
    const leaderboard = databases.userDb.GetXpLeaderboard(guildId, 6);
    const richest = databases.userDb.GetTopBalances(guildId, 5);

    let admin = null;
    if (isAdmin) {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const openTickets = databases.ticketDb
        .GetGuildTickets(guildId, "open")
        .sort((a, b) => b.created_at - a.created_at);
      const cases = [
        ...databases.moderationDb.ListGuildModerationEvents(guildId, 50),
        ...databases.moderationDb.ListGuildTempActions(guildId, 50),
      ]
        .map((c) => ({
          action: c.action,
          user_id: c.user_id,
          moderator_id: c.moderator_id,
          reason: c.reason,
          created_at: c.created_at,
        }))
        .sort((a, b) => b.created_at - a.created_at);

      admin = {
        openTicketCount: openTickets.length,
        openTickets: openTickets.slice(0, 4).map((t) => ({
          id: t.id,
          category: t.category,
          user_id: t.user_id,
          created_at: t.created_at,
        })),
        casesLast7d: cases.filter((c) => c.created_at >= weekAgo).length,
        recentCases: cases.slice(0, 6),
      };
    }

    const names = await ResolveUsernames([
      ...leaderboard.map((e) => e.userId),
      ...richest.map((e) => e.userId),
      ...(admin?.openTickets.map((t) => t.user_id) ?? []),
      ...(admin?.recentCases.flatMap((c) => [c.user_id, c.moderator_id]) ?? []),
    ]);

    res.json({
      guild: {
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        memberCount: guild.memberCount,
      },
      isAdmin,
      modules: {
        economy: settings?.economy_enabled ?? true,
        giveaways: settings?.giveaways_enabled ?? true,
        spamFilter: settings?.spam_filter_enabled ?? false,
        verification: settings?.verification_enabled ?? false,
        starboard: Boolean(settings?.starboard_channel_id),
        tickets: Boolean(settings?.ticket_category_id),
      },
      leaderboard: leaderboard.map((e) => ({
        ...e,
        username: names.get(e.userId) ?? e.userId,
      })),
      richest: richest.map((e) => ({
        userId: e.userId,
        balance: e.balance,
        username: names.get(e.userId) ?? e.userId,
      })),
      usernames: Object.fromEntries(names),
      admin,
    });
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
    try {
      const events = databases.moderationDb.ListGuildModerationEvents(guildId);
      const tempActions = databases.moderationDb.ListGuildTempActions(guildId);
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
      const user = req.user as Express.User;
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

    const settingsToSave = ParseGuildSettingsInput(guildId, body);

    try {
      databases.serverDb.UpsertGuildSettings(settingsToSave);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to save settings" });
    }
  });

  return router;
}
