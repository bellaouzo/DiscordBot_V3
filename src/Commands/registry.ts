import type { CommandDefinition } from './CommandFactory'

const registry = new Map<string, CommandDefinition>()

export function ResolveCommand(commandName: string): CommandDefinition | undefined {
  return registry.get(commandName)
}

export function RegisterCommand(command: CommandDefinition): void {
  registry.set(command.data.name, command)
}

export function RegisterCommands(commands: CommandDefinition[]): void {
  commands.forEach(RegisterCommand)
}

export function AllCommands(): CommandDefinition[] {
  return Array.from(registry.values())
}

export function CommandGroups(): string[] {
  const groups = new Set<string>()
  registry.forEach(command => groups.add(command.group))
  return Array.from(groups)
}

