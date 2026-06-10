import type {
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  User,
} from "discord.js";
import { Events } from "discord.js";
import type { EventContext } from "@events/EventFactory";
import { CreateEvent } from "@events/EventFactory";
import { StarboardManager } from "@systems/Starboard/StarboardManager";
import { ReactionRoleManager } from "@systems/ReactionRole/ReactionRoleManager";

async function ExecuteMessageReactionRemoveEvent(
  context: EventContext,
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
): Promise<void> {
  const starboardManager = new StarboardManager(
    context.client,
    context.databases.serverDb,
    context.logger,
  );
  const reactionRoleManager = new ReactionRoleManager(
    context.databases.serverDb,
    context.logger,
  );

  try {
    await starboardManager.HandleReactionRemove(reaction);
  } catch (error) {
    context.logger.Error("Starboard reaction remove handler failed", { error });
  }

  try {
    await reactionRoleManager.HandleReactionRemove(reaction, user);
  } catch (error) {
    context.logger.Error("Reaction role remove handler failed", { error });
  }
}

export const MessageReactionRemoveEvent = CreateEvent({
  name: Events.MessageReactionRemove,
  once: false,
  execute: ExecuteMessageReactionRemoveEvent,
});
