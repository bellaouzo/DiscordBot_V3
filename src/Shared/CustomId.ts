/**
 * Typed custom IDs for persistent components (buttons that must survive a restart).
 * One definition gives the router prefix, a builder and a parser that always agree:
 *
 *   const ClaimId = DefineCustomId("ticket:claim", { ticketId: "int" });
 *   ClaimId.Build({ ticketId: 12 })      // "ticket:claim:12"
 *   ClaimId.Parse("ticket:claim:12")     // { ticketId: 12 }
 *   router.RegisterButtonPrefix(ClaimId.prefix, { handler })
 */
export type CustomIdFieldType = "int" | "string";

type FieldValue<T extends CustomIdFieldType> = T extends "int"
  ? number
  : string;

export type CustomIdValues<F extends Record<string, CustomIdFieldType>> = {
  [K in keyof F]: FieldValue<F[K]>;
};

export interface CustomIdCodec<F extends Record<string, CustomIdFieldType>> {
  /** `namespace:` — register this with `RegisterButtonPrefix`. */
  readonly prefix: string;
  Build(values: CustomIdValues<F>): string;
  /** Returns null when the ID belongs to another component or is malformed. */
  Parse(customId: string): CustomIdValues<F> | null;
}

const SEPARATOR = ":";
const INT_PATTERN = /^\d+$/;
/** Discord's limit on component custom IDs. */
const MAX_CUSTOM_ID_LENGTH = 100;

export function DefineCustomId<F extends Record<string, CustomIdFieldType>>(
  namespace: string,
  fields: F,
): CustomIdCodec<F> {
  const prefix = `${namespace}${SEPARATOR}`;
  const fieldNames = Object.keys(fields) as Array<keyof F & string>;

  return {
    prefix,

    Build(values) {
      const parts = fieldNames.map((name) => {
        const value = String(values[name]);
        if (value.includes(SEPARATOR)) {
          throw new Error(
            `Custom ID field "${name}" must not contain "${SEPARATOR}"`,
          );
        }
        return value;
      });
      const customId = prefix + parts.join(SEPARATOR);
      if (customId.length > MAX_CUSTOM_ID_LENGTH) {
        throw new Error(`Custom ID exceeds ${MAX_CUSTOM_ID_LENGTH} characters`);
      }
      return customId;
    },

    Parse(customId) {
      if (!customId.startsWith(prefix)) {
        return null;
      }
      const parts = customId.slice(prefix.length).split(SEPARATOR);
      if (parts.length !== fieldNames.length) {
        return null;
      }

      const values: Record<string, string | number> = {};
      for (const [index, name] of fieldNames.entries()) {
        const raw = parts[index];
        if (fields[name] === "int") {
          if (!INT_PATTERN.test(raw)) {
            return null;
          }
          values[name] = Number.parseInt(raw, 10);
        } else {
          if (raw.length === 0) {
            return null;
          }
          values[name] = raw;
        }
      }
      return values as CustomIdValues<F>;
    },
  };
}
