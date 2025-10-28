# 🤖 Discord Bot V3

A modern, scalable Discord bot framework built with TypeScript and Discord.js v14.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-%3E%3D5.0.0-blue.svg)](https://www.typescriptlang.org/)
[![Discord.js](https://img.shields.io/badge/discord.js-v14-7289DA?logo=discord&logoColor=white)](https://discord.js.org/)

> ⚠️ **Early Development** - This framework is in active development. Features may change and breaking changes are possible.

## 🚀 Quick Start

1. **Install dependencies**
   ```bash
   git clone <repository_url>
   cd discord-bot-v3
   npm install
   ```

2. **Configure your bot**
   Create `.env` file:
   ```env
   DISCORD_TOKEN=your_bot_token
   CLIENT_ID=your_bot_client_id
   GUILD_ID=your_test_server_id
   ```

3. **Start coding**
   ```bash
   npm run dev
   ```

**Need help getting bot credentials?** Visit the [Discord Developer Portal](https://discord.com/developers/applications) to create your bot and get the required tokens.

## ✨ Features

- **🚀 Modern Stack** - TypeScript + Discord.js v14
- **⚡ Slash Commands** - Auto-deployment & validation  
- **🏗️ Clean Architecture** - Modular, scalable structure
- **🔧 Middleware** - Logging, permissions, cooldowns
- **📱 Interactive UI** - Pagination, buttons, embeds
- **🎨 Utilities** - Reusable factories and helpers
- **📊 Logging** - Structured logging with context
- **🛡️ Type Safety** - Full TypeScript coverage

## 📚 Examples

**New to the framework?** Start with the **[Starter Template](examples/basic/starter-template.ts)** - a complete working command you can copy and run immediately.

### By Difficulty
- **🟢 Beginner:** [Starter Template](examples/basic/starter-template.ts), [Ping](examples/basic/ping-command.ts), [Hello](examples/basic/hello-command.ts), [Ready Event](examples/events/ready-event.ts)
- **🟡 Intermediate:** [Kick Command](examples/advanced/kick-command.ts), [Embed Factory](examples/utilities/embed-examples.ts), [Component Factory](examples/utilities/component-examples.ts)
- **🔴 Advanced:** [Help Command](examples/advanced/help-command.ts), [Guild Resources](examples/utilities/guild-resource-examples.ts)

[View all examples →](examples/)

## 📖 Documentation

### Basic Command Structure

```typescript
import { CommandContext, CreateCommand } from "./Commands";
import { LoggingMiddleware, ErrorMiddleware } from "./Commands/Middleware";

async function ExecuteMyCommand(interaction, context) {
  const { interactionResponder } = context.responders;
  
  await interactionResponder.Reply(interaction, {
    content: "Hello World!"
  });
}

export const MyCommand = CreateCommand({
  name: "my-command",
  description: "My awesome command",
  group: "utility",
  middleware: {
    before: [LoggingMiddleware],
    after: [ErrorMiddleware],
  },
  execute: ExecuteMyCommand,
});
```

### Responders

- **`interactionResponder.Reply()`** - Send initial response
- **`interactionResponder.WithAction()`** - Show loading state with action
- **`interactionResponder.SendDm()`** - Send direct message
- **`paginatedResponder.Send()`** - Multi-page content with navigation

### Utilities

- **`EmbedFactory.CreateSuccess()`** - Create success embeds
- **`ComponentFactory.CreateButton()`** - Create interactive buttons
- **`CreateGuildResourceLocator()`** - Easy guild data access

## 🛠️ Scripts

- `npm run dev` - Development mode with auto-restart
- `npm run build` - Compile TypeScript
- `npm start` - Run compiled bot

## 🔧 Troubleshooting

**Command not appearing?** Run `npm run dev` to deploy commands.

**Bot not responding?** Check your `DISCORD_TOKEN` in `.env`.

**TypeScript errors?** Run `npm run build` for detailed error messages.

**Need help?** Check the [examples](examples/) or create an issue.

## 🤝 Contributing

Contributions welcome! Feel free to submit a Pull Request.

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.
