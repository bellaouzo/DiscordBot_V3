import { APIApplicationCommandOptionChoice } from "discord.js";

export const THIS_CONFIG = {
  yesNoChoices: [
    { name: "Yes", value: "yes" },
    { name: "No", value: "no" },
  ] as APIApplicationCommandOptionChoice<string>[],
  onOffChoices: [
    { name: "On", value: "on" },
    { name: "Off", value: "off" },
  ] as APIApplicationCommandOptionChoice<string>[],
  visibilityChoices: [
    { name: "Public", value: "public" },
    { name: "Private", value: "private" },
    { name: "Hidden", value: "hidden" },
  ] as APIApplicationCommandOptionChoice<string>[],
};

