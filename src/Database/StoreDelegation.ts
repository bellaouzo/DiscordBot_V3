/**
 * The public methods of a store, as they appear on its database facade.
 */
export type StoreMethods<T> = {
  [K in keyof T as T[K] extends (...args: never[]) => unknown
    ? K
    : never]: T[K];
};

/**
 * Exposes every public method of each store directly on the facade, bound to its store,
 * so a new store method is callable as `facade.Method(...)` without a pass-through.
 * Pair with an interface merge (`interface XDatabase extends StoreMethods<YStore> {}`) for types.
 *
 * @throws If two stores, or a store and the facade, define the same method name.
 */
export function DelegateStoreMethods(
  facade: object,
  stores: readonly object[],
): void {
  const owners = new Map<string, string>();

  for (const store of stores) {
    const storeName = store.constructor.name;
    const prototype = Object.getPrototypeOf(store) as object;

    for (const name of Object.getOwnPropertyNames(prototype)) {
      const member = (store as Record<string, unknown>)[name];
      if (name === "constructor" || typeof member !== "function") {
        continue;
      }

      const owner = owners.get(name);
      if (owner || name in facade) {
        throw new Error(
          `${facade.constructor.name}: method "${name}" from ${storeName} collides with ${owner ?? "the facade"}`,
        );
      }

      owners.set(name, storeName);
      Object.defineProperty(facade, name, {
        value: member.bind(store),
        enumerable: false,
      });
    }
  }
}
