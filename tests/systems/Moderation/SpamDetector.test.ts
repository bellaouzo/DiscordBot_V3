import { describe, expect, it } from "vitest";
import type { TrackedSpamMessage } from "@systems/Moderation/SpamDetector";
import {
  SPAM_SUPPRESS_MS,
  SpamDetector,
} from "@systems/Moderation/SpamDetector";
import {
  ResolveSpamPunishment,
  SPAM_ESCALATION_LADDER,
} from "@systems/Moderation/SpamEscalation";

const thresholds = {
  max_messages: 3,
  window_seconds: 5,
  duplicate_threshold: 3,
  mention_threshold: 4,
};

let nextId = 0;
function Msg(overrides: Partial<TrackedSpamMessage> = {}): TrackedSpamMessage {
  nextId += 1;
  return {
    guildId: "g1",
    userId: "u1",
    channelId: "c1",
    messageId: `m${nextId}`,
    content: `hello ${nextId}`,
    mentionCount: 0,
    at: 0,
    ...overrides,
  };
}

describe("SpamDetector", () => {
  it("flags floods only when the window limit is exceeded", () => {
    const detector = new SpamDetector();
    for (let i = 0; i < 3; i++) {
      expect(detector.Check(Msg({ at: i * 100 }), thresholds).kind).toBe(
        "clean",
      );
    }
    const result = detector.Check(Msg({ at: 400 }), thresholds);
    expect(result).toMatchObject({ kind: "violation", reason: "flood" });
    if (result.kind === "violation") {
      expect(result.messages).toHaveLength(4);
    }
  });

  it("ignores messages spread outside the flood window", () => {
    const detector = new SpamDetector();
    for (let i = 0; i < 10; i++) {
      expect(detector.Check(Msg({ at: i * 2000 }), thresholds).kind).toBe(
        "clean",
      );
    }
  });

  it("flags repeated identical messages, ignoring case and spacing", () => {
    const detector = new SpamDetector();
    detector.Check(Msg({ content: "Buy now", at: 0 }), thresholds);
    detector.Check(Msg({ content: "buy   now", at: 6000 }), thresholds);
    const result = detector.Check(
      Msg({ content: " BUY NOW ", at: 12000 }),
      thresholds,
    );
    expect(result).toMatchObject({ kind: "violation", reason: "duplicate" });
  });

  it("does not treat empty (attachment-only) messages as duplicates", () => {
    const detector = new SpamDetector();
    for (let i = 0; i < 5; i++) {
      expect(
        detector.Check(Msg({ content: "", at: i * 6000 }), thresholds).kind,
      ).toBe("clean");
    }
  });

  it("flags mass mentions in a single message", () => {
    const detector = new SpamDetector();
    expect(detector.Check(Msg({ mentionCount: 4 }), thresholds)).toMatchObject({
      kind: "violation",
      reason: "mentions",
    });
  });

  it("suppresses the rest of a burst instead of adding more strikes", () => {
    const detector = new SpamDetector();
    detector.Check(Msg({ mentionCount: 10, at: 0 }), thresholds);
    expect(detector.Check(Msg({ at: 100 }), thresholds).kind).toBe(
      "suppressed",
    );
    expect(
      detector.Check(Msg({ at: SPAM_SUPPRESS_MS + 1 }), thresholds).kind,
    ).toBe("clean");
  });

  it("tracks members separately and can be reset", () => {
    const detector = new SpamDetector();
    detector.Check(Msg({ mentionCount: 10 }), thresholds);
    expect(detector.Check(Msg({ userId: "u2", at: 1 }), thresholds).kind).toBe(
      "clean",
    );
    detector.Reset("g1", "u1");
    expect(detector.Check(Msg({ at: 2 }), thresholds).kind).toBe("clean");
  });
});

describe("ResolveSpamPunishment", () => {
  it("escalates and repeats the final step", () => {
    expect(ResolveSpamPunishment(1).action).toBe("warn");
    expect(ResolveSpamPunishment(2).durationMs).toBe(10 * 60 * 1000);
    expect(ResolveSpamPunishment(3).durationMs).toBe(60 * 60 * 1000);
    const last = SPAM_ESCALATION_LADDER[SPAM_ESCALATION_LADDER.length - 1];
    expect(ResolveSpamPunishment(4)).toBe(last);
    expect(ResolveSpamPunishment(99)).toBe(last);
  });
});
