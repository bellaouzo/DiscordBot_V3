import type { APIEmbed, Guild, TextChannel } from "discord.js";
import { EmbedFactory } from "@utilities";
import type { GuildServerRules } from "./FetchGuildServerRules";

export const RULES_PANEL_FOOTER_MARKER = "Synced from Discord Server Rules";
export const RULES_EMBED_COLOR = 0x5865f2;

const DESCRIPTION_LIMIT = 3900;

function BuildRuleLines(rules: readonly string[]): string[] {
  return rules.map((rule, index) => `**${index + 1}.** ${rule.trim()}`);
}

function ChunkRuleLines(lines: readonly string[]): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    const next = current.length === 0 ? line : `${current}\n\n${line}`;
    if (next.length > DESCRIPTION_LIMIT) {
      if (current.length > 0) {
        chunks.push(current);
      }
      if (line.length > DESCRIPTION_LIMIT) {
        chunks.push(line.slice(0, DESCRIPTION_LIMIT));
        current = "";
      } else {
        current = line;
      }
    } else {
      current = next;
    }
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

function AddRulesMetaFields(
  embed: ReturnType<typeof EmbedFactory.Create>,
): void {
  embed.addFields(
    {
      name: "How we moderate",
      value:
        "Staff may warn, mute, kick, or ban for rule breaks. Severity depends on the situation — when in doubt, ask a moderator.",
      inline: false,
    },
    {
      name: "Need help?",
      value:
        "Open a support ticket or reach out to staff if something is unclear. Appeals are available when moderation actions feel unfair.",
      inline: false,
    },
  );
}

export function BuildRulesPanelEmbeds(
  guild: Guild,
  serverRules: GuildServerRules,
): APIEmbed[] {
  const intro =
    serverRules.description ??
    `Welcome to **${guild.name}**. These rules keep our community safe, respectful, and fun for everyone.`;

  const ruleChunks = ChunkRuleLines(BuildRuleLines(serverRules.rules));
  const heroDescription = [
    intro,
    "",
    "Please read everything below before chatting. By staying in this server, you agree to follow these rules.",
  ].join("\n");

  if (ruleChunks.length === 1) {
    const combined = `${heroDescription}\n\n**Community Rules**\n\n${ruleChunks[0]}`;
    if (combined.length <= DESCRIPTION_LIMIT) {
      const single = EmbedFactory.Create({
        title: `Server Rules · ${guild.name}`,
        description: combined,
        color: RULES_EMBED_COLOR,
        thumbnail: guild.iconURL({ size: 256 }) ?? undefined,
      });
      AddRulesMetaFields(single);
      single.setFooter({
        text: `${RULES_PANEL_FOOTER_MARKER} · ${serverRules.rules.length} rule(s)`,
      });
      return [single.toJSON()];
    }
  }

  const embeds: APIEmbed[] = [];
  const hero = EmbedFactory.Create({
    title: `Server Rules · ${guild.name}`,
    description: heroDescription,
    color: RULES_EMBED_COLOR,
    thumbnail: guild.iconURL({ size: 256 }) ?? undefined,
  });
  AddRulesMetaFields(hero);
  hero.setFooter({
    text: `${RULES_PANEL_FOOTER_MARKER} · ${serverRules.rules.length} rule(s)`,
  });
  embeds.push(hero.toJSON());

  ruleChunks.forEach((chunk, index) => {
    const page = EmbedFactory.Create({
      title:
        ruleChunks.length === 1
          ? "Community Rules"
          : `Community Rules (${index + 1}/${ruleChunks.length})`,
      description: chunk,
      color: RULES_EMBED_COLOR,
      timestamp: false,
    });
    page.setFooter({
      text: `${RULES_PANEL_FOOTER_MARKER} · Part ${index + 1} of ${ruleChunks.length}`,
    });
    embeds.push(page.toJSON());
  });

  return embeds;
}

export async function PostRulesPanelToChannel(options: {
  channel: TextChannel;
  guild: Guild;
  serverRules: GuildServerRules;
}): Promise<void> {
  const embeds = BuildRulesPanelEmbeds(options.guild, options.serverRules);

  for (let index = 0; index < embeds.length; index += 10) {
    await options.channel.send({
      embeds: embeds.slice(index, index + 10),
    });
  }
}
