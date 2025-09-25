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
  A powerful, modern, and easy-to-use Discord bot foundation.
</p>

---

## ✨ Features

- **Modern Tech:** Built with **TypeScript** and **Discord.js v14**.
- **Slash Commands:** Full support for Discord's interactive slash commands with automatic deployment.
- **Modular Architecture:** Clean, organized project structure with command groups (utility, moderation).
- **Middleware System:** Built-in middleware for logging, permissions, cooldowns, and error handling.
- **Command Factory:** Easy-to-use command factory with automatic slash command building.
- **Response System:** Multiple response types including replies, follow-ups, DMs, and actions.
- **Secure Configuration:** Environment-based configuration with automatic .env loading.
- **Ready to Go:** Includes sample `ping` and `kick` commands to get you started instantly.

---

## 🚀 Getting Started

Ready to launch your own bot? Here’s how to get it running.

### ✅ Prerequisites

- [**Node.js**](https://nodejs.org/en/) (v16 or higher).
- A **Discord Account** and a server where you have admin rights.
- A **Git client** (or you can download the code as a ZIP).

### 🛠️ Installation & Setup

1.  **Get the Code:**
    Open your terminal and run this command:

    ```bash
    git clone <repository_url>
    cd discord-bot-v3
    ```

2.  **Install Dependencies:**
    This command downloads all the necessary libraries the bot needs to work.

    ```bash
    npm install
    ```

3.  **Configure Your Bot:**
    Create a new file named `.env` in the project's root folder. This file will hold your bot's secrets.

    > **Important:** Never share the contents of this file with anyone!

    Copy and paste the following into your `.env` file, replacing the placeholders with your actual bot information:

    ```env
    # You can get these from the Discord Developer Portal
    DISCORD_TOKEN=your_discord_bot_token_here
    CLIENT_ID=your_bot_client_id_here
    GUILD_ID=your_test_server_id_here
    ```

    **Getting Your Bot Token & IDs:**

    - Visit the [Discord Developer Portal](https://discord.com/developers/applications)
    - Create a new application or select an existing one
    - Go to the "Bot" section to get your `DISCORD_TOKEN`
    - Go to the "General Information" section to get your `CLIENT_ID`
    - For `GUILD_ID`, right-click your test server and select "Copy Server ID"

### ▶️ Running the Bot

You have two options for running the bot:

- **For Developers (`dev` mode):**
  This mode automatically restarts the bot when you change the code. Perfect for when you're adding new features!

  ```bash
  npm run dev
  ```

- **For Everyday Use (`start` mode):**
  This runs the bot in a stable mode, ready to serve your community.
  ```bash
  npm run build
  npm start
  ```

---

## 🧩 Adding New Commands

Adding your own custom commands is super simple using the CommandFactory.

1.  **Create a Command File:**
    In the `src/Commands/utility/` folder (or create a new group folder), create a new file. Let's call it `HelloCommand.ts`.

2.  **Write the Command Code:**
    Here's a simple "hello" command using the CommandFactory pattern:

    ```typescript
    import { ChatInputCommandInteraction } from "discord.js";
    import { CommandContext, CreateCommand } from "../CommandFactory";
    import { LoggingMiddleware } from "../Middleware/LoggingMiddleware";
    import { Config } from "../Middleware/CommandConfig";

    async function ExecuteHello(
      interaction: ChatInputCommandInteraction,
      context: CommandContext
    ): Promise<void> {
      const { replyResponder } = context.responders;
      const { logger } = context;

      logger.Info("Hello command executed", { user: interaction.user.id });
      await replyResponder.Send(interaction, "Hello! 👋");
    }

    export const HelloCommand = CreateCommand({
      name: "hello",
      description: "Replies with Hello!",
      group: "utility",
      middleware: {
        before: [LoggingMiddleware],
      },
      config: Config.utility(1),
      execute: ExecuteHello,
    });
    ```

3.  **Export Your Command:**
    Open `src/Commands/utility/index.ts` and add your command:
    ```typescript
    export * from "./PingCommand";
    export * from "./HelloCommand"; // Add this line!
    ```
    The bot will automatically pick it up and deploy it. That's it!

---

## 📜 Available Scripts

Here's a list of all the useful scripts you can run from your terminal.

| Command         | Description                                           |
| --------------- | ----------------------------------------------------- |
| `npm run dev`   | Compiles TypeScript and starts the bot (development). |
| `npm run build` | Compiles the TypeScript code into JavaScript.         |
| `npm start`     | Runs the compiled bot (for production).               |
| `npm run b`     | Short alias for `npm run build`.                      |
| `npm run s`     | Short alias for `npm start`.                          |
| `npm run clean` | Deletes the compiled files in the `dist` folder.      |

---

## 🏗️ Architecture

This bot uses a modular, factory-based architecture designed for scalability and maintainability.

### 📁 Project Structure

```
src/
├── Bot/                 # Core bot functionality
├── Commands/            # Command definitions and middleware
│   ├── Middleware/      # Command middleware (logging, permissions, etc.)
│   ├── moderation/      # Moderation commands
│   └── utility/         # Utility commands
├── Config/              # Configuration management
├── Domain/              # Domain models and types
├── Logging/             # Logging utilities
└── Responders/          # Response handling system
```

### 🔧 Middleware System

The bot includes a powerful middleware system for command processing:

- **LoggingMiddleware**: Logs command execution and user interactions
- **PermissionMiddleware**: Validates user permissions for commands
- **CooldownMiddleware**: Prevents command spam with configurable cooldowns
- **ErrorMiddleware**: Handles and logs command errors gracefully

### 📤 Response System

Multiple response types are available for different use cases:

- **ReplyResponder**: Simple replies to interactions
- **ActionResponder**: Replies with loading states and follow-ups
- **DmResponder**: Send direct messages to users
- **FollowUpResponder**: Send additional messages after initial response
- **EditResponder**: Edit existing messages

### ⚙️ Configuration

Commands can be configured with different permission levels and cooldowns:

- `Config.utility(cooldownSeconds)` - For general utility commands
- `Config.moderation(cooldownSeconds)` - For moderation commands requiring permissions

---

## 🤝 Contributing

Got an idea to make this bot even better? Contributions are welcome! Feel free to open an issue or submit a pull request.

## 📝 License

This project is licensed under the **MIT License**. See the `LICENSE` file for details.
