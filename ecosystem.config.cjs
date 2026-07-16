module.exports = {
  apps: [
    {
      name: "discord_bot",
      script: "dist/index.js",
      cwd: ".",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        // Wall-clock formatting (toLocaleString, Date.parse without Z) follows this.
        // Override in the host environment if the bot should use a different zone.
        TZ: "America/Denver",
      },
    },
  ],
};
