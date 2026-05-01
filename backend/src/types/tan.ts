import { env } from "@/config/env.js";

export type TAN = string & { readonly __brand: unique symbol };

export const TAN_FORMAT: RegExp = env.TAN_FORMAT_PATTERN;

export function toTAN(value: string): TAN {
  return value as TAN;
}

export function isTAN(value: string): value is TAN {
  return TAN_FORMAT.test(value);
}
