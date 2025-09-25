import { EmbedFactory } from "../../src/Utilities/EmbedBuilder";

/**
 * Examples of using the EmbedFactory utility
 * Shows different ways to create rich Discord embeds
 */

// Basic embed
export const basicEmbed = EmbedFactory.Create({
  title: "Welcome!",
  description: "Thanks for using our bot",
  color: 0x5865f2, // Discord blurple
});

// Success embed (predefined green color)
export const successEmbed = EmbedFactory.CreateSuccess({
  title: "✅ Success!",
  description: "Operation completed successfully",
});

// Warning embed (predefined yellow color)
export const warningEmbed = EmbedFactory.CreateWarning({
  title: "⚠️ Warning",
  description: "Please be careful with this action",
});

// Error embed (predefined red color)
export const errorEmbed = EmbedFactory.CreateError({
  title: "❌ Error",
  description: "Something went wrong",
  hint: "Try again in a few minutes",
});

// Help section embed
export const helpEmbed = EmbedFactory.CreateHelpSection(
  "Utility Commands",
  "General purpose commands for everyday use",
  5
);

// Overview embed
export const overviewEmbed = EmbedFactory.CreateHelpOverview(15, 3);

// Rich embed with fields
export const richEmbed = EmbedFactory.Create({
  title: "Server Information",
  description: "Here's some info about this server",
  color: 0x00ff00,
  thumbnail: "https://example.com/thumbnail.png",
  image: "https://example.com/image.png",
  footer: "Last updated",
  timestamp: true,
});

// Add fields to embed
richEmbed.addFields(
  { name: "Members", value: "1,234", inline: true },
  { name: "Channels", value: "45", inline: true },
  { name: "Created", value: "January 1, 2020", inline: true }
);
