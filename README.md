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

## 🏗️ Architecture Overview

The Discord Bot V3 framework follows a modular, layered architecture designed for scalability and maintainability.

### Core Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Discord.js    │───▶│   Bot Layer     │───▶│ Command Loader  │
│   Client        │    │   (Entry Point) │    │   & Registry    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                         │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Responders    │◀───│ Command Handler  │◀───│ Middleware      │
│   (Output)      │    │   (Logic)        │    │   Chain          │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

- **🤖 Bot Layer** - Entry point, event registration, command deployment
- **📋 Commands** - Command factory, registry, and execution pipeline  
- **🔧 Middleware** - Pre/post processing pipeline with context
- **💬 Responders** - Interaction handling and response management
- **⚡ Events** - Event handlers for Discord.js client events
- **🛠️ Utilities** - Helper functions for embeds, components, guild resources
- **💾 Database** - SQLite-based ticket system and persistence

### Data Flow

When a user invokes a slash command, the following sequence occurs:

1. **User invokes `/command`** → Discord sends interaction
2. **InteractionCreate event fires** → Bot receives interaction
3. **Command executor retrieves command definition** → Looks up command from registry
4. **Middleware chain runs (before)** → Logging, permissions, cooldowns
5. **Command execute function runs** → Your business logic executes
6. **Middleware chain runs (after)** → Error handling, cleanup
7. **Response sent to Discord** → User sees result

This architecture ensures consistent error handling, logging, and permission checking across all commands while keeping your command logic clean and focused.

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
import { LoggingMiddleware, ErrorMiddleware, PermissionMiddleware } from "./Commands/Middleware";

async function ExecuteMyCommand(interaction, context) {
  const { interactionResponder } = context.responders;
  
  // Defer reply for long operations
  await interactionResponder.Defer(interaction, true); // ephemeral
  
  // Perform your logic here
  const result = await doSomething();
  
  // Update with result
  await interactionResponder.Edit(interaction, {
    content: `Operation completed: ${result}`
  });
}

export const MyCommand = CreateCommand({
  name: "my-command",
  description: "My awesome command",
  group: "utility",
  middleware: {
    before: [LoggingMiddleware, PermissionMiddleware],
    after: [ErrorMiddleware],
  },
  config: {
    permissions: {
      required: ["ManageMessages"],
      requireAny: false
    },
    cooldown: {
      seconds: 5
    }
  },
  execute: ExecuteMyCommand,
});
```

### Middleware System

Middleware provides a powerful way to add cross-cutting concerns to your commands using an Express-style pattern.

#### What Middleware Is
Middleware functions execute before and/or after your command logic, allowing you to:
- Log command usage and performance
- Validate permissions and roles
- Implement rate limiting
- Handle errors gracefully
- Add custom validation logic

#### Middleware Types
- **Before Middleware** - Runs before command execution (logging, permissions, cooldowns)
- **After Middleware** - Runs after command execution (error handling, cleanup)

#### Execution Flow
Middleware uses a chain of responsibility pattern with `next()` calls:

```typescript
export const CustomMiddleware: CommandMiddleware = {
  name: "custom",
  execute: async (context, next) => {
    // Pre-execution logic
    console.log("Before command execution");
    
    await next(); // Call next middleware or command
    
    // Post-execution logic  
    console.log("After command execution");
  }
};
```

#### Built-in Middleware

**LoggingMiddleware**
- Logs command execution with user/guild context
- Tracks command performance and usage patterns

**ErrorMiddleware** 
- Catches and handles errors gracefully
- Provides user-friendly error messages
- Logs detailed error information

**PermissionMiddleware**
- Validates Discord permissions, roles, and owner-only commands
- Supports `required` permissions (all or any)
- Checks for specific roles and server ownership
- Provides clear permission error messages

**CooldownMiddleware**
- Rate limiting per user/command
- Configurable durations (milliseconds, seconds, minutes)
- Automatic cleanup of expired cooldowns

#### Creating Custom Middleware

```typescript
import { CommandMiddleware } from "./Commands/Middleware";

