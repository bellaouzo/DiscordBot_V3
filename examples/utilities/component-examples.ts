import { ComponentFactory } from "../../src/Utilities";
import { ButtonStyle } from "discord.js";

/**
 * Examples of using the ComponentFactory utility
 * Shows different ways to create interactive Discord components
 */

// Basic button
export const basicButton = ComponentFactory.CreateButton({
  label: "Click Me!",
  customId: "basic-button",
  style: ButtonStyle.Primary,
  emoji: "👍",
});

// Disabled button
export const disabledButton = ComponentFactory.CreateButton({
  label: "Can't Click",
  customId: "disabled-button",
  style: ButtonStyle.Secondary,
  disabled: true,
});

// Danger button
export const dangerButton = ComponentFactory.CreateButton({
  label: "Delete",
  customId: "delete-button",
  style: ButtonStyle.Danger,
  emoji: "🗑️",
});

// Action row with multiple buttons
export const buttonRow = ComponentFactory.CreateActionRow({
  buttons: [
    { label: "First", style: ButtonStyle.Primary },
    { label: "Second", style: ButtonStyle.Secondary },
    { label: "Third", style: ButtonStyle.Success },
  ],
  customIds: ["btn-1", "btn-2", "btn-3"],
});

// Help section buttons (for navigation)
export const helpButtons = ComponentFactory.CreateHelpSectionButtons(
  [
    { name: "Overview" },
    { name: "Utility" },
    { name: "Moderation" },
    { name: "Admin" },
  ],
  "interaction-123",
  0 // Current section index
);

// Pagination buttons
export const paginationButtons = ComponentFactory.CreatePaginationButtons(
  2, // Current page (0-indexed)
  5, // Total pages
  "interaction-456"
);

// Multiple rows example
export const multiRowButtons = [
  ComponentFactory.CreateActionRow({
    buttons: [
      { label: "Row 1 - Button 1", style: ButtonStyle.Primary },
      { label: "Row 1 - Button 2", style: ButtonStyle.Secondary },
    ],
    customIds: ["row1-btn1", "row1-btn2"],
  }),
  ComponentFactory.CreateActionRow({
    buttons: [
      { label: "Row 2 - Button 1", style: ButtonStyle.Success },
      { label: "Row 2 - Button 2", style: ButtonStyle.Danger },
    ],
    customIds: ["row2-btn1", "row2-btn2"],
  }),
];
