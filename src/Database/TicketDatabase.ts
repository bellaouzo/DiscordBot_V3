import Database from "better-sqlite3";
import { join } from "path";
import { ResolveDataDir } from "@config/DataConfig";
import type { Logger } from "@shared/Logger";
import { TicketStore } from "@database/Ticket/Stores/TicketStore";
import { TicketMessageStore } from "@database/Ticket/Stores/TicketMessageStore";
import { TicketTagStore } from "@database/Ticket/Stores/TicketTagStore";
import { TicketParticipantStore } from "@database/Ticket/Stores/TicketParticipantStore";
import { TicketReopenAuditStore } from "@database/Ticket/Stores/TicketReopenAuditStore";
import { TicketCategoryConfigStore } from "@database/Ticket/Stores/TicketCategoryConfigStore";
import { RunMigrations } from "@database/Migrations";
import type { StoreMethods } from "@database/StoreDelegation";
import { DelegateStoreMethods } from "@database/StoreDelegation";
import { TicketMigrations } from "@database/Migrations/ticket";

export type {
  Ticket,
  TicketCategory,
  TicketCategoryConfig,
  TicketMessage,
  TicketParticipant,
  TicketReopenAudit,
  TicketStatus,
  TicketTag,
} from "@database/Ticket/Types";

export { TICKET_CATEGORIES } from "@database/Ticket/Types";

// Store methods are exposed on the facade by DelegateStoreMethods; this merge gives them types.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface TicketDatabase
  extends
    StoreMethods<TicketStore>,
    StoreMethods<TicketMessageStore>,
    StoreMethods<TicketTagStore>,
    StoreMethods<TicketParticipantStore>,
    StoreMethods<TicketReopenAuditStore>,
    StoreMethods<TicketCategoryConfigStore> {}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class TicketDatabase {
  private readonly db: Database.Database;
  private readonly tickets: TicketStore;
  private readonly messages: TicketMessageStore;
  private readonly tags: TicketTagStore;
  private readonly participants: TicketParticipantStore;
  private readonly reopenAudits: TicketReopenAuditStore;
  private readonly categoryConfigs: TicketCategoryConfigStore;

  constructor(private readonly logger: Logger) {
    this.db = this.InitializeDatabase();
    this.CreateTables();
    this.tickets = new TicketStore(this.db);
    this.messages = new TicketMessageStore(this.db);
    this.tags = new TicketTagStore(this.db);
    this.participants = new TicketParticipantStore(this.db);
    this.reopenAudits = new TicketReopenAuditStore(this.db);
    this.categoryConfigs = new TicketCategoryConfigStore(this.db);
    DelegateStoreMethods(this, [
      this.tickets,
      this.messages,
      this.tags,
      this.participants,
      this.reopenAudits,
      this.categoryConfigs,
    ]);
  }

  private InitializeDatabase(): Database.Database {
    const dataDir = ResolveDataDir();
    const dbPath = join(dataDir, "tickets.db");

    try {
      return new Database(dbPath);
    } catch (error) {
      this.logger.Error("Failed to initialize database", { error });
      throw error;
    }
  }

  private CreateTables(): void {
    RunMigrations(this.db, TicketMigrations, this.logger);
  }

  Ping(): boolean {
    const row = this.db.prepare("SELECT 1 AS ok").get() as
      | { ok: number }
      | undefined;
    return row?.ok === 1;
  }

  Close(): void {
    this.db.close();
  }
}