export const AuditMiddleware: CommandMiddleware = {
  name: "audit",
  execute: async (context, next) => {
    const startTime = Date.now();
    
    await next();
    
    const duration = Date.now() - startTime;
    context.logger.Info("Command audit", {
      command: context.command.data.name,
      duration: `${duration}ms`,
      userId: context.interaction.user.id
    });
  }
};
```

#### Middleware Context
The `MiddlewareContext` object provides access to:
- `interaction` - The Discord interaction object
- `command` - The command definition
- `logger` - Structured logger instance
- `responders` - Response handling utilities
- `config` - Command-specific configuration

### Responder System

The responder system provides a comprehensive set of utilities for handling Discord interactions and responses.

#### InteractionResponder

Handles slash command interactions with full lifecycle support:

- **`Reply()`** - Send initial response to interaction
- **`Edit()`** - Modify existing reply content
- **`FollowUp()`** - Send additional messages after initial reply
- **`Defer()`** - Show "thinking" state with optional ephemeral flag
- **`WithAction()`** - Show loading message, perform action, then update
- **`SendDm()`** - Send direct message to users

```typescript
// Basic reply
await interactionResponder.Reply(interaction, {
  content: "Hello!",
  ephemeral: true
});

// Defer for long operations
await interactionResponder.Defer(interaction, true);
await doLongOperation();
await interactionResponder.Edit(interaction, {
  content: "Operation completed!"
});

// Action wrapper with loading state
await interactionResponder.WithAction({
  interaction,
  message: "Processing...",
  action: async () => {
    await processData();
  },
  followUp: "Done!"
});
```

#### ButtonResponder

Manages button interactions and message updates:

- **`Update()`** - Update button interaction message
- **`DeferUpdate()`** - Acknowledge button without visual change
- **`EditMessage()`** - Edit the message containing the button
- **`EditReply()`** - Edit the bot's reply after defer
- **`Reply()`** - Send new reply to button interaction
- **`FollowUp()`** - Send follow-up message

```typescript
// Handle button click
await buttonResponder.Update(interaction, {
  content: "Button clicked!",
  components: [] // Remove buttons
});

// Defer and edit later
await buttonResponder.DeferUpdate(interaction);
await buttonResponder.EditMessage(interaction, {
  content: "Processing button click..."
});
```

#### PaginatedResponder

Creates multi-page messages with automatic navigation:

- **`Send()`** - Create paginated message with navigation buttons
- Configuration options: ephemeral, ownerId (restrict navigation), timeouts
- Automatic button generation and routing
- Page structure with embeds, content, and custom components

```typescript
const pages = [
  { content: "Page 1 content", embeds: [embed1] },
  { content: "Page 2 content", embeds: [embed2] },
  { content: "Page 3 content", embeds: [embed3] }
];

await paginatedResponder.Send({
  interaction,
  pages,
  ephemeral: false,
  ownerId: interaction.user.id, // Only owner can navigate
  timeoutMs: 300000 // 5 minutes
});
```

#### ComponentRouter & SelectMenuRouter

Handle button and select menu interactions by routing to registered handlers:

```typescript
// Register button handler
componentRouter.Register("my-button", async (interaction) => {
  await buttonResponder.Update(interaction, {
    content: "Button handled!"
  });
});

// Register select menu handler  
selectMenuRouter.Register("my-select", async (interaction) => {
  const selected = interaction.values[0];
  await interactionResponder.Reply(interaction, {
    content: `You selected: ${selected}`
  });
});
```

#### Response Patterns

Common patterns for different use cases:

**Ephemeral Replies** - Private responses only visible to the user
```typescript
await interactionResponder.Reply(interaction, {
  content: "This is private",
  ephemeral: true
});
```

**Deferred Responses** - For long operations that need "thinking" state
```typescript
await interactionResponder.Defer(interaction, true);
await longOperation();
await interactionResponder.Edit(interaction, { content: "Done!" });
```

**Action Wrappers** - Show loading state during operations
```typescript
await interactionResponder.WithAction({
  interaction,
  message: "Working...",
  action: async () => await processData(),
  followUp: "Completed successfully!"
});
```

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
