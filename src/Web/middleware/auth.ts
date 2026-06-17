import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { Client } from "discord.js";
import type { DatabaseSet } from "@database";
import { IsAdmin } from "@utilities/StaffPermissions";

export function createVerifyAdmin(
  client: Client,
  databases: DatabaseSet,
): RequestHandler {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = req.user as any;
    const guildId = req.params.guildId as string;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      res.status(404).json({ error: "Guild not found" });
      return;
    }

    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      res.status(403).json({ error: "Not a member" });
      return;
    }

    const settings = databases.serverDb.GetGuildSettings(guildId);
    if (!IsAdmin(member, settings)) {
      res.status(403).json({ error: "Forbidden: Admin required" });
      return;
    }

    next();
  };
}
