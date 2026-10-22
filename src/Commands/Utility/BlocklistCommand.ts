import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags, PermissionFlagsBits } from "discord.js";
import type { CommandContext } from "@commands";
import { CreateCommand } from "@commands";
import { IsBotOwner } from "@config/AppConfig";
import type { BlocklistEntry, BlocklistTargetType } from "@database";
import { EmbedFactory } from "@utilities";
import type { PaginationPage } from "@shared/Paginator";

const LIST_PAGE_SIZE = 10;
const SNOWFLAKE_PATTERN = /^\d{17,20}$/;

async function Reply(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  embed: ReturnType<typeof EmbedFactory.Create>,
): Promise<void> {
  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

function FormatTarget(type: BlocklistTargetType, id: string): string {
  return type === "user" ? `<@${id}> (\`${id}\`)` : `server \`${id}\``;
}

function ResolveTargetId(
  interaction: ChatInputCommandInteraction,
  type: BlocklistTargetType,
): string | null {
  if (type === "user") {
    return interaction.options.getUser("user", true).id;
  }
  const id = interaction.options.getString("guild_id", true).trim();
  return SNOWFLAKE_PATTERN.test(id) ? id : null;
}

async function HandleAdd(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  type: BlocklistTargetType,
): Promise<void> {
  const targetId = ResolveTargetId(interaction, type);
  if (!targetId) {
    await Reply(
      interaction,
      context,
      EmbedFactory.CreateError({
        title: "Invalid Server ID",
        description: "Server IDs are 17–20 digit numbers.",
      }),
    );
    return;
  }

  if (type === "user" && IsBotOwner(targetId, context.appConfig)) {
    await Reply(
      interaction,
      context,
      EmbedFactory.CreateError({
        title: "Cannot Block Owner",
        description: "Bot owners can't be blocklisted.",
      }),
    );
    return;
  }

  const reason = interaction.options.getString("reason")?.trim() || null;
  context.databases.serverDb.AddToBlocklist({
    target_type: type,
    target_id: targetId,
    reason,
    created_by: interaction.user.id,
  });

  context.logger.Info("Blocklist entry added", {
    extra: { targetType: type, targetId, reason },
  });

  await Reply(
    interaction,
    context,
    EmbedFactory.CreateSuccess({
      title: "Blocklisted",
      description: `${FormatTarget(type, targetId)} can no longer use the bot.${
        reason ? `\n**Reason:** ${reason}` : ""
      }`,
    }),
  );
}

async function HandleRemove(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  type: BlocklistTargetType,
): Promise<void> {
  const targetId = ResolveTargetId(interaction, type);
  const removed = targetId
    ? context.databases.serverDb.RemoveFromBlocklist(type, targetId)
    : false;

  if (!targetId || !removed) {
    await Reply(
      interaction,
      context,
      EmbedFactory.CreateWarning({
        title: "Not Blocklisted",
        description: "That target is not on the blocklist.",
      }),
    );
    return;
  }

  context.logger.Info("Blocklist entry removed", {
    extra: { targetType: type, targetId },
  });

  await Reply(
    interaction,
    context,
    EmbedFactory.CreateSuccess({
      title: "Removed From Blocklist",
      description: `${FormatTarget(type, targetId)} can use the bot again.`,
    }),
  );
}

function FormatEntry(entry: BlocklistEntry): string {
  const reason = entry.reason ? ` — ${entry.reason}` : "";
  return `${FormatTarget(entry.target_type, entry.target_id)} · <t:${Math.floor(
    entry.created_at / 1000,
  )}:R>${reason}`;
}

function BuildListPages(entries: BlocklistEntry[]): PaginationPage[] {
  if (entries.length === 0) {
    return [
      {
        embeds: [
          EmbedFactory.Create({
            title: "Blocklist",
            description: "The blocklist is empty.",
          }).toJSON(),
        ],
      },
    ];
  }

  const totalPages = Math.ceil(entries.length / LIST_PAGE_SIZE);
  const pages: PaginationPage[] = [];
  for (let i = 0; i < entries.length; i += LIST_PAGE_SIZE) {
    const embed = EmbedFactory.Create({
      title: `Blocklist (${entries.length})`,
      description: entries
        .slice(i, i + LIST_PAGE_SIZE)
        .map(FormatEntry)
        .join("\n"),
      footer: `Page ${i / LIST_PAGE_SIZE + 1} of ${totalPages}`,
    });
    pages.push({ embeds: [embed.toJSON()] });
  }
  return pages;
}

async function HandleList(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const entries = context.databases.serverDb.ListBlocklist();
  await context.responders.paginatedResponder.Send({
    interaction,
    pages: BuildListPages(entries),
    flags: MessageFlags.Ephemeral,
    ownerId: interaction.user.id,
    timeoutMs: 1000 * 60 * 3,
    idleTimeoutMs: 1000 * 60 * 2,
  });
}

export const BlocklistCommand = CreateCommand({
  name: "blocklist",
  description: "Block users or servers from using the bot (bot owners only)",
  group: "admin",
  config: { access: "botOwner", dms: true, cooldown: "2s" },
  configure: (builder) => {
    // Hidden from non-admins in servers; the bot-owner check is what actually gates it.
    builder.setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
  },
  subcommands: [
    {
      name: "user",
      description: "Block or unblock a user",
      subcommands: [
        {
          name: "add",
          description: "Block a user from using the bot",
          options: (sub) =>
            sub
              .addUserOption((option) =>
                option
                  .setName("user")
                  .setDescription("User to block")
                  .setRequired(true),
              )
              .addStringOption((option) =>
                option
                  .setName("reason")
                  .setDescription("Why they are blocked")
                  .setMaxLength(200),
              ),
          execute: (interaction, context) =>
            HandleAdd(interaction, context, "user"),
        },
        {
          name: "remove",
          description: "Unblock a user",
          options: (sub) =>
            sub.addUserOption((option) =>
              option
                .setName("user")
                .setDescription("User to unblock")
                .setRequired(true),
            ),
          execute: (interaction, context) =>
            HandleRemove(interaction, context, "user"),
        },
      ],
    },
    {
      name: "server",
      description: "Block or unblock a server",
      subcommands: [
        {
          name: "add",
          description: "Stop the bot from responding in a server",
          options: (sub) =>
            sub
              .addStringOption((option) =>
                option
                  .setName("guild_id")
                  .setDescription("Server ID")
                  .setRequired(true),
              )
              .addStringOption((option) =>
                option
                  .setName("reason")
                  .setDescription("Why the server is blocked")
                  .setMaxLength(200),
              ),
          execute: (interaction, context) =>
            HandleAdd(interaction, context, "guild"),
        },
        {
          name: "remove",
          description: "Unblock a server",
          options: (sub) =>
            sub.addStringOption((option) =>
              option
                .setName("guild_id")
                .setDescription("Server ID")
                .setRequired(true),
            ),
          execute: (interaction, context) =>
            HandleRemove(interaction, context, "guild"),
        },
      ],
    },
    {
      name: "list",
      description: "Show every blocked user and server",
      execute: HandleList,
    },
  ],
});
