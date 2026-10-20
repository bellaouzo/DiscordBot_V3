import type { ServerDatabase } from "@database/ServerDatabase";
import type { GuildSettings, GuildXpSettings } from "@database/Server/Types";
import type { GuildBooleanSettingKey } from "@database/Server/GuildSettingsSchema";
import { DefaultGuildSettingValues } from "@database/Server/GuildSettingsSchema";

/**
 * Every bot feature, defined once. Help (`/help`, `/<command> about`), the `/setup` feature
 * toggles, and command gating (`.requiredFeature(key)`) all read from this list.
 *
 * To add a feature, add an entry. Give it a `toggle` if guilds can turn it on and off. A
 * toggle backed by a boolean guild setting needs only `setting` (add the setting to
 * GuildSettingsSchema.ts first); derived toggles use `readEnabled` and are saved by /setup.
 */
export interface FeatureState {
  readonly settings: GuildSettings;
  readonly xpSettings: GuildXpSettings;
}

export interface FeatureGuideContent {
  readonly howItWorks: string;
  readonly setup: string;
  /** The slash command that configures the feature, e.g. "/starboard". */
  readonly command: string;
}

export interface FeatureToggle {
  /** Position in the /setup feature list. */
  readonly order: number;
  readonly label: string;
  readonly emoji: string;
  /** Short description shown in /setup. */
  readonly description: string;
  /** Boolean guild setting that stores the toggle. Read and saved generically. */
  readonly setting?: GuildBooleanSettingKey;
  /** For features whose on/off state is derived from other settings. */
  readonly readEnabled?: (state: FeatureState) => boolean;
}

export interface FeatureDefinition {
  readonly key: string;
  readonly name: string;
  readonly icon: string;
  readonly summary: string;
  readonly guide?: FeatureGuideContent;
  readonly toggle?: FeatureToggle;
}

