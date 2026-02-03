import { ChatInputCommandInteraction, ChannelType, Role } from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import { Config } from "@middleware";
import { EmbedFactory, CreateChannelManager } from "@utilities";

type MentionType = "none" | "everyone" | "here" | "role";
type AnnouncementKind = "info" | "update" | "maintenance" | "event";

function BuildMention(type: MentionType, role: Role | null): string {
  if (type === "everyone") return "@everyone";
  if (type === "here") return "@here";
  if (type === "role" && role) return role.toString();
  return "";
}

function BuildEmbed(
  kind: AnnouncementKind,
  title: string | null,
  message: string
) {
  const colorByKind: Record<AnnouncementKind, number> = {
    info: 0x5865f2,
    update: 0x57f287,
    maintenance: 0xed4245,
    event: 0xfee75c,
  };
  const iconByKind: Record<AnnouncementKind, string> = {
    info: "ℹ️",
    update: "🆕",
    maintenance: "🛠️",
    event: "🎉",
  };

  const header =
    title && title.trim().length > 0 ? title.trim() : "Announcement";
  const displayTitle = `${iconByKind[kind]} ${header}`;

  const embed = EmbedFactory.Create({
    title: displayTitle,
    description: message,
    color: colorByKind[kind],
  });
  embed.setFooter({ text: `Type: ${kind}` });
  return embed;
}

async function ExecuteAnnouncement(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  const { logger, databases } = context;

  const settings = databases.serverDb.GetGuildSettings(interaction.guild!.id);
  const announcementChannelId = settings?.announcement_channel_id ?? null;

  const title = interaction.options.getString("title");
  const message = interaction.options.getString("message", true);
  const mentionType = (interaction.options.getString("mention") ??
    "none") as MentionType;
  const kind = (interaction.options.getString("type") ??
    "info") as AnnouncementKind;
  const role = interaction.options.getRole("role") as Role | null;

  if (mentionType === "role" && !role) {
    await interactionResponder.Reply(interaction, {
      embeds: [
        EmbedFactory.CreateError({
          title: "Role Required",
          description:
            "Select a role to mention, or choose another mention type.",
        }).toJSON(),
      ],
      ephemeral: true,
    });
    return;
  }

  const guild = interaction.guild!;
  const channelManager = CreateChannelManager({
    guild,
    logger,
  });

  let targetChannel =
    announcementChannelId &&
    (await guild.channels.fetch(announcementChannelId));

  if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
    targetChannel = await channelManager.GetOrCreateTextChannel(
      announcementChannelId ? `announcements` : "announcements"
    );
  }

  if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
    await interactionResponder.Reply(interaction, {
      embeds: [
        EmbedFactory.CreateError({
          title: "Channel Unavailable",
          description:
            "Could not find or create an announcements channel. Please rerun `/setup`.",
        }).toJSON(),
      ],
      ephemeral: true,
    });
    return;
  }

  const mention = BuildMention(mentionType, role);
  const embed = BuildEmbed(kind, title, message);

  await interactionResponder.Defer(interaction, true);

  await targetChannel.send({
    content: mention || undefined,
    embeds: [embed.toJSON()],
    allowedMentions: {
      parse: ["everyone", "roles"],
      roles: role ? [role.id] : [],
    },
  });

  await interactionResponder.Edit(interaction, {
    embeds: [
      EmbedFactory.CreateSuccess({
        title: "Announcement Sent",
        description: `Posted to ${targetChannel}.`,
      }).toJSON(),
    ],
  });
}

export const AnnouncementCommand = CreateCommand({
  name: "announce",
  description: "Send an announcement to your configured announcements channel",
  group: "utility",
  configure: (builder) => {
    builder
      .addStringOption((opt) =>
        opt
          .setName("message")
          .setDescription("Announcement message")
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("title").setDescription("Optional title").setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("mention")
          .setDescription("Who to mention")
          .addChoices(
            { name: "None", value: "none" },
            { name: "@everyone", value: "everyone" },
            { name: "@here", value: "here" },
            { name: "Specific role", value: "role" }
          )
          .setRequired(false)
      )
      .addRoleOption((opt) =>
        opt
          .setName("role")
          .setDescription("Role to mention (if mention=role)")
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("type")
          .setDescription("Announcement type")
          .addChoices(
            { name: "Info", value: "info" },
            { name: "Update", value: "update" },
            { name: "Maintenance", value: "maintenance" },
            { name: "Event", value: "event" }
          )
          .setRequired(false)
      );
  },
  config: Config.create()
    .guildOnly()
    .anyPermission("ManageGuild", "Administrator")
    .build(),
  execute: ExecuteAnnouncement,
});
