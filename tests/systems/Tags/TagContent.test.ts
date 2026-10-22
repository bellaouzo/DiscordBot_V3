import { describe, expect, it } from "vitest";
import {
  ParseTagTrigger,
  RenderTagContent,
  TAG_CONTENT_MAX_LENGTH,
  TagAllowedMentions,
  ValidateTagName,
  ValidateTagPrefix,
} from "@systems/Tags/TagContent";

describe("TagContent", () => {
  it("validates tag names", () => {
    expect(ValidateTagName("rules")).toBeNull();
    expect(ValidateTagName("faq_2-new")).toBeNull();
    expect(ValidateTagName("")).not.toBeNull();
    expect(ValidateTagName("-bad")).not.toBeNull();
    expect(ValidateTagName("has space")).not.toBeNull();
    expect(ValidateTagName("a".repeat(33))).not.toBeNull();
  });

  it("validates prefixes", () => {
    expect(ValidateTagPrefix("!")).toBeNull();
    expect(ValidateTagPrefix("off")).toBeNull();
    expect(ValidateTagPrefix("/")).not.toBeNull();
    expect(ValidateTagPrefix("! ")).not.toBeNull();
    expect(ValidateTagPrefix("toolong")).not.toBeNull();
  });

  it("parses chat triggers", () => {
    expect(ParseTagTrigger("!Rules please", "!")).toBe("rules");
    expect(ParseTagTrigger("?faq", "?")).toBe("faq");
    expect(ParseTagTrigger("rules", "!")).toBeNull();
    expect(ParseTagTrigger("!", "!")).toBeNull();
    expect(ParseTagTrigger("!rules", "off")).toBeNull();
  });

  it("renders placeholders and caps length", () => {
    const context = {
      userId: "42",
      guildName: "Cafe",
      channelId: "7",
      memberCount: 1234,
    };
    expect(
      RenderTagContent(
        "Hi {user}, welcome to {server} in {channel} ({membercount}) {user}",
        context,
      ),
    ).toBe("Hi <@42>, welcome to Cafe in <#7> (1,234) <@42>");
    expect(RenderTagContent("{server}".repeat(600), context)).toHaveLength(
      TAG_CONTENT_MAX_LENGTH,
    );
  });

  it("only allows the invoking user to be pinged", () => {
    expect(TagAllowedMentions("42")).toEqual({ parse: [], users: ["42"] });
  });
});
