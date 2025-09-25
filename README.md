# 🤖 Discord Bot V3 🤖

<p align="center">
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg" alt="Node.js version">
  <img src="https://img.shields.io/badge/typescript-%3E%3D5.0.0-blue.svg" alt="TypeScript version">
  <a href="https://discord.js.org">
    <img src="https://img.shields.io/badge/discord.js-v14-7289DA?logo=discord&logoColor=white" alt="Discord.js">
  </a>
</p>

<p align="center">
  A powerful, modern, and highly scalable Discord bot foundation with advanced features.
</p>

---

## ✨ Features

- **🚀 Modern Tech Stack:** Built with **TypeScript** and **Discord.js v14**
- **⚡ Slash Commands:** Full support with automatic deployment and validation
- **🏗️ Modular Architecture:** Clean, organized structure with command groups and auto-loading
- **🔧 Middleware System:** Built-in logging, permissions, cooldowns, and error handling
- **📱 Interactive UI:** Pagination, buttons, and rich embeds with component routing
- **🎨 Utility System:** Reusable embed and component factories for consistent styling
- **📊 Advanced Logging:** Structured logging with colored output and context tracking
- **⚙️ Event System:** Comprehensive event handling with auto-discovery
- **🛡️ Type Safety:** Full TypeScript coverage with proper interfaces
- **📦 Caching:** Smart caching system for performance optimization

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** v16+
- **Discord Account** with server admin rights
- **Git** client

### Installation

```bash
# Clone the repository
git clone <repository_url>
cd discord-bot-v3

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

### Configuration

Create a `.env` file with your bot credentials:

```env
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_bot_client_id_here
GUILD_ID=your_test_server_id_here
```

**Getting Your Credentials:**

1. Visit [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. **Bot Section:** Copy the token for `DISCORD_TOKEN`
4. **General Information:** Copy the application ID for `CLIENT_ID`
5. **Server:** Right-click your server → "Copy Server ID" for `GUILD_ID`

### Running the Bot

```bash
# Development mode (auto-restart on changes)
npm run dev

# Production mode
npm run build
npm start

# Quick aliases
npm run b    # Build
npm run s    # Start
```

---

## 📚 Command Examples

### Basic Command

```typescript
// src/Commands/utility/PingCommand.ts
import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "../CommandFactory";
import {
  LoggingMiddleware,
  CooldownMiddleware,
  ErrorMiddleware,
} from "../Middleware";
import { Config } from "../Middleware/CommandConfig";

async function ExecutePing(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { actionResponder } = context.responders;

  await actionResponder.Send({
    interaction,
    message: "Pinging...",
    followUp: `Pong! Latency: ${Date.now() - interaction.createdTimestamp}ms`,
    action: async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    },
  });
}

export const PingCommand = CreateCommand({
  name: "ping",
  description: "Replies with Pong!",
  group: "utility",
  middleware: {
    before: [LoggingMiddleware, CooldownMiddleware],
    after: [ErrorMiddleware],
  },
  config: Config.utility(1), // 1 second cooldown
  execute: ExecutePing,
});
```

### Advanced Command with Options

```typescript
// src/Commands/moderation/KickCommand.ts
import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "../CommandFactory";
import {
  LoggingMiddleware,
  PermissionMiddleware,
  CooldownMiddleware,
  ErrorMiddleware,
} from "../Middleware";
import { Config } from "../Middleware/CommandConfig";

async function ExecuteKick(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { actionResponder, dmResponder } = context.responders;
  const { logger } = context;

  const targetUser = interaction.options.getUser("user", true);
  const reason =
    interaction.options.getString("reason") ?? "No reason provided";
  const notify = interaction.options.getBoolean("notify") ?? false;

  await actionResponder.Send({
    interaction,
    message: `Kicking ${targetUser.username}...`,
    followUp: `✅ Successfully kicked **${targetUser.username}** for: ${reason}`,
    action: async () => {
      logger.Info("Attempting to kick user", {
        extra: { targetUserId: targetUser.id },
      });
      const targetMember = await interaction.guild?.members.fetch(
        targetUser.id
      );

      if (!targetMember) {
        throw new Error("User not found in this server.");
      }
      if (!targetMember.kickable) {
        throw new Error(
          "I cannot kick this user. They may have higher permissions than me."
        );
      }

      await targetMember.kick(reason);
      logger.Info("User kicked", {
        extra: { targetUserId: targetUser.id, reason },
      });

      if (notify) {
        await dmResponder.Send(
          targetUser,
          `You have been kicked from ${
            interaction.guild?.name ?? "this server"
          } for: ${reason}`
        );
      }
    },
  });
}

