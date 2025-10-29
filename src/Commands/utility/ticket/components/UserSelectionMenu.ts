import { UserSelectMenuInteraction } from "discord.js";
import { Ticket } from "../../../../Database";
import { Logger } from "../../../../Shared/Logger";
import { CreateTicketManager } from "../../../../Utilities";

export async function HandleUserSelection(
  userSelectInteraction: UserSelectMenuInteraction,
  ticket: Ticket,
  ticketManager: ReturnType<typeof CreateTicketManager>,
  logger: Logger
): Promise<void> {
  await userSelectInteraction.deferReply({ ephemeral: true });

  const selectedUsers = userSelectInteraction.users;
  const addedUsers: string[] = [];
  const failedUsers: string[] = [];

  for (const user of selectedUsers.values()) {
    const success = await ticketManager.AddUserToTicket(
      ticket.id,
      user.id,
      userSelectInteraction.user.id
    );

    if (success) {
      addedUsers.push(`<@${user.id}>`);
    } else {
      failedUsers.push(`<@${user.id}>`);
    }
  }

  let message = "";
  if (addedUsers.length > 0) {
    message += `✅ Successfully added: ${addedUsers.join(", ")}\n`;
  }
  if (failedUsers.length > 0) {
    message += `❌ Failed to add: ${failedUsers.join(", ")}\n`;
  }

  await userSelectInteraction.editReply({
    content: message || "No users were added.",
  });

  logger.Info("Users added to ticket", {
    extra: {
      ticketId: ticket.id,
      addedBy: userSelectInteraction.user.id,
      addedUsers: addedUsers.length,
      failedUsers: failedUsers.length,
    },
  });
}

export async function HandleUserRemoval(
  userSelectInteraction: UserSelectMenuInteraction,
  ticket: Ticket,
  ticketManager: ReturnType<typeof CreateTicketManager>,
  logger: Logger
): Promise<void> {
  await userSelectInteraction.deferReply({ ephemeral: true });

  const selectedUsers = userSelectInteraction.users;
  const removedUsers: string[] = [];
  const failedUsers: string[] = [];

  for (const user of selectedUsers.values()) {
    // Prevent removing the ticket owner
    if (user.id === ticket.user_id) {
      failedUsers.push(`<@${user.id}> (ticket owner)`);
      continue;
    }

    const success = await ticketManager.RemoveUserFromTicket(
      ticket.id,
      user.id,
      userSelectInteraction.user.id
    );

    if (success) {
      removedUsers.push(`<@${user.id}>`);
    } else {
      failedUsers.push(`<@${user.id}>`);
    }
  }

  let message = "";
  if (removedUsers.length > 0) {
    message += `✅ Successfully removed: ${removedUsers.join(", ")}\n`;
  }
  if (failedUsers.length > 0) {
    message += `❌ Failed to remove: ${failedUsers.join(", ")}\n`;
  }

  await userSelectInteraction.editReply({
    content: message || "No users were removed.",
  });

  logger.Info("Users removed from ticket", {
    extra: {
      ticketId: ticket.id,
      removedBy: userSelectInteraction.user.id,
      removedUsers: removedUsers.length,
      failedUsers: failedUsers.length,
    },
  });
}