const FEATURE_LIST = [
  {
    key: "starboard",
    name: "Starboard",
    icon: "⭐",
    summary:
      "Automatically highlights popular messages in a dedicated channel.",
    guide: {
      howItWorks:
        "When a message collects enough reactions with your chosen emoji (default ⭐), the bot reposts it to the starboard channel. If reactions later drop below the threshold, the starboard post is removed.",
      setup:
        "`/starboard set-channel` → `/starboard set-emoji` → `/starboard set-threshold`",
      command: "/starboard",
    },
    toggle: {
      order: 3,
      label: "Starboard",
      emoji: "⭐",
      description: "Highlight popular messages",
      readEnabled: (state: FeatureState) =>
        state.settings.starboard_channel_id !== null,
    },
  },
  {
    key: "reactionrole",
    name: "Reaction Roles",
    icon: "🎭",
    summary: "Lets members self-assign roles by reacting to a panel message.",
    guide: {
      howItWorks:
        "Staff post a reaction role panel. Each emoji on that message maps to a role. Members react to get the role and can remove their reaction to remove the role.",
      setup: "`/reactionrole panel` → `/reactionrole add emoji:🎮 role:@Role`",
      command: "/reactionrole",
    },
  },
  {
    key: "leveling",
    name: "Chat XP",
    icon: "📈",
    summary: "Rewards active members with XP and levels for chatting.",
    guide: {
      howItWorks:
        "Members earn XP from messages (with cooldowns, length checks, and daily caps). Level-ups can be announced in a configured channel. Some channels can be excluded.",
      setup:
        "`/xpconfig enable` → `/xpconfig set` → `/xpconfig role-reward add` → `/xpconfig view`",
      command: "/xpconfig",
    },
    toggle: {
      order: 2,
      label: "Leveling",
      emoji: "📈",
      description: "Chat XP, ranks, and level rewards",
      readEnabled: (state: FeatureState) => state.xpSettings.enabled,
    },
  },
  {
    key: "verification",
    name: "Verification",
    icon: "✅",
    summary:
      "Gate new members behind a verify button before full server access.",
    guide: {
      howItWorks:
        "New members receive an unverified role on join. The panel guides them through eligibility checks and a confirmation step before granting access. Optional verified role, account age minimum, and autorole apply after verification. Channel permissions for the unverified role are set in Discord.",
      setup:
        "`/verify set unverified-role:@Unverified` → `/verify enable` → `/verify panel`",
      command: "/verify",
    },
    toggle: {
      order: 4,
      label: "Verification",
      emoji: "✅",
      description: "Gate access until members verify",
      setting: "verification_enabled",
    },
  },
  {
    key: "hub",
    name: "Quick Hub",
    icon: "🏠",
    summary: "One-stop dashboard for tickets, help, stats, appeals, and more.",
    guide: {
      howItWorks:
        "Members get quick-action buttons for opening tickets, browsing commands, viewing stats, submitting appeals, and verifying. Staff see extra shortcuts for open tickets, pending appeals, and disabled commands.",
      setup: "Members run `/hub open` anytime for the quick-action menu",
      command: "/hub",
    },
  },
  {
    key: "autorole",
    name: "Autorole",
    icon: "👋",
    summary: "Automatically gives new members a role when they join.",
    guide: {
      howItWorks:
        "When someone joins the server, the bot assigns the configured role right away. Useful for default member access or verification flows.",
      setup: "`/autorole set role:@Member`",
      command: "/autorole",
    },
  },
  {
    key: "giveaways",
    name: "Giveaways",
    icon: "🎁",
    summary: "Run timed giveaways where members enter by reacting.",
    guide: {
      howItWorks:
        "Staff create a giveaway with a prize and duration. Members react to enter. When time is up, winners are picked from entrants.",
      setup: "`/giveaway create`",
      command: "/giveaway",
    },
    toggle: {
      order: 5,
      label: "Giveaways",
      emoji: "🎁",
      description: "Run timed giveaways with entry buttons",
      setting: "giveaways_enabled",
    },
  },
  {
    key: "event",
    name: "Scheduled Events",
    icon: "📅",
    summary: "Schedule server events with optional announcement reminders.",
    guide: {
      howItWorks:
        "Staff create events with a date and time. The bot can announce them in a channel when they are due, so members know what is coming up.",
      setup: "`/event create` → set announcement channel in event settings",
      command: "/event",
    },
  },
  {
    key: "ticket",
    name: "Support Tickets",
    icon: "🎫",
    summary: "Private channels where members can get help from staff.",
    guide: {
      howItWorks:
        "Members open a ticket via command or panel button. The bot creates a private channel for that conversation. Staff can list, tag, transcript, and close tickets. Categories are configurable.",
      setup: "`/setup` or `/ticket panel` → `/ticket config`",
      command: "/ticket",
    },
  },
  {
    key: "poll",
    name: "Polls",
    icon: "📊",
    summary: "Timed community votes with multiple choices.",
    guide: {
      howItWorks:
        "Staff create a poll with a question, choices, and duration. Members vote on the poll message. Polls can be listed in a channel and ended early if needed.",
      setup: "`/poll create question:... choice_1:... choice_2:...`",
      command: "/poll",
    },
  },
  {
    key: "appeal",
    name: "Moderation Appeals",
    icon: "⚖️",
    summary: "Lets members appeal warnings, mutes, bans, or kicks.",
    guide: {
      howItWorks:
        "Members run a guided appeal flow explaining their case. Staff review appeals in a configured channel and approve or deny them. Members can track status with `/appeal my`.",
      setup: "Configure in `/setup` → members use `/appeal submit`",
      command: "/appeal",
    },
  },
  {
    key: "economy",
    name: "Economy",
    icon: "💰",
    summary: "Server coin system with games, market, duels, and lotteries.",
    guide: {
      howItWorks:
        "Members earn coins from dailies and mini-games, then spend them in the market or gift others. Staff can create server lotteries. Members can challenge each other to coin duels.",
      setup:
        "`/economy daily` → `/economy market view` → `/economy lottery create` (staff)",
      command: "/economy",
    },
    toggle: {
      order: 1,
      label: "Economy",
      emoji: "🪙",
      description: "Coins, games, market, and lotteries",
      setting: "economy_enabled",
    },
  },
  {
    key: "linkfilter",
    name: "Link Filter",
    icon: "🔗",
    summary: "Automatically allows or blocks links by URL pattern.",
    guide: {
      howItWorks:
        "Add substring patterns to allow or block lists. Allow rules take priority over block rules. Messages containing blocked links are removed automatically.",
      setup:
        "`/linkfilter block pattern:bad-site.com` or `/linkfilter allow pattern:trusted.com`",
      command: "/linkfilter",
    },
  },
  {
    key: "raidmode",
    name: "Raid Mode",
    icon: "🛡️",
    summary: "Emergency lockdown during join raids or spam waves.",
    guide: {
      howItWorks:
        "Applies server-wide lockdown and slowmode for a set duration. Expires automatically when time is up and can be disabled early with `/raidmode off`.",
      setup: "`/raidmode on length:10 unit:minutes`",
      command: "/raidmode",
    },
  },
  {
    key: "setup",
    name: "Server Setup",
    icon: "⚙️",
    summary: "Interactive wizard for core channels, roles, and logging.",
    guide: {
      howItWorks:
        "Walks staff through ticket, appeal, welcome, and logging configuration in one place. Best starting point when first adding the bot to a server.",
      setup: "Run `/setup` and follow the on-screen steps",
      command: "/setup",
    },
  },
] as const satisfies readonly FeatureDefinition[];