export const KickCommand = CreateCommand({
  name: "kick",
  description: "Kick a user from the server",
  group: "moderation",
  configure: (builder) => {
    builder
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("The user to kick")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("reason")
          .setDescription("Reason for kicking")
          .setRequired(true)
      )
      .addBooleanOption((option) =>
        option.setName("notify").setDescription("Send DM notification to user")
      );
  },
  middleware: {
    before: [LoggingMiddleware, PermissionMiddleware, CooldownMiddleware],
    after: [ErrorMiddleware],
  },
  config: Config.moderation(5), // 5 second cooldown, requires permissions
  execute: ExecuteKick,
});
```

### Interactive Command with Pagination

```typescript
// src/Commands/utility/HelpCommand.ts
import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "../CommandFactory";
import { LoggingMiddleware, ErrorMiddleware } from "../Middleware";
import { Config } from "../Middleware/CommandConfig";
import { PaginationPage } from "../../Pagination";
import { AllCommands } from "../registry";
import { EmbedFactory, ComponentFactory } from "../../Utilities";

async function ExecuteHelp(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { paginatedResponder, componentRouter } = context.responders;
  const { logger } = context;

  try {
    // Fetch and organize commands
    const allCommands = await GetAllCommandsCached();
    const sections = GroupCommandsBySection(allCommands);

    // Create paginated pages with overview and sections
    const pages = CreateOptimizedPages(sections);

    // Register button handlers for section navigation
    RegisterOptimizedButtons(
      sections,
      componentRouter,
      interaction.id,
      interaction.user.id
    );

    // Send the paginated help menu
    await paginatedResponder.Send({
      interaction,
      pages,
      ephemeral: true,
      ownerId: interaction.user.id,
      timeoutMs: 1000 * 60 * 5, // 5 minutes
    });

    logger.Info("Help command executed", {
      extra: {
        userId: interaction.user.id,
        commandCount: allCommands.length,
        sectionCount: sections.length,
      },
    });
  } catch (error) {
    logger.Error("Help command failed", { error });
    throw error;
  }
}

export const HelpCommand = CreateCommand({
  name: "help",
  description: "📚 Browse all available bot commands with an interactive menu",
  group: "utility",
  middleware: {
    before: [LoggingMiddleware],
    after: [ErrorMiddleware],
  },
  config: Config.utility(0), // No cooldown
  execute: ExecuteHelp,
});
```

---

## 🏗️ Architecture Overview

### Project Structure

```
src/
├── Bot/                    # Core bot functionality
│   ├── CreateBot.ts       # Bot initialization
│   ├── CreateCommandLoader.ts  # Auto-loading commands
│   ├── CreateEventLoader.ts    # Auto-loading events
│   └── ExecuteCommand.ts  # Command execution engine
├── Commands/              # Command system
│   ├── CommandFactory.ts  # Command creation factory
│   ├── Middleware/        # Command middleware
│   │   ├── LoggingMiddleware.ts
│   │   ├── PermissionMiddleware.ts
│   │   ├── CooldownMiddleware.ts
│   │   └── ErrorMiddleware.ts
│   ├── moderation/        # Moderation commands
│   └── utility/          # Utility commands
├── Events/               # Event system
│   ├── EventFactory.ts   # Event creation factory
│   └── Client/          # Client events
├── Responders/           # Response system
│   ├── ReplyResponder.ts
│   ├── ActionResponder.ts
│   ├── PaginatedResponder.ts
│   └── MessageFactory.ts
├── Utilities/            # Utility factories
│   ├── EmbedBuilder.ts   # Embed creation utilities
│   └── ComponentBuilder.ts # Component creation utilities
├── Pagination/           # Pagination system
├── Interactions/         # Component routing
└── Logging/             # Structured logging
```

### Middleware System

The bot includes a powerful middleware pipeline for command processing:

```typescript
// Middleware execution order
middleware: {
  before: [LoggingMiddleware, PermissionMiddleware, CooldownMiddleware],
  after: [ErrorMiddleware]
}
```

**Available Middleware:**

- **LoggingMiddleware**: Logs command execution with context
- **PermissionMiddleware**: Validates user permissions with detailed error messages
- **CooldownMiddleware**: Prevents command spam with configurable cooldowns
- **ErrorMiddleware**: Handles and logs errors gracefully

### Response System

Multiple response types for different use cases:

```typescript
// Simple reply
await replyResponder.Send(interaction, { content: "Hello!" });

