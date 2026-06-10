import { vi } from "vitest";
import type { GuildMember } from "discord.js";

vi.mock("@utilities/ApiClient", () => ({
  RequestJson: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      joke: "Test joke",
      type: "single",
      articles: [],
    },
  }),
}));

vi.mock("@utilities/GuildMemberResolver", () => ({
  ResolveInteractionMember: vi.fn(
    async (interaction: { member?: GuildMember | null }) =>
      (interaction.member ?? null) as GuildMember | null,
  ),
  ResolveMessageMember: vi.fn(
    async (message: {
      member?: GuildMember | null;
      guild?: {
        members?: {
          fetch: (id: string) => Promise<GuildMember | null>;
        };
      } | null;
      author: { id: string };
    }) => {
      if (message.member) {
        return message.member;
      }

      if (message.guild?.members?.fetch) {
        return message.guild.members.fetch(message.author.id).catch(() => null);
      }

      return null;
    },
  ),
  ResolveGuildMemberSync: vi.fn(
    (member: GuildMember | null | undefined) =>
      (member ?? null) as GuildMember | null,
  ),
}));
