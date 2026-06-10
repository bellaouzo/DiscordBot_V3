import { EmbedFactory } from "@utilities/EmbedFactory";

export type FeatureGuide = {
  readonly key: string;
  readonly name: string;
  readonly icon: string;
  readonly summary: string;
  readonly howItWorks: string;
  readonly setup: string;
  readonly command: string;
};

export const FEATURE_GUIDES: readonly FeatureGuide[] = [
  {
    key: "starboard",
    name: "Starboard",
    icon: "⭐",
    summary:
      "Automatically highlights popular messages in a dedicated channel.",
    howItWorks:
      "When a message collects enough reactions with your chosen emoji (default ⭐), the bot reposts it to the starboard channel. If reactions later drop below the threshold, the starboard post is removed.",
    setup:
      "`/starboard set-channel` → `/starboard set-emoji` → `/starboard set-threshold`",
    command: "/starboard",
  },
  {
    key: "reactionrole",
    name: "Reaction Roles",
    icon: "🎭",
    summary:
      "Lets members self-assign roles by reacting to a panel message.",
    howItWorks:
      "Staff post a reaction role panel. Each emoji on that message maps to a role. Members react to get the role and can remove their reaction to remove the role.",
    setup:
      "`/reactionrole panel` → `/reactionrole add emoji:🎮 role:@Role`",
    command: "/reactionrole",
  },
  {
    key: "xpconfig",
    name: "Chat XP",
    icon: "📈",
    summary: "Rewards active members with XP and levels for chatting.",
    howItWorks:
      "Members earn XP from messages (with cooldowns, length checks, and daily caps). Level-ups can be announced in a configured channel. Some channels can be excluded.",
    setup: "`/xpconfig enable` → `/xpconfig set` → `/xpconfig view`",
    command: "/xpconfig",
  },
  {
    key: "autorole",
    name: "Autorole",
    icon: "👋",
    summary: "Automatically gives new members a role when they join.",
    howItWorks:
      "When someone joins the server, the bot assigns the configured role right away. Useful for default member access or verification flows.",
    setup: "`/autorole set role:@Member`",
    command: "/autorole",
  },
  {
    key: "giveaway",
    name: "Giveaways",
    icon: "🎁",
    summary: "Run timed giveaways where members enter by reacting.",
    howItWorks:
      "Staff create a giveaway with a prize and duration. Members react to enter. When time is up, winners are picked from entrants.",
    setup: "`/giveaway create`",
    command: "/giveaway",
  },
  {
    key: "event",
    name: "Scheduled Events",
    icon: "📅",
    summary: "Schedule server events with optional announcement reminders.",
    howItWorks:
      "Staff create events with a date and time. The bot can announce them in a channel when they are due, so members know what is coming up.",
    setup: "`/event create` → set announcement channel in event settings",
    command: "/event",
  },
  {
    key: "ticket",
    name: "Support Tickets",
    icon: "🎫",
    summary: "Private channels where members can get help from staff.",
    howItWorks:
      "Members open a ticket via command or panel button. The bot creates a private channel for that conversation. Staff can list, tag, transcript, and close tickets. Categories are configurable.",
    setup: "`/setup` or `/ticket panel` → `/ticket config`",
    command: "/ticket",
  },
  {
    key: "poll",
    name: "Polls",
    icon: "📊",
    summary: "Timed community votes with multiple choices.",
    howItWorks:
      "Staff create a poll with a question, choices, and duration. Members vote on the poll message. Polls can be listed in a channel and ended early if needed.",
    setup: "`/poll create question:... choice_1:... choice_2:...`",
    command: "/poll",
  },
  {
    key: "appeal",
    name: "Moderation Appeals",
    icon: "⚖️",
    summary: "Lets members appeal warnings, mutes, bans, or kicks.",
    howItWorks:
      "Members run a guided appeal flow explaining their case. Staff review appeals in a configured channel and approve or deny them. Members can track status with `/appeal my`.",
    setup: "Configure in `/setup` → members use `/appeal submit`",
    command: "/appeal",
  },
  {
    key: "economy",
    name: "Economy",
    icon: "💰",
    summary: "Server coin system with games, market, duels, and lotteries.",
    howItWorks:
      "Members earn coins from dailies and mini-games, then spend them in the market or gift others. Staff can create server lotteries. Members can challenge each other to coin duels.",
    setup:
      "`/economy daily` → `/economy market view` → `/economy lottery create` (staff)",
    command: "/economy",
  },
  {
    key: "linkfilter",
    name: "Link Filter",
    icon: "🔗",
    summary: "Automatically allows or blocks links by URL pattern.",
    howItWorks:
      "Add substring patterns to allow or block lists. Allow rules take priority over block rules. Messages containing blocked links are removed automatically.",
    setup:
      "`/linkfilter block pattern:bad-site.com` or `/linkfilter allow pattern:trusted.com`",
    command: "/linkfilter",
  },
  {
    key: "raidmode",
    name: "Raid Mode",
    icon: "🛡️",
    summary: "Emergency lockdown during join raids or spam waves.",
    howItWorks:
      "Applies server-wide lockdown and slowmode for a set duration. Expires automatically when time is up and can be disabled early with `/raidmode off`.",
    setup: "`/raidmode on length:10 unit:minutes`",
    command: "/raidmode",
  },
  {
    key: "setup",
    name: "Server Setup",
    icon: "⚙️",
    summary: "Interactive wizard for core channels, roles, and logging.",
    howItWorks:
      "Walks staff through ticket, appeal, welcome, and logging configuration in one place. Best starting point when first adding the bot to a server.",
    setup: "Run `/setup` and follow the on-screen steps",
    command: "/setup",
  },
] as const;

export function GetFeatureGuide(key: string): FeatureGuide | null {
  return FEATURE_GUIDES.find((guide) => guide.key === key) ?? null;
}

export function BuildFeatureGuideEmbed(guide: FeatureGuide) {
  const embed = EmbedFactory.Create({
    title: `${guide.icon} ${guide.name}`,
    description: guide.summary,
    color: 0x5865f2,
  });

  embed.addFields(
    {
      name: "How it works",
      value: guide.howItWorks,
      inline: false,
    },
    {
      name: "Quick setup",
      value: guide.setup,
      inline: false,
    },
  );

  embed.setFooter({
    text: `Configure with ${guide.command}`,
  });

  return embed;
}

export function AppendFeatureGuideHint(
  embed: ReturnType<typeof EmbedFactory.Create>,
  featureKey: string,
): void {
  const guide = GetFeatureGuide(featureKey);
  if (!guide) {
    return;
  }

  embed.addFields({
    name: "What is this?",
    value: `${guide.summary}\nRun \`${guide.command} about\` for full details.`,
    inline: false,
  });
}
