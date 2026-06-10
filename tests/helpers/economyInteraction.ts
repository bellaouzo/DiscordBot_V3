import { type ButtonInteraction, type User } from "discord.js";
import { type ResponderSet } from "@responders";
import { vi } from "vitest";

export interface CapturedButtonRegistration {
  customId: string;
  ownerId: string;
  handler: (interaction: ButtonInteraction) => void | Promise<void>;
  dispose: ReturnType<typeof vi.fn>;
}

export function captureButtonHandlers(
  componentRouter: ResponderSet["componentRouter"],
): CapturedButtonRegistration[] {
  const captured: CapturedButtonRegistration[] = [];
  vi.mocked(componentRouter.RegisterButton).mockImplementation((opts) => {
    const customId = `captured-btn-${captured.length}`;
    const dispose = vi.fn();
    captured.push({
      customId,
      ownerId: opts.ownerId,
      handler: opts.handler,
      dispose,
    });
    return { customId, dispose };
  });
  return captured;
}

export function createMockButtonInteraction(options: {
  userId: string;
  customId?: string;
  id?: string;
}): ButtonInteraction {
  return {
    id: options.id ?? "btn-interaction-1",
    user: { id: options.userId } as User,
    customId: options.customId ?? "captured-btn-0",
  } as unknown as ButtonInteraction;
}

export async function invokeRegisteredButton(
  captured: CapturedButtonRegistration[],
  indexOrCustomId: number | string,
  interaction?: ButtonInteraction,
): Promise<void> {
  const registration =
    typeof indexOrCustomId === "number"
      ? captured[indexOrCustomId]
      : captured.find((entry) => entry.customId === indexOrCustomId);

  if (!registration) {
    throw new Error(`Button handler not found: ${indexOrCustomId}`);
  }

  const buttonInteraction =
    interaction ??
    createMockButtonInteraction({
      userId: registration.ownerId,
      customId: registration.customId,
    });

  await registration.handler(buttonInteraction);
}

export function createEconomyGameSetup(databases: ReturnType<
  typeof import("./mocks").createMockDatabaseSet
>) {
  vi.mocked(databases.userDb.EnsureBalance).mockReturnValue({
    user_id: "u1",
    guild_id: "g1",
    balance: 500,
    updated_at: Date.now(),
  });
  vi.mocked(databases.userDb.AdjustBalance).mockImplementation((opts) => ({
    user_id: opts.user_id,
    guild_id: opts.guild_id ?? "g1",
    balance: 500 + (opts.delta ?? 0),
    updated_at: Date.now(),
  }));
  vi.mocked(databases.userDb.GetInventory).mockReturnValue([]);
}
