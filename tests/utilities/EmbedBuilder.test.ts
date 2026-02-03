import { describe, it, expect } from "vitest";
import { EmbedFactory } from "@utilities/EmbedBuilder";

describe("EmbedFactory", () => {
  describe("Create", () => {
    it("returns embed with default color and timestamp", () => {
      const embed = EmbedFactory.Create({});
      const data = embed.toJSON();
      expect(data.timestamp).toBeDefined();
      expect(data.color).toBe(0x5865f2);
    });

    it("applies title and description", () => {
      const embed = EmbedFactory.Create({
        title: "Test",
        description: "Desc",
      });
      const data = embed.toJSON();
      expect(data.title).toBe("Test");
      expect(data.description).toBe("Desc");
    });

    it("applies custom color", () => {
      const embed = EmbedFactory.Create({ color: 0xffffff });
      const data = embed.toJSON();
      expect(data.color).toBe(0xffffff);
    });

    it("applies footer", () => {
      const embed = EmbedFactory.Create({ footer: "Footer text" });
      const data = embed.toJSON();
      expect(data.footer?.text).toBe("Footer text");
    });

    it("can disable timestamp", () => {
      const embed = EmbedFactory.Create({ timestamp: false });
      const data = embed.toJSON();
      expect(data.timestamp).toBeFalsy();
    });
  });

  describe("CreateSuccess", () => {
    it("uses success color", () => {
      const embed = EmbedFactory.CreateSuccess({ title: "OK" });
      const data = embed.toJSON();
      expect(data.color).toBe(0x57f287);
      expect(data.title).toBe("OK");
    });
  });

  describe("CreateWarning", () => {
    it("uses warning color", () => {
      const embed = EmbedFactory.CreateWarning({ title: "Careful" });
      const data = embed.toJSON();
      expect(data.color).toBe(0xfee75c);
    });
  });

  describe("CreateError", () => {
    it("uses error color", () => {
      const embed = EmbedFactory.CreateError({ title: "Error" });
      const data = embed.toJSON();
      expect(data.color).toBe(0xed4245);
    });
  });

  describe("CreateHelpSection", () => {
    it("formats section title and footer", () => {
      const embed = EmbedFactory.CreateHelpSection("Fun", "Fun commands", 5);
      const data = embed.toJSON();
      expect(data.title).toBe("📁 Fun Commands");
      expect(data.description).toBe("Fun commands");
      expect(data.footer?.text).toBe("5 commands available");
    });

    it("uses singular when command count is 1", () => {
      const embed = EmbedFactory.CreateHelpSection("Utility", "One", 1);
      expect(embed.toJSON().footer?.text).toBe("1 command available");
    });
  });

  describe("CreateHelpOverview", () => {
    it("sets overview title and footer", () => {
      const embed = EmbedFactory.CreateHelpOverview(10, 3);
      const data = embed.toJSON();
      expect(data.title).toBe("🤖 Bot Command Overview");
      expect(data.footer?.text).toBe("Total: 10 commands across 3 categories");
    });
  });

  describe("CreateTicketList", () => {
    it("shows empty message when no tickets", () => {
      const embed = EmbedFactory.CreateTicketList([]);
      const data = embed.toJSON();
      expect(data.description).toContain("no tickets");
    });

    it("lists tickets when provided", () => {
      const embed = EmbedFactory.CreateTicketList([
        {
          id: 1,
          category: "support",
          status: "open",
          created_at: Date.now(),
        },
      ]);
      const data = embed.toJSON();
      expect(data.fields?.length).toBe(1);
      expect(data.fields?.[0].value).toContain("Ticket #1");
    });
  });

  describe("CreateTicketClosed", () => {
    it("includes ticket id and closer", () => {
      const embed = EmbedFactory.CreateTicketClosed(2, "user123");
      const data = embed.toJSON();
      expect(data.description).toContain("#2");
      expect(data.description).toContain("<@user123>");
    });
  });

  describe("CreateTicketClaimed", () => {
    it("includes ticket id and claimer", () => {
      const embed = EmbedFactory.CreateTicketClaimed(3, "staff456");
      const data = embed.toJSON();
      expect(data.description).toContain("#3");
      expect(data.description).toContain("<@staff456>");
    });
  });
});
