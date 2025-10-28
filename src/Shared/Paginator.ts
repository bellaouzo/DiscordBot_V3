import {
  APIEmbed,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
} from "discord.js";
import { ComponentRouter, RegisteredButton } from "./ComponentRouter";
import { Logger } from "./Logger";
import { InteractionResponder } from "../Responders/InteractionResponder";
import { ResponderMessageOptions } from "../Responders";

export interface PaginationPage {
  readonly embeds?: APIEmbed[];
  readonly content?: string;
  readonly components?: ResponderMessageOptions["components"];
}

export interface PaginationOptions {
  readonly interaction: ChatInputCommandInteraction;
  readonly pages: PaginationPage[];
  readonly interactionResponder: InteractionResponder;
  readonly componentRouter: ComponentRouter;
  readonly logger: Logger;
  readonly ephemeral?: boolean;
  readonly flags?: MessageFlags[];
  readonly ownerId?: string;
  readonly timeoutMs?: number;
  readonly idleTimeoutMs?: number;
}

export class Paginator {
  private currentIndex = 0;
  private readonly buttons: RegisteredButton[] = [];
  private active = true;
  private readonly ownerId?: string;
  private readonly timeout?: NodeJS.Timeout;
  private lastInteractionAt = Date.now();

  constructor(private readonly options: PaginationOptions) {
    this.ownerId = options.ownerId ?? options.interaction.user.id;
    const timeoutMs = options.timeoutMs ?? 1000 * 60 * 5;
    this.timeout = setTimeout(() => this.Expire(), timeoutMs).unref();
  }

  async Start(): Promise<void> {
    if (this.options.pages.length === 0) {
      await this.options.interactionResponder.Reply(this.options.interaction, {
        content: "No content available",
        ephemeral: this.options.ephemeral,
        flags: this.options.flags,
      });
      return;
    }

    await this.RegisterButtons();
    await this.SendPage(0);
  }

  private async RegisterButtons(): Promise<void> {
    const { componentRouter } = this.options;

    this.buttons.push(
      componentRouter.RegisterButton({
        customId: this.CreateCustomId("first"),
        ownerId: this.ownerId,
        handler: (interaction: ButtonInteraction) => this.GoTo(0, interaction),
      }),
      componentRouter.RegisterButton({
        customId: this.CreateCustomId("prev"),
        ownerId: this.ownerId,
        handler: (interaction: ButtonInteraction) =>
          this.GoTo(this.currentIndex - 1, interaction),
      }),
      componentRouter.RegisterButton({
        customId: this.CreateCustomId("next"),
        ownerId: this.ownerId,
        handler: (interaction: ButtonInteraction) =>
          this.GoTo(this.currentIndex + 1, interaction),
      }),
      componentRouter.RegisterButton({
        customId: this.CreateCustomId("stop"),
        ownerId: this.ownerId,
        handler: (interaction: ButtonInteraction) => this.Stop(interaction),
        singleUse: true,
      })
    );
  }

  private async SendPage(index: number, update = false): Promise<void> {
    this.currentIndex = this.NormalizeIndex(index);
    const page = this.options.pages[this.currentIndex];

    const components = this.BuildComponents();

    const payload: ResponderMessageOptions = {
      content: page.content,
      embeds: page.embeds,
      components,
      ephemeral: this.options.ephemeral,
      flags: this.options.flags,
    };

    if (update) {
      await this.options.interactionResponder.Edit(
        this.options.interaction,
        payload
      );
    } else {
      await this.options.interactionResponder.Reply(
        this.options.interaction,
        payload
      );
    }
  }

  private BuildComponents(): ResponderMessageOptions["components"] {
    const total = this.options.pages.length;
    const isFirst = this.currentIndex === 0;
    const isLast = this.currentIndex === total - 1;

    return [
      {
        type: ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.Button,
            customId: this.buttons[0].customId,
            style: ButtonStyle.Secondary,
            label: "⏮",
            disabled: isFirst,
          },
          {
            type: ComponentType.Button,
            customId: this.buttons[1].customId,
            style: ButtonStyle.Secondary,
            label: "◀",
            disabled: isFirst,
          },
          {
            type: ComponentType.Button,
            customId: this.CreateCustomId("current"),
            style: ButtonStyle.Secondary,
            label: `${this.currentIndex + 1}/${total}`,
            disabled: true,
          },
          {
            type: ComponentType.Button,
            customId: this.buttons[2].customId,
            style: ButtonStyle.Secondary,
            label: "▶",
            disabled: isLast,
          },
          {
            type: ComponentType.Button,
            customId: this.buttons[3].customId,
            style: ButtonStyle.Danger,
            label: "⏹",
          },
        ],
      },
    ];
  }

  private async GoTo(
    index: number,
    interaction: ButtonInteraction
  ): Promise<void> {
    if (!this.active) {
      await interaction.deferUpdate();
      return;
    }

    this.lastInteractionAt = Date.now();
    await interaction.deferUpdate();
    await this.SendPage(index, true);
  }

  private async Stop(interaction: ButtonInteraction): Promise<void> {
    this.active = false;
    await interaction.deferUpdate();
    await this.options.interactionResponder.Edit(this.options.interaction, {
      embeds: this.options.pages[this.currentIndex].embeds,
      content: this.options.pages[this.currentIndex].content,
      components: [],
    });

    this.Dispose();
  }

  private NormalizeIndex(index: number): number {
    if (index < 0) {
      return 0;
    }

    if (index >= this.options.pages.length) {
      return this.options.pages.length - 1;
    }

    return index;
  }

  private CreateCustomId(suffix: string): string {
    return `page:${this.options.interaction.id}:${suffix}`;
  }

  private Expire(): void {
    if (!this.active) {
      return;
    }

    const idleTimeout = this.options.idleTimeoutMs ?? 1000 * 60 * 2;
    if (Date.now() - this.lastInteractionAt < idleTimeout) {
      this.timeout?.refresh();
      return;
    }

    this.active = false;
    void this.options.interactionResponder.Edit(this.options.interaction, {
      embeds: this.options.pages[this.currentIndex].embeds,
      content: this.options.pages[this.currentIndex].content,
      components: [],
    });

    this.Dispose();
  }

  Dispose(): void {
    this.timeout?.unref();
    for (const button of this.buttons) {
      button.dispose();
    }
    this.buttons.length = 0;
  }
}

export function CreatePaginator(options: PaginationOptions): Paginator {
  return new Paginator(options);
}