// Action with loading state
await actionResponder.Send({
  interaction,
  message: "Processing...",
  followUp: "Done!",
  action: async () => {
    /* do work */
  },
});

// Paginated content
await paginatedResponder.Send({
  interaction,
  pages: [page1, page2, page3],
  ephemeral: true,
});

// Direct message
await dmResponder.Send(user, "You have been warned!");
```

### Utility System

Consistent styling with factory patterns:

```typescript
// Embed creation
const embed = EmbedFactory.Create({
  title: "Success!",
  description: "Operation completed",
  color: 0x57f287,
});

// Component creation
const buttons = ComponentFactory.CreateHelpSectionButtons(
  sections,
  interactionId,
  currentIndex
);
```

---

## 📜 Available Scripts

| Command         | Description                        |
| --------------- | ---------------------------------- |
| `npm run dev`   | Development mode with auto-restart |
| `npm run build` | Compile TypeScript to JavaScript   |
| `npm start`     | Run the compiled bot               |
| `npm run b`     | Short alias for build              |
| `npm run s`     | Short alias for start              |
| `npm run clean` | Clean compiled files               |

---

## 🎯 Key Features Deep Dive

### Auto-Loading System

Commands and events are automatically discovered and loaded:

```typescript
// Commands are auto-loaded from:
src / Commands / utility / MyCommand.ts;
src / Commands / moderation / MyCommand.ts;

// Events are auto-loaded from:
src / Events / Client / MyEvent.ts;
```

### Caching System

Smart caching for performance:

```typescript
// Commands are cached for 5 minutes
const commandCache = new Map<
  string,
  { data: CommandInfo[]; timestamp: number }
>();
const CACHE_DURATION = 1000 * 60 * 5;
```

### Interactive Components

Full support for Discord's interactive components:

```typescript
// Button registration with routing
componentRouter.RegisterButton({
  customId: "my-button",
  ownerId: interaction.user.id,
  handler: async (buttonInteraction) => {
    await buttonInteraction.deferUpdate();
    // Handle button click
  },
  expiresInMs: 1000 * 60 * 5,
});
```

### Structured Logging

Advanced logging with context and colors:

```typescript
// Colored log levels
logger.Info("Command executed", { extra: { userId: "123" } });
logger.Error("Something failed", { error: new Error("Oops") });
logger.Debug("Debug info", { phase: "bootstrap" });
```

---

## 🚀 Getting Started with Development

### 1. Create a New Command

```bash
# Create command file
touch src/Commands/utility/MyCommand.ts
```

### 2. Write Command Logic

```typescript
import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "../CommandFactory";
import { LoggingMiddleware, ErrorMiddleware } from "../Middleware";
import { Config } from "../Middleware/CommandConfig";

async function ExecuteMyCommand(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { replyResponder } = context.responders;
  await replyResponder.Send(interaction, { content: "My command executed!" });
}

export const MyCommand = CreateCommand({
  name: "mycommand",
  description: "My custom command",
  group: "utility",
  middleware: {
    before: [LoggingMiddleware],
    after: [ErrorMiddleware],
  },
  config: Config.utility(0),
  execute: ExecuteMyCommand,
});
```

### 3. Export the Command

```typescript
// src/Commands/utility/index.ts
export { MyCommand } from "./MyCommand";
```

### 4. Test Your Command

```bash
npm run dev
# Your command will be automatically deployed and available!
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/your-repo/issues) page
2. Create a new issue with detailed information
3. Join our Discord server for community support

---

<p align="center">
  Made with ❤️ for the Discord community
</p>
