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

*   **Modern Tech:** Built with **TypeScript** and **Discord.js v14**.
*   **Slash Commands:** Full support for Discord's interactive slash commands.
*   **Clean Code:** A well-organized project structure that's easy to extend.
*   **Secure:** Manages your bot's secret token safely using environment variables.
*   **Ready to Go:** Includes a sample `ping` command to get you started instantly.

---

## 🚀 Getting Started

Ready to launch your own bot? Here’s how to get it running.

### ✅ Prerequisites

*   [**Node.js**](https://nodejs.org/en/) (v16 or higher).
*   A **Discord Account** and a server where you have admin rights.
*   A **Git client** (or you can download the code as a ZIP).

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
    GUILD_ID=your_server_id_here
    ```

### ▶️ Running the Bot

You have two options for running the bot:

*   **For Developers (`dev` mode):**
    This mode automatically restarts the bot when you change the code. Perfect for when you're adding new features!
    ```bash
    npm run dev
    ```

*   **For Everyday Use (`start` mode):**
    This runs the bot in a stable mode, ready to serve your community.
    ```bash
    npm run build
    npm start
    ```

---

## 🧩 Adding New Commands

Adding your own custom commands is super simple.

1.  **Create a Command File:**
    In the `src/commands/` folder, create a new file. Let's call it `hello.ts`.

2.  **Write the Command Code:**
    Here's a simple "hello" command. Paste this into your `hello.ts` file:
    ```typescript
    import { SlashCommandBuilder } from 'discord.js';

    // Command metadata
    export const data = new SlashCommandBuilder()
        .setName('hello')
        .setDescription('Replies with Hello!');

    // The function that runs when the command is used
    export async function execute(interaction) {
        await interaction.reply('Hello!');
    }
    ```

3.  **Register Your Command:**
    Open `src/commands/index.ts` and add a line to export your new command:
    ```typescript
    export * as ping from './ping';
    export * as hello from './hello'; // Add this line!
    ```
    The bot will automatically pick it up. That's it!

---

## 📜 Available Scripts

Here's a list of all the useful scripts you can run from your terminal.

| Command         | Description                                        |
| --------------- | -------------------------------------------------- |
| `npm run dev`   | Starts the bot in development mode with auto-reload. |
| `npm run build` | Compiles the TypeScript code into JavaScript.      |
| `npm start`     | Runs the compiled bot (for production).            |
| `npm run clean` | Deletes the compiled files in the `dist` folder.   |

---

## 🤝 Contributing

Got an idea to make this bot even better? Contributions are welcome! Feel free to open an issue or submit a pull request.

## 📝 License

This project is licensed under the **MIT License**. See the `LICENSE` file for details.
