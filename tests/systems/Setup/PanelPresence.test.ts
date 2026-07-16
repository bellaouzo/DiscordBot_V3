import { describe, expect, it, vi } from "vitest";
import { ChannelHasPanelButton } from "@systems/Setup/panels/PanelPresence";

describe("PanelPresence", () => {
  it("detects a matching panel button in recent messages", async () => {
    const channel = {
      messages: {
        fetch: vi.fn().mockResolvedValue(
          new Map([
            [
              "msg-1",
              {
                components: [
                  {
                    components: [{ customId: "ticket-panel:create" }],
                  },
                ],
              },
            ],
          ]),
        ),
      },
    } as never;

    await expect(
      ChannelHasPanelButton(channel, ["ticket-panel:create"]),
    ).resolves.toBe(true);
  });

  it("returns false when no matching button exists", async () => {
    const channel = {
      messages: {
        fetch: vi.fn().mockResolvedValue(
          new Map([
            [
              "msg-1",
              {
                components: [
                  {
                    components: [{ customId: "other-button" }],
                  },
                ],
              },
            ],
          ]),
        ),
      },
    } as never;

    await expect(
      ChannelHasPanelButton(channel, ["ticket-panel:create"]),
    ).resolves.toBe(false);
  });
});
