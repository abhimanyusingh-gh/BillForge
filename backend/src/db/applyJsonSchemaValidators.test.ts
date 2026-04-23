/**
 * BE-0 — unit tests for the collMod applier.
 *
 * These tests use a fake `Db` with spy methods — no real Mongo. They verify:
 *   - Every registered model is visited.
 *   - `collMod` is invoked with the correct `$jsonSchema` + level + action.
 *   - Re-applying with the same options is a no-op at the call-shape level
 *     (idempotency — `collMod` replaces validators in place).
 *   - A `NamespaceExists` (code 48) from `createCollection` is swallowed.
 *   - Any other error surfaces as `ok: false` without aborting the batch.
 *
 * A real-Mongo round-trip test (valid integer passes, non-integer warn,
 * pre-validation doc reads) is deferred to the INFRA-1 harness — documented
 * in `jsonSchemaValidators.test.ts`.
 */

import mongoose from "mongoose";
import { applyMinorFieldValidators, REGISTERED_MODEL_NAMES } from "@/db/applyJsonSchemaValidators.js";

// Ensure every registered model is loaded so `mongoose.models[name]` resolves.
import "@/models/invoice/Invoice.js";
import "@/models/bank/BankAccount.js";
import "@/models/bank/BankTransaction.js";
import "@/models/core/TenantUserRole.js";
import "@/models/integration/TenantComplianceConfig.js";
import "@/models/compliance/TdsRateTable.js";

type CommandArg = { collMod: string; validator: { $jsonSchema: unknown }; validationLevel: string; validationAction: string };

function makeFakeDb(overrides: Partial<{ createCollectionError: unknown; commandError: unknown }> = {}) {
  const commandCalls: CommandArg[] = [];
  const createCollectionCalls: string[] = [];
  const db = {
    createCollection: jest.fn(async (name: string) => {
      createCollectionCalls.push(name);
      if (overrides.createCollectionError) throw overrides.createCollectionError;
    }),
    command: jest.fn(async (cmd: CommandArg) => {
      commandCalls.push(cmd);
      if (overrides.commandError) throw overrides.commandError;
      return { ok: 1 };
    })
  } as unknown as Parameters<typeof applyMinorFieldValidators>[0];
  return { db, commandCalls, createCollectionCalls };
}

describe("applyMinorFieldValidators", () => {
  it("invokes collMod once per registered model with the expected shape", async () => {
    const { db, commandCalls } = makeFakeDb();
    const results = await applyMinorFieldValidators(db, { action: "warn", level: "strict" });

    expect(results.length).toBe(REGISTERED_MODEL_NAMES.length);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(commandCalls.length).toBe(REGISTERED_MODEL_NAMES.length);

    for (const cmd of commandCalls) {
      expect(cmd.collMod).toBeTruthy();
      expect(cmd.validationAction).toBe("warn");
      expect(cmd.validationLevel).toBe("strict");
      expect(cmd.validator.$jsonSchema).toMatchObject({ bsonType: "object" });
    }

    const collections = commandCalls.map((c) => c.collMod).sort();
    const expected = REGISTERED_MODEL_NAMES
      .map((name) => mongoose.models[name]?.collection.name)
      .filter(Boolean)
      .sort();
    expect(collections).toEqual(expected);
  });

  it("is idempotent: two back-to-back runs issue the same commands", async () => {
    const first = makeFakeDb();
    await applyMinorFieldValidators(first.db, { action: "warn" });
    const second = makeFakeDb();
    await applyMinorFieldValidators(second.db, { action: "warn" });
    expect(first.commandCalls).toEqual(second.commandCalls);
  });

  it("honors --action=error by flipping validationAction", async () => {
    const { db, commandCalls } = makeFakeDb();
    await applyMinorFieldValidators(db, { action: "error", level: "strict" });
    for (const cmd of commandCalls) {
      expect(cmd.validationAction).toBe("error");
    }
  });

  it("swallows NamespaceExists (code 48) from createCollection", async () => {
    const nsExists = Object.assign(new Error("ns exists"), { code: 48 });
    const { db } = makeFakeDb({ createCollectionError: nsExists });
    const results = await applyMinorFieldValidators(db, { action: "warn" });
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it("surfaces other createCollection errors as ok: false without aborting siblings", async () => {
    const boom = Object.assign(new Error("boom"), { code: 13 }); // Unauthorized
    const { db } = makeFakeDb({ createCollectionError: boom });
    const results = await applyMinorFieldValidators(db, { action: "warn" });
    // All per-collection attempts fail independently; length stays the same.
    expect(results.length).toBe(REGISTERED_MODEL_NAMES.length);
    expect(results.every((r) => !r.ok)).toBe(true);
    for (const r of results) {
      expect(r.errorMessage).toContain("boom");
    }
  });

  it("collects a collMod error per-collection rather than aborting the batch", async () => {
    const boom = new Error("collmod denied");
    const { db, commandCalls } = makeFakeDb({ commandError: boom });
    const results = await applyMinorFieldValidators(db, { action: "warn" });
    expect(commandCalls.length).toBe(REGISTERED_MODEL_NAMES.length);
    expect(results.every((r) => !r.ok)).toBe(true);
  });
});
