import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "discord.js";
import { HandleWork } from "@systems/Economy/handlers/WorkHandler";
import { HandleFish } from "@systems/Economy/handlers/FishHandler";
import {
  FISH_BITE_MAX_MS,
  FISH_REEL_WINDOW_MS,
  FISH_TIMEOUT_MS,
  WORK_CONSOLATION_REWARD,
  WORK_REWARD_MAX,
  WORK_REWARD_MIN,
  WORK_TIMEOUT_MS,
} from "@systems/Economy/constants";
import {
  captureButtonHandlers,
  createEconomyGameSetup,
  createMockContext,
  createMockDatabaseSet,
  createMockInteraction,
  invokeRegisteredButton,
} from "../../helpers";

const FIXED_TASK = {
  job: "Barista",
  emoji: "☕",
  prompt: "2 lattes at 3 coins each?",
  options: ["5", "7", "6", "8"],
  correctIndex: 2,
};

vi.mock("@systems/Economy/utils/workLogic", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@systems/Economy/utils/workLogic")
  >()),
  GenerateWorkTask: () => FIXED_TASK,
}));

function Setup() {
  const interaction = createMockInteraction({
    guildId: "g1",
    user: { id: "u1" } as unknown as User,
  });
  const databases = createMockDatabaseSet();
  createEconomyGameSetup(databases);
  vi.mocked(databases.userDb.ClaimActivity).mockReturnValue({ success: true });
  const context = createMockContext({ databases });
  const captured = captureButtonHandlers(context.responders.componentRouter);
  return { interaction, databases, context, captured };
}

function LastUpdateEmbedTitle(
  context: ReturnType<typeof createMockContext>,
): string {
  const calls = vi.mocked(context.responders.buttonResponder.Update).mock.calls;
  const options = calls[calls.length - 1][1] as {
    embeds: Array<{ title: string }>;
  };
  return options.embeds[0].title;
}

describe("work and fish activities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refuses to start while the activity is on cooldown", async () => {
    const { interaction, databases, context } = Setup();
    vi.mocked(databases.userDb.ClaimActivity).mockReturnValue({
      success: false,
      nextAvailableAt: Date.now() + 1000,
    });

    await HandleWork(interaction, context);
    await HandleFish(interaction, context);

    const replies = vi.mocked(context.responders.interactionResponder.Reply)
      .mock.calls;
    expect(replies).toHaveLength(2);
    replies.forEach(([, options]) =>
      expect(
        (options as { embeds: Array<{ title: string }> }).embeds[0].title,
      ).toBe("⏳ Not Ready Yet"),
    );
    expect(databases.userDb.AdjustBalance).not.toHaveBeenCalled();
  });

  it("pays the full reward for the correct answer", async () => {
    const { interaction, databases, context, captured } = Setup();
    await HandleWork(interaction, context);
    expect(captured).toHaveLength(4);

    await invokeRegisteredButton(captured, FIXED_TASK.correctIndex);

    const delta = vi.mocked(databases.userDb.AdjustBalance).mock.calls[0][0]
      .delta;
    expect(delta).toBeGreaterThanOrEqual(WORK_REWARD_MIN);
    expect(delta).toBeLessThanOrEqual(WORK_REWARD_MAX);
    expect(LastUpdateEmbedTitle(context)).toMatch(/Great Work/);
  });

  it("pays a consolation reward for a wrong answer, once", async () => {
    const { interaction, databases, context, captured } = Setup();
    await HandleWork(interaction, context);

    await invokeRegisteredButton(captured, 0);
    await invokeRegisteredButton(captured, 1);

    expect(databases.userDb.AdjustBalance).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(databases.userDb.AdjustBalance).mock.calls[0][0].delta,
    ).toBe(WORK_CONSOLATION_REWARD);
    expect(LastUpdateEmbedTitle(context)).toMatch(/Not Quite/);
  });

  it("gives the work shift back when it times out unanswered", async () => {
    const { interaction, databases, context } = Setup();
    await HandleWork(interaction, context);
    await vi.advanceTimersByTimeAsync(WORK_TIMEOUT_MS + 1);
    expect(databases.userDb.ReleaseActivity).toHaveBeenCalledWith(
      "u1",
      "g1",
      "work",
    );
    expect(databases.userDb.AdjustBalance).not.toHaveBeenCalled();
  });

  it("catches a fish when reeling after the bite", async () => {
    const { interaction, databases, context, captured } = Setup();
    await HandleFish(interaction, context);
    expect(captured).toHaveLength(1);

    await invokeRegisteredButton(captured, 0); // cast
    expect(captured).toHaveLength(2); // reel registered at cast time
    await vi.advanceTimersByTimeAsync(FISH_BITE_MAX_MS + 1);
    await invokeRegisteredButton(captured, 1); // reel

    expect(databases.userDb.AdjustBalance).toHaveBeenCalledWith(
      expect.objectContaining({ delta: expect.any(Number) }),
    );
    expect(LastUpdateEmbedTitle(context)).toMatch(/You Caught/);
  });

  it("scares the fish away when reeling before the bite", async () => {
    const { interaction, databases, context, captured } = Setup();
    await HandleFish(interaction, context);
    await invokeRegisteredButton(captured, 0);
    await invokeRegisteredButton(captured, 1);

    expect(databases.userDb.AdjustBalance).not.toHaveBeenCalled();
    expect(LastUpdateEmbedTitle(context)).toBe("💦 Too Early!");
    // No late bite edit after the trip ended.
    const edits = vi.mocked(interaction.editReply).mock.calls.length;
    await vi.advanceTimersByTimeAsync(FISH_BITE_MAX_MS + FISH_REEL_WINDOW_MS);
    expect(vi.mocked(interaction.editReply).mock.calls.length).toBe(edits);
  });

  it("lets the fish escape when the reel window passes", async () => {
    const { interaction, databases, context, captured } = Setup();
    await HandleFish(interaction, context);
    await invokeRegisteredButton(captured, 0);
    await vi.advanceTimersByTimeAsync(
      FISH_BITE_MAX_MS + FISH_REEL_WINDOW_MS + 1,
    );

    expect(databases.userDb.AdjustBalance).not.toHaveBeenCalled();
    const lastEdit = vi
      .mocked(interaction.editReply)
      .mock.calls.at(-1)?.[0] as {
      embeds: Array<{ title: string }>;
    };
    expect(lastEdit.embeds[0].title).toBe("🐟 It Got Away");
  });

  it("gives the fishing spot back when the line is never cast", async () => {
    const { interaction, databases, context } = Setup();
    await HandleFish(interaction, context);
    await vi.advanceTimersByTimeAsync(FISH_TIMEOUT_MS + 1);
    expect(databases.userDb.ReleaseActivity).toHaveBeenCalledWith(
      "u1",
      "g1",
      "fish",
    );
  });
});
