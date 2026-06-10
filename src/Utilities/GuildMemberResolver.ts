import {
  APIInteractionGuildMember,
  ButtonInteraction,
  ChatInputCommandInteraction,
  GuildMember,
  Message,
  PartialGuildMember,
} from "discord.js";

type InteractionWithMember = ChatInputCommandInteraction | ButtonInteraction;

export async function ResolveInteractionMember(
  interaction: InteractionWithMember,
): Promise<GuildMember | null> {
  const { guild, member } = interaction;
  if (!guild || !member) {
    return null;
  }

  if (member instanceof GuildMember) {
    return member;
  }

  return guild.members.fetch(member.user.id).catch(() => null);
}

export async function ResolveMessageMember(
  message: Message,
): Promise<GuildMember | null> {
  if (!message.guild) {
    return null;
  }

  if (message.member instanceof GuildMember) {
    return message.member;
  }

  return message.guild.members.fetch(message.author.id).catch(() => null);
}

export function ResolveGuildMemberSync(
  member:
    | GuildMember
    | APIInteractionGuildMember
    | PartialGuildMember
    | null
    | undefined,
): GuildMember | null {
  if (!member) {
    return null;
  }

  return member as GuildMember;
}
