import { Events } from "discord.js";
import { CreateEvent } from "../EventFactory";

export const ReadyEvent = CreateEvent({
  name: Events.ClientReady,
  once: true,
  execute: async () => {
    // Ready event acknowledged; no verbose logging.
  },
});
