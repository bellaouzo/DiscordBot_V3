# Extending the Bot

Checklists for the common ways to add to the bot. Each one lists every file you touch; if a step isn't listed, it happens automatically.

| I want to add… | Section |
|----------------|---------|
| A slash command | [Commands](#a-slash-command) |
| Subcommands to a command | [Subcommands](#subcommands) |
| A guild setting | [Guild settings](#a-guild-setting) |
| A feature (help entry, `/setup` toggle, command gating) | [Features](#a-feature) |
| A database query | [Database queries](#a-database-query) |
| A schema change | [Schema changes](#a-schema-change) |
| A multi-step button flow (game, prompt) | [Interactive sessions](#an-interactive-button-flow) |
| A button that survives restarts | [Persistent buttons](#a-persistent-button) |
| A background job | [Background jobs](#a-background-job) |

## A slash command

```bash
npm run new:command -- Utility Remind            # single command
npm run new:command -- Utility Remind --subcommands
```

This creates `src/Commands/Utility/RemindCommand.ts` and a passing test in `tests/commands/Utility/`. Files named `*Command.ts` are discovered at startup and deployed; there is no list to register in. Fill in the TODOs, set `config` (e.g. `{ access: "mod", cooldown: "5s" }`), and see [WRITING_COMMANDS.md](WRITING_COMMANDS.md) for responders and middleware.

## Subcommands

Pass `subcommands` to `CreateCommand` instead of `execute`. Each entry holds its slash definition and its handler together, and the dispatch is generated:

```ts
export const RemindCommand = CreateCommand({
  name: "remind",
  description: "Set reminders",
  group: "utility",
  config: { cooldown: "3s" },
  subcommands: [
    { name: "list", description: "List your reminders", execute: HandleList },
    {
      name: "add",
      description: "Add a reminder",
      options: (sub) => sub.addStringOption((o) => o.setName("text").setDescription("What").setRequired(true)),
      execute: HandleAdd,
    },
    { name: "admin", description: "Staff tools", subcommands: [/* a subcommand group */] },
  ],
});
```

Factor options shared by several subcommands into a helper (see `AddBetOption` in [EconomyCommand.ts](../src/Commands/Fun/EconomyCommand.ts)). Older commands still use `configure` + `execute`; both styles are supported.

## A guild setting

1. Add a field to `GUILD_SETTING_FIELDS` in [GuildSettingsSchema.ts](../src/Database/Server/GuildSettingsSchema.ts), e.g. `remind_channel_id: Setting.id()`. Types, reads, saves and dashboard input parsing follow from it.
2. Add a migration that creates the column (next version in `src/Database/Migrations/server/index.ts`):
   ```ts
   { version: 5, name: "guild_settings_remind_channel", up(db) {
       AddTableColumnsIfMissing(db, "guild_settings", GuildSettingColumns(["remind_channel_id"]));
   } },
   ```
   `tests/database/GuildSettingsSchema.test.ts` fails if you forget this.
3. If staff should edit it in the web dashboard, add the form control in `src/Web/public` (the save route already accepts every editable field). Pass `{ editable: false }` for settings the dashboard must not write.

Choose `Setting.id({ clearable: true })` when saving `null` should clear the value; by default `null` means "keep the existing value".

## A feature

Add an entry to `FEATURE_LIST` in [Features.ts](../src/Shared/Features.ts). One entry drives `/help`, `/<command> about`, and (with a `toggle`) the `/setup` feature step and command gating.

- **Help only:** `key`, `name`, `icon`, `summary`, and a `guide`. Show it from a command with `ReplyWithFeatureAbout(interaction, context, "your-key")`.
- **Toggleable:** add `toggle: { order, label, emoji, description, setting: "your_feature_enabled" }`, after adding that boolean to the [settings schema](#a-guild-setting). `/setup` shows and saves it automatically.
- **Gate commands on it:** `config: { feature: "your-key" }`. Guilds with it off get a "<Name> Disabled" reply.

A toggle whose state is derived from other settings (like starboard, which is "on" when a channel is set) uses `readEnabled` instead of `setting`, and needs explicit save logic in [SaveSetupDraft.ts](../src/Systems/Setup/persistence/SaveSetupDraft.ts).

## A database query

Add a public method to the relevant store under `src/Database/*/Stores/`. Database facades expose every store method automatically (`databases.serverDb.YourMethod(...)`), so there is no pass-through to write. Method names must be unique across a facade's stores; startup throws if two collide. Use descriptive names (`GetStarboardEntry`, not `GetEntry`).

## A schema change

Every change is a new migration version in `src/Database/Migrations/<database>/index.ts`. Never edit the version `0` `*_INITIAL_SCHEMA` SQL. See [CONTRIBUTING.md](CONTRIBUTING.md#database-migrations).

## An interactive button flow

Use [InteractiveSession](../src/Shared/InteractiveSession.ts) for games and prompts with owner-only buttons and a timeout:

```ts
const session = new InteractiveSession({
  componentRouter, ownerId: interaction.user.id, timeoutMs: 60_000,
  onTimeout: async () => { /* refund, show "timed out", disable buttons */ },
});
customIds.go = session.RegisterButton(async (button) => {
  if (!session.Resolve()) return; // already ended by timeout or another button
  /* finish the flow */
});
const reply = await interactionResponder.Reply(interaction, { /* ... */ });
if (!reply.success) { session.Resolve(); return; }
session.Start();
```

Call `Resolve()` only in handlers that end the flow; intermediate actions check `session.IsResolved`. Flows that keep running after the user commits (an animated race) call `StopTimer()`. For bets, start with `PrepareWager` from [Wager.ts](../src/Systems/Economy/utils/Wager.ts). [WheelHandler.ts](../src/Systems/Economy/handlers/WheelHandler.ts) is the smallest complete example.

## A persistent button

Buttons that must work after a restart need a fixed custom ID and a handler registered at startup.

1. Define the ID once with [DefineCustomId](../src/Shared/CustomId.ts):
   ```ts
   export const RemindIds = { snooze: DefineCustomId("remind:snooze", { reminderId: "int" }) };
   ```
   Build it with `RemindIds.snooze.Build({ reminderId })` and parse it with `RemindIds.snooze.Parse(customId)` (null if it isn't yours).
2. Register the handler in a file named `*Registrar.ts` under `src/Systems` or `src/Commands`; it is discovered at startup:
   ```ts
   export const RemindRegistrar = DefineSystemRegistrar("reminders", (context) => {
     context.responders.componentRouter.RegisterButtonPrefix(RemindIds.snooze.prefix, {
       handler: (button) => HandleSnooze(button, context),
     });
   });
   ```

Keep namespaces unique (`ticket:`, `appeal:`, `remind:`). Command-scoped buttons (registered while a command runs) don't need either step.

## A background job

Extend [PollingScheduler](../src/Shared/PollingScheduler.ts) and implement `Poll()`; it runs once at start, never overlaps, and logs failures. Add an instance to the `services` list in [Bootstrap.ts](../src/Bootstrap.ts), which starts it after login and stops it on shutdown.
