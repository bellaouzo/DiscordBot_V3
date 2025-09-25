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
  A modern, scalable Discord bot framework built with TypeScript and Discord.js v14.
</p>

---

## ✨ Features

- **[🚀 Modern Tech Stack](#-quick-start)** - TypeScript + Discord.js v14
- **[⚡ Slash Commands](#-architecture)** - Auto-deployment with validation
- **[🏗️ Modular Architecture](#-architecture)** - Clean structure with auto-loading
- **[🔧 Middleware System](#-middleware)** - Logging, permissions, cooldowns
- **[📱 Interactive UI](#-interactive-ui)** - Pagination, buttons, rich embeds
- **[🎨 Utility System](#-utilities)** - Reusable factories for consistency
- **[📊 Smart Logging](#-logging)** - Colored output with context tracking
- **[⚙️ Event System](#-events)** - Comprehensive event handling
- **[🛡️ Type Safety](#-type-safety)** - Full TypeScript coverage
- **[📦 Performance](#-performance)** - Caching and optimization

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** v16+
- **Discord Account** with server admin rights
- **Git** client

### Installation

```bash
# Clone and install
git clone <repository_url>
cd discord-bot-v3
npm install

# Create environment file
cp .env.example .env
```

### Configuration

Create a `.env` file with your bot credentials:

```env
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
```

---

## 📚 Examples

Check out the [examples folder](examples/) for complete, working examples:

- **[Basic Commands](examples/basic/)** - Simple commands to get started
- **[Advanced Commands](examples/advanced/)** - Complex commands with features
- **[Event Examples](examples/events/)** - Bot event handling
- **[Utility Examples](examples/utilities/)** - Using embed and component factories

---

## 🏗️ Architecture

### Project Structure

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

### Key Concepts

- **Auto-loading**: Commands and events are automatically discovered
- **Middleware**: Pipeline for processing commands (logging, permissions, etc.)
- **Responders**: Different ways to respond to interactions
- **Factories**: Reusable utilities for embeds and components

---

## 🔧 Middleware

The bot includes middleware for common command needs:

- **LoggingMiddleware**: Logs command execution with context
- **PermissionMiddleware**: Validates user permissions with detailed errors
- **CooldownMiddleware**: Prevents command spam
- **ErrorMiddleware**: Handles errors gracefully

```typescript
middleware: {
  before: [LoggingMiddleware, PermissionMiddleware, CooldownMiddleware],
  after: [ErrorMiddleware],
}
```

---

## 📱 Interactive UI

### Response Types

- **ReplyResponder**: Simple replies
- **ActionResponder**: Loading states with follow-ups
- **PaginatedResponder**: Multi-page content with navigation
- **DmResponder**: Direct messages to users

### Components

- **Buttons**: Interactive buttons with routing
- **Pagination**: Navigate through multiple pages
- **Embeds**: Rich, styled messages

---

## 🎨 Utilities

### Embed Factory

```typescript
import { EmbedFactory } from "./Utilities";

// Create styled embeds
const embed = EmbedFactory.CreateSuccess({
  title: "Success!",
  description: "Operation completed",
});
```

### Component Factory

```typescript
import { ComponentFactory } from "./Utilities";

// Create interactive buttons
const buttons = ComponentFactory.CreateHelpSectionButtons(
  sections,
  interactionId,
  currentIndex
);
```

---

## 📊 Logging

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

---

## ⚙️ Events

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

---

## 🛡️ Type Safety

Full TypeScript coverage with proper interfaces:

- Command definitions are type-safe
- Middleware has proper typing
- Responders use strict types
- All utilities are fully typed

---

## 📦 Performance

Built-in optimizations:

- **Command Caching**: Commands cached for 5 minutes
- **Smart Loading**: Only loads what's needed
- **Efficient Rendering**: Reuses components when possible

---

## 📜 Available Scripts

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
