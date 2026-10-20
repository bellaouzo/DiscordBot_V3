import type { DiscordProfile } from "discord-strategy";

/**
 * Partial guild returned by Discord's `/users/@me/guilds`, attached to the profile by `consume.guilds()`.
 */
export interface OAuthGuild {
  readonly id: string;
  readonly name: string;
  readonly icon: string | null;
  readonly owner: boolean;
  /** Permission bitfield as a decimal string. */
  readonly permissions: string;
}

/**
 * The Discord profile stored in the session after OAuth login.
 */
export interface SessionUser extends DiscordProfile {
  guilds?: OAuthGuild[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends SessionUser {}
  }
}
