# 🤖 Discord Bot V3

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
  <strong>A modern, scalable Discord bot framework built with TypeScript and Discord.js v14.</strong>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-features">Features</a> •
  <a href="#-examples">Examples</a> •
  <a href="#-documentation">Documentation</a> •
  <a href="#-contributing">Contributing</a>
</p>

> ⚠️ **EARLY TESTING STAGE** - This framework is currently in very early development and testing phases. Features may change, bugs may exist, and breaking changes are likely. Use at your own risk and please report any issues you encounter.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** v16+
- **Discord Account** with server admin rights
- **Git** client

### 1. Installation

```bash
# Clone and install
git clone <repository_url>
cd discord-bot-v3
npm install
```

### 2. Configuration

Create a `.env` file with your bot credentials:

```env
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_bot_client_id_here
GUILD_ID=your_test_server_id_here
```

<details>
<summary><strong>📋 How to get your bot credentials</strong></summary>

1. Visit [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. **Bot Section:** Copy the token for `DISCORD_TOKEN`
4. **General Information:** Copy the application ID for `CLIENT_ID`
5. **Server:** Right-click your server → "Copy Server ID" for `GUILD_ID`

</details>

### 3. Run the Bot

```bash
# Development mode (auto-restart on changes)
npm run dev

# Production mode
npm run build
npm start
```

---

## ✨ Features

<div align="center">

|         🚀 **Modern Stack**         |        ⚡ **Slash Commands**        |         🏗️ **Architecture**         |
| :---------------------------------: | :---------------------------------: | :---------------------------------: |
|     TypeScript + Discord.js v14     |    Auto-deployment & validation     |      Clean, modular structure       |
| [Jump to section →](#-quick-start) | [Jump to section →](#️-architecture) | [Jump to section →](#️-architecture) |

|         🔧 **Middleware**         |         📱 **Interactive UI**         |         🎨 **Utilities**         |
| :-------------------------------: | :-----------------------------------: | :------------------------------: |
|  Logging, permissions, cooldowns  |      Pagination, buttons, embeds      |        Reusable factories        |
| [Jump to section →](#️-middleware) | [Jump to section →](#️-interactive-ui) | [Jump to section →](#️-utilities) |

|         📊 **Logging**         |         ⚙️ **Events**         |         🛡️ **Type Safety**         |
| :----------------------------: | :---------------------------: | :--------------------------------: |
|  Colored output with context   | Comprehensive event handling  |      Full TypeScript coverage      |
| [Jump to section →](#️-logging) | [Jump to section →](#️-events) | [Jump to section →](#️-type-safety) |

</div>

---

## 📚 Examples

> 📁 **All examples are in the [`examples/` folder](examples/) with complete, working code**

### Basic Commands

- **[Ping Command](examples/basic/ping-command.ts)** - Simple command with action responder
- **[Hello Command](examples/basic/hello-command.ts)** - Basic reply command

### Advanced Commands

- **[Kick Command](examples/advanced/kick-command.ts)** - Moderation command with options and permissions
- **[Help Command](examples/advanced/help-command.ts)** - Interactive command with pagination and buttons

### Event Examples

- **[Ready Event](examples/events/ready-event.ts)** - Bot startup event

### Utility Examples

- **[Embed Factory](examples/utilities/embed-examples.ts)** - Creating rich embeds
- **[Component Factory](examples/utilities/component-examples.ts)** - Building interactive components

---

## 📖 Documentation

### 🏗️ Architecture

**Project Structure:**

```
src/
├── Bot/                    # Core bot functionality
├── Commands/              # Command system with auto-loading
│   ├── Middleware/        # Command middleware
│   ├── moderation/        # Moderation commands
│   └── utility/          # Utility commands
├── Events/               # Event system
├── Responders/           # Response handling
├── Utilities/            # Reusable factories
├── Pagination/           # Interactive pagination
├── Interactions/         # Component routing
└── Logging/             # Structured logging
```

**Key Concepts:**

- **Auto-loading**: Commands and events are automatically discovered
- **Middleware**: Pipeline for processing commands (logging, permissions, etc.)
- **Responders**: Different ways to respond to interactions
- **Factories**: Reusable utilities for embeds and components

### 🔧 Middleware

The bot includes middleware for common command needs:

| Middleware               | Purpose                                         | Usage               |
| ------------------------ | ----------------------------------------------- | ------------------- |
| **LoggingMiddleware**    | Logs command execution with context             | Always recommended  |
| **PermissionMiddleware** | Validates user permissions with detailed errors | Moderation commands |
| **CooldownMiddleware**   | Prevents command spam                           | All commands        |
| **ErrorMiddleware**      | Handles errors gracefully                       | Always recommended  |

```typescript
middleware: {
  before: [LoggingMiddleware, PermissionMiddleware, CooldownMiddleware],
  after: [ErrorMiddleware],
}
```

### 📱 Interactive UI

**Response Types:**

- **ReplyResponder**: Simple replies
- **ActionResponder**: Loading states with follow-ups
- **PaginatedResponder**: Multi-page content with navigation
- **DmResponder**: Direct messages to users

**Components:**

- **Buttons**: Interactive buttons with routing
- **Pagination**: Navigate through multiple pages
- **Embeds**: Rich, styled messages

### 🎨 Utilities

**Embed Factory:**

```typescript
import { EmbedFactory } from "./Utilities";

const embed = EmbedFactory.CreateSuccess({
  title: "Success!",
  description: "Operation completed",
});
```

**Component Factory:**

```typescript
import { ComponentFactory } from "./Utilities";

const buttons = ComponentFactory.CreateHelpSectionButtons(
  sections,
  interactionId,
  currentIndex
);
```

### 📊 Logging

Structured logging with colored output:

- **🔵 INFO** - General information
- **🟡 WARN** - Warnings
- **🔴 ERROR** - Errors (red text)
- **⚪ DEBUG** - Debug information

```typescript
logger.Info("Command executed", {
  extra: { userId: "123" },
});
```

### ⚙️ Events

Auto-loaded events for bot lifecycle:

```typescript
// src/Events/Client/ReadyEvent.ts
export const ReadyEvent = CreateEvent({
  name: Events.ClientReady,
  once: true,
  execute: async (context) => {
    context.logger.Info("Bot is ready!");
  },
});
```

### 🛡️ Type Safety

Full TypeScript coverage with proper interfaces:

- Command definitions are type-safe
- Middleware has proper typing
- Responders use strict types
- All utilities are fully typed

### 📦 Performance

Built-in optimizations:

- **Command Caching**: Commands cached for 5 minutes
- **Smart Loading**: Only loads what's needed
- **Efficient Rendering**: Reuses components when possible

---

## 🛠️ Available Scripts

| Command         | Description                        |
| --------------- | ---------------------------------- |
| `npm run dev`   | Development mode with auto-restart |
| `npm run build` | Compile TypeScript to JavaScript   |
| `npm start`     | Run the compiled bot               |
| `npm run b`     | Short alias for build              |
| `npm run s`     | Short alias for start              |

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ❤️ for the Discord community
</p>
