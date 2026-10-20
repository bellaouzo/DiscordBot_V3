import { describe, expect, it } from "vitest";
import { DelegateStoreMethods } from "@database/StoreDelegation";

class CounterStore {
  private count = 0;
  Increment(by: number): number {
    this.count += by;
    return this.count;
  }
}

class GreetingStore {
  Greet(name: string): string {
    return `hi ${name}`;
  }
}

describe("DelegateStoreMethods", () => {
  it("exposes store methods on the facade, bound to their store", () => {
    const facade = {} as {
      Increment(by: number): number;
      Greet(n: string): string;
    };
    DelegateStoreMethods(facade, [new CounterStore(), new GreetingStore()]);

    const { Increment } = facade;
    expect(Increment(2)).toBe(2);
    expect(facade.Increment(3)).toBe(5);
    expect(facade.Greet("bot")).toBe("hi bot");
  });

  it("throws when two stores define the same method", () => {
    expect(() =>
      DelegateStoreMethods({}, [new GreetingStore(), new GreetingStore()]),
    ).toThrow(/Greet.*collides/);
  });

  it("throws when a store method shadows a facade method", () => {
    class Facade {
      Greet(): string {
        return "facade";
      }
    }
    expect(() =>
      DelegateStoreMethods(new Facade(), [new GreetingStore()]),
    ).toThrow(/collides with the facade/);
  });
});
