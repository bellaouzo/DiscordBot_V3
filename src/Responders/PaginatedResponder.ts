import { ChatInputCommandInteraction } from 'discord.js'
import { Logger } from '../Logging/Logger'
import { ReplyResponder } from './ReplyResponder'
import { EditResponder } from './EditResponder'
import { ComponentRouter } from '../Interactions/ComponentRouter'
import { CreatePaginator, PaginationPage } from '../Pagination'

export interface PaginatedMessageOptions {
  readonly interaction: ChatInputCommandInteraction
  readonly pages: PaginationPage[]
  readonly ephemeral?: boolean
  readonly ownerId?: string
  readonly timeoutMs?: number
  readonly idleTimeoutMs?: number
}

export class PaginatedResponder {
  private activePaginators = new Map<string, ReturnType<typeof CreatePaginator>>()

  constructor(
    private readonly replyResponder: ReplyResponder,
    private readonly editResponder: EditResponder,
    private readonly componentRouter: ComponentRouter,
    private readonly logger: Logger
  ) {}

  async Send(options: PaginatedMessageOptions): Promise<void> {
    const key = options.interaction.id

    this.DisposePaginator(key)

    const pages = options.pages.map(page => this.NormalizePage(page))

    const paginator = CreatePaginator({
      interaction: options.interaction,
      pages,
      replyResponder: this.replyResponder,
      editResponder: this.editResponder,
      componentRouter: this.componentRouter,
      logger: this.logger,
      ephemeral: options.ephemeral,
      ownerId: options.ownerId,
      timeoutMs: options.timeoutMs,
      idleTimeoutMs: options.idleTimeoutMs
    })

    this.activePaginators.set(key, paginator)

    try {
      await paginator.Start()
    } catch (error) {
      this.logger.Error('Failed to start paginator', { error })
      this.DisposePaginator(key)
    }
  }

  Cancel(interaction: ChatInputCommandInteraction): void {
    this.DisposePaginator(interaction.id)
  }

  private NormalizePage(page: PaginationPage): PaginationPage {
    const components = page.components ?? []

    const enrichedComponents = components.map(row => ({
      ...row,
      components: row.components.map(component => ({
        ...component
      }))
    }))

    const footerEmbed = page.embeds?.map(embed => ({
      ...embed,
      footer: {
        text: embed.footer?.text ?? '',
        icon_url: embed.footer?.icon_url
      }
    }))

    return {
      content: page.content,
      components: enrichedComponents,
      embeds: footerEmbed
    }
  }

  private DisposePaginator(key: string): void {
    const existing = this.activePaginators.get(key)
    if (!existing) {
      return
    }

    existing.Dispose()
    this.activePaginators.delete(key)
  }
}


