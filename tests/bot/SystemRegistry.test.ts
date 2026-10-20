import { describe, expect, it } from "vitest";
import { LoadSystemRegistrars } from "../../src/Bootstrap/SystemRegistry";

describe("SystemRegistry", () => {
  it("discovers every *Registrar.ts file", async () => {
    const registrars = await LoadSystemRegistrars();
    const names = registrars.map((registrar) => registrar.name).sort();

    expect(names).toEqual(["appeals", "tickets", "verification"]);
  });
});
