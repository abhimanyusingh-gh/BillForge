export type UUID = string & { readonly __brand: unique symbol };

export function toUUID(value: string): UUID {
  return value as UUID;
}
