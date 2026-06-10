import type { ResponderSet } from "@responders";
import type { DatabaseSet } from "@database";
import type { Logger } from "@shared/Logger";
import type { ComponentRouter } from "@shared/ComponentRouter";
import { HandleClaimButton } from "@systems/Ticket/buttons/ClaimButton";
import { HandleAddUserButton } from "@systems/Ticket/buttons/AddUserButton";
import { HandleRemoveUserButton } from "@systems/Ticket/buttons/RemoveUserButton";
import { HandleCloseButton } from "@systems/Ticket/buttons/CloseButton";

export interface TicketRegistryContext {
  readonly responders: ResponderSet;
  readonly logger: Logger;
  readonly databases: DatabaseSet;
}

const TICKET_BUTTON_PREFIXES = {
  claim: "ticket:claim:",
  add: "ticket:add:",
  remove: "ticket:remove:",
  close: "ticket:close:",
} as const;

export function RegisterTicketButtons(context: TicketRegistryContext): void {
  const { componentRouter, buttonResponder, userSelectMenuRouter } =
    context.responders;

  RegisterTicketButtonPrefix(
    componentRouter,
    TICKET_BUTTON_PREFIXES.claim,
    async (interaction) => {
      if (!interaction.guild) {
        return;
      }

      await HandleClaimButton(interaction, {
        buttonResponder,
        ticketDb: context.databases.ticketDb,
        logger: context.logger,
        databases: context.databases,
      });
    },
  );

  RegisterTicketButtonPrefix(
    componentRouter,
    TICKET_BUTTON_PREFIXES.add,
    async (interaction) => {
      if (!interaction.guild) {
        return;
      }

      await HandleAddUserButton(interaction, {
        buttonResponder,
        userSelectMenuRouter,
        databases: context.databases,
        logger: context.logger,
        guild: interaction.guild,
      });
    },
  );

  RegisterTicketButtonPrefix(
    componentRouter,
    TICKET_BUTTON_PREFIXES.remove,
    async (interaction) => {
      if (!interaction.guild) {
        return;
      }

      await HandleRemoveUserButton(interaction, {
        buttonResponder,
        userSelectMenuRouter,
        databases: context.databases,
        logger: context.logger,
        guild: interaction.guild,
      });
    },
  );

  RegisterTicketButtonPrefix(
    componentRouter,
    TICKET_BUTTON_PREFIXES.close,
    async (interaction) => {
      if (!interaction.guild) {
        return;
      }

      await HandleCloseButton(interaction, {
        buttonResponder,
        databases: context.databases,
        logger: context.logger,
        guild: interaction.guild,
      });
    },
  );
}

function RegisterTicketButtonPrefix(
  componentRouter: ComponentRouter,
  prefix: string,
  handler: Parameters<ComponentRouter["RegisterButtonPrefix"]>[1]["handler"],
): void {
  componentRouter.RegisterButtonPrefix(prefix, { handler });
}
