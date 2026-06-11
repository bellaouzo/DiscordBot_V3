export const PROTECTED_COMMANDS = new Set([
  "command",
  "setup",
  "help",
  "hub",
  "debug",
  "health",
  "ping",
]);

export function IsProtectedCommand(commandName: string): boolean {
  return PROTECTED_COMMANDS.has(commandName);
}
