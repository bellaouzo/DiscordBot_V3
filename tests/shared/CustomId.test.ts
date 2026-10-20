import { describe, expect, it } from "vitest";
import { DefineCustomId } from "@shared/CustomId";
import { TicketButtonIds } from "@systems/Ticket/TicketCustomIds";

describe("DefineCustomId", () => {
  const PageId = DefineCustomId("help:page", {
    category: "string",
    page: "int",
  });

  it("builds and parses the same values", () => {
    const customId = PageId.Build({ category: "fun", page: 3 });

    expect(customId).toBe("help:page:fun:3");
    expect(customId.startsWith(PageId.prefix)).toBe(true);
    expect(PageId.Parse(customId)).toEqual({ category: "fun", page: 3 });
  });

  it("rejects IDs from other components or with the wrong shape", () => {
    expect(PageId.Parse("help:other:fun:3")).toBeNull();
    expect(PageId.Parse("help:page:fun")).toBeNull();
    expect(PageId.Parse("help:page:fun:3:extra")).toBeNull();
    expect(PageId.Parse("help:page:fun:three")).toBeNull();
    expect(PageId.Parse("help:page::3")).toBeNull();
  });

  it("refuses values that would break parsing", () => {
    expect(() => PageId.Build({ category: "a:b", page: 1 })).toThrow();
  });

  it("refuses IDs longer than Discord allows", () => {
    expect(() => PageId.Build({ category: "x".repeat(100), page: 1 })).toThrow(
      /100/,
    );
  });
});

describe("TicketButtonIds", () => {
  it("keeps the ticket button format stored on existing messages", () => {
    expect(TicketButtonIds.claim.Build({ ticketId: 42 })).toBe(
      "ticket:claim:42",
    );
    expect(TicketButtonIds.close.prefix).toBe("ticket:close:");
    expect(TicketButtonIds.add.Parse("ticket:add:7")).toEqual({ ticketId: 7 });
    expect(TicketButtonIds.add.Parse("ticket:remove:7")).toBeNull();
  });
});
