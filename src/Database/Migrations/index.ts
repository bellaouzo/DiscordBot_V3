export type { Migration, MigrationRecord } from "./types";
export {
  RunMigrations,
  HasTableColumn,
  AddTableColumnIfMissing,
  AddTableColumnsIfMissing,
} from "./MigrationRunner";