type FeatureEntry = (typeof FEATURE_LIST)[number];

export type FeatureKey = FeatureEntry["key"];

/** Features a guild can turn on and off; usable with `.requiredFeature(key)`. */
export type ToggleableFeatureKey = Extract<
  FeatureEntry,
  { readonly toggle: object }
>["key"];

export interface ToggleableFeature extends FeatureDefinition {
  readonly key: ToggleableFeatureKey;
  readonly toggle: FeatureToggle;
}

export const FEATURES: readonly FeatureDefinition[] = FEATURE_LIST;

export const TOGGLEABLE_FEATURES: readonly ToggleableFeature[] =
  FEATURES.filter(
    (feature): feature is ToggleableFeature => feature.toggle !== undefined,
  ).sort((a, b) => a.toggle.order - b.toggle.order);

export function GetFeature(key: FeatureKey): FeatureDefinition;
export function GetFeature(key: string): FeatureDefinition | undefined;
export function GetFeature(key: string): FeatureDefinition | undefined {
  return FEATURES.find((feature) => feature.key === key);
}

export function GetToggleableFeature(
  key: ToggleableFeatureKey,
): ToggleableFeature {
  const feature = TOGGLEABLE_FEATURES.find((entry) => entry.key === key);
  if (!feature) {
    throw new Error(`Unknown toggleable feature: ${key}`);
  }
  return feature;
}

export function ReadFeatureEnabled(
  key: ToggleableFeatureKey,
  state: FeatureState,
): boolean {
  const { toggle } = GetToggleableFeature(key);
  if (toggle.readEnabled) {
    return toggle.readEnabled(state);
  }
  if (toggle.setting) {
    return state.settings[toggle.setting];
  }
  throw new Error(`Feature ${key} has neither a setting nor readEnabled`);
}

/**
 * Whether a feature is on for a guild. Guilds without saved settings get schema defaults.
 */
export function IsFeatureEnabled(
  serverDb: ServerDatabase,
  guildId: string,
  key: ToggleableFeatureKey,
): boolean {
  const state: FeatureState = {
    settings:
      serverDb.GetGuildSettings(guildId) ?? DefaultGuildSettings(guildId),
    get xpSettings() {
      return serverDb.GetGuildXpSettings(guildId);
    },
  };
  return ReadFeatureEnabled(key, state);
}

function DefaultGuildSettings(guildId: string): GuildSettings {
  return {
    guild_id: guildId,
    ...DefaultGuildSettingValues(),
    created_at: 0,
    updated_at: 0,
  };
}
