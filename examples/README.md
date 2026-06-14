# Code Examples

Practical examples for the Discord Bot V3 framework. Full documentation: [docs/README.md](../docs/README.md).

## Quick Start

**New to the framework?** Start here:

1. **[Starter Template](basic/starter-template.ts)** — Beginner — complete working command you can copy and run
2. Copy it to `src/Commands/Utility/your-command.ts`
3. Modify the name, description, and logic
4. Run `npm run dev:watch` and test it

## Available Examples

### Beginner

- **[Starter Template](basic/starter-template.ts)** — Complete working command template
- **[Ping Command](basic/ping-command.ts)** — Simple command with action responder
- **[Hello Command](basic/hello-command.ts)** — Basic reply command
- **[Ready Event](events/ready-event.ts)** — Bot startup event

### Intermediate

- **[Kick Command](advanced/kick-command.ts)** — Moderation command with options and permissions
- **[Embed Factory](utilities/embed-examples.ts)** — Creating rich embeds
- **[Component Factory](utilities/component-examples.ts)** — Building interactive components
- **[Guild Resource Locator](utilities/guild-resource-examples.ts)** — Fetching guild channels, roles, and members

### Advanced

- **[Help Command](advanced/help-command.ts)** — Interactive command with pagination and buttons

## What Each Example Teaches

| Example | Teaches | Key Features |
|---------|---------|--------------|
| **Starter Template** | Basic command structure | `CreateCommand`, `Config.utility()`, logging |
| **Ping Command** | Action responders | `WithAction`, loading states, follow-ups |
| **Hello Command** | Simple replies | `Reply`, basic logging, user interaction |
| **Kick Command** | Command options | User/string/boolean options, permissions, DM sending |
| **Help Command** | Pagination system | `PaginatedResponder`, caching, component routing |
| **Ready Event** | Event handling | Bot startup, activity setting, logging |
| **Embed Factory** | Rich embeds | Success/warning/error embeds, help sections |
| **Component Factory** | Interactive UI | Buttons, action rows, pagination controls |
| **Guild Resources** | Server data access | Channel/role/member fetching, caching |

## How to Use Examples

1. Choose an example that matches what you want to build
2. Copy the entire file to your `src/Commands/` directory
3. Update the command name and description
4. Modify the logic to fit your needs
5. Run `npm run dev:watch` to test

```bash
# macOS / Linux
cp examples/basic/starter-template.ts src/Commands/Utility/my-command.ts

# Windows (Command Prompt)
copy examples\basic\starter-template.ts src\Commands\Utility\my-command.ts
```

## Troubleshooting

**Import errors:**
- Copy to the correct directory under `src/Commands/`
- Inside `src/Commands/`, use path aliases (`@commands`, `@middleware`, `@utilities`)

**Command not working:**
- Verify the command name is unique (`npm run check:commands`)
- Check that `config` matches your intent (`Config.mod()`, `Config.utility()`, etc.)
- Check console logs for errors

**TypeScript errors:**
- Compare with working examples and [Writing Commands](../docs/WRITING_COMMANDS.md)

## Customizing Examples

```typescript
import { CommandContext, CreateCommand } from "@commands";
import { Config } from "@middleware";

async function ExecuteMyCommand(interaction, context) {
  const { interactionResponder } = context.responders;
  // Your logic here
}

export const MyCommand = CreateCommand({
  name: "my-command",
  description: "My awesome command",
  group: "utility",
  config: Config.utility(2),
  execute: ExecuteMyCommand,
});
```

`config` drives middleware automatically. See [Writing Commands](../docs/WRITING_COMMANDS.md) for middleware and responders.

## Next Steps

- [Writing Commands](../docs/WRITING_COMMANDS.md) — full command authoring guide
- [Developer Setup](../docs/DEVELOPER_SETUP.md) — install and run locally
- [Quality Checklist](../docs/QUALITY_CHECKLIST.md) — before opening a PR
- [Project README](../README.md) — overview and architecture
