import type { CommandDefinition } from "./CommandFactory";
import type { ContextMenuDefinition } from "./ContextMenuFactory";

const registry = new Map<string, CommandDefinition>();
const contextMenus = new Map<string, ContextMenuDefinition>();

function ContextMenuKey(kind: ContextMenuDefinition["kind"], name: string) {
  return `${kind}:${name}`;
}

export function ResolveCommand(
  commandName: string,
): CommandDefinition | undefined {
  return registry.get(commandName);
}

export function RegisterCommand(command: CommandDefinition): void {
  registry.set(command.data.name, command);
}

export function RegisterCommands(commands: CommandDefinition[]): void {
  commands.forEach(RegisterCommand);
}

export function ReplaceCommands(commands: CommandDefinition[]): void {
  registry.clear();
  RegisterCommands(commands);
}

export function ClearCommands(): void {
  registry.clear();
}

/**
 * Every registered slash command, including shortcut aliases (check `aliasOf`).
 */
export function AllCommands(): CommandDefinition[] {
  return Array.from(registry.values());
}

/**
 * Registered slash commands without shortcut aliases, for listings such as /help.
 */
export function PrimaryCommands(): CommandDefinition[] {
  return AllCommands().filter((command) => !command.aliasOf);
}

/**
 * Maps a shortcut alias to the command it belongs to (`daily` → `economy`); other names are
 * returned unchanged.
 */
export function ResolveCanonicalCommandName(commandName: string): string {
  return registry.get(commandName)?.aliasOf?.command ?? commandName;
}

export function CommandGroups(): string[] {
  const groups = new Set<string>();
  registry.forEach((command) => groups.add(command.group));
  return Array.from(groups);
}

export function ResolveContextMenu(
  kind: ContextMenuDefinition["kind"],
  name: string,
): ContextMenuDefinition | undefined {
  return contextMenus.get(ContextMenuKey(kind, name));
}

export function ReplaceContextMenus(menus: ContextMenuDefinition[]): void {
  contextMenus.clear();
  for (const menu of menus) {
    contextMenus.set(ContextMenuKey(menu.kind, menu.data.name), menu);
  }
}

export function AllContextMenus(): ContextMenuDefinition[] {
  return Array.from(contextMenus.values());
}
