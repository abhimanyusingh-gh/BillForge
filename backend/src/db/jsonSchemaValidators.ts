/**
 * BE-0 — DB-layer defence-in-depth validators for every `*Minor` financial field.
 *
 * Implements D-040 (rigour on compute paths) and constraint C-001 (all `*Minor`
 * fields must be integers — no floating-point currency).
 *
 * This module declares which collections carry which `*Minor` field paths and
 * builds the corresponding MongoDB `$jsonSchema` documents. It is a PURE
 * module: it does not touch the database. See `applyJsonSchemaValidators.ts`
 * for the `collMod` runner.
 *
 * Why `bsonType: ['int', 'long', 'double']` + `multipleOf: 1`?
 *   - Mongoose's plain `Number` schema type writes BSON `double` by default.
 *     Restricting to `['int', 'long']` alone would reject every write our
 *     application currently makes.
 *   - `multipleOf: 1` enforces the integer invariant across all three numeric
 *     subtypes — so 1500000 (double) passes, 1500000.5 (double) fails.
 *   - `null` is accepted for nullable fields (see `nullable: true` below).
 */

export type MinorFieldPath = string;

export interface MinorFieldGroup {
  /** Dot-delimited path to the document subtree holding the listed fields. Use `""` for top-level. */
  prefix: string;
  fields: MinorFieldPath[];
  /** If true, include `null` as an accepted bson type (the Mongoose schemas allow null). */
  nullable?: boolean;
  /** If true, the prefix describes elements of an array of objects. */
  array?: boolean;
}

export interface CollectionValidatorSpec {
  /** Mongoose model name — use with `mongoose.model(name).collection.name` at apply time. */
  modelName: string;
  /** Flat list of groups describing where `*Minor` fields live on the document. */
  groups: MinorFieldGroup[];
}

/**
 * Exhaustive registry. Every entry is backed by a `Minor:` field declaration in
 * the cited Mongoose schema file. Keep in sync with any new `*Minor` fields
 * added to the backend — the unit test `jsonSchemaValidators.test.ts` and the
 * CI reuse audit should catch omissions.
 *
 * Sources:
 *   - backend/src/models/invoice/Invoice.ts                 (lines 119, 178, 189-194, 205, 207-209, 271-272, 318)
 *   - backend/src/models/invoice/ApprovalWorkflow.ts        (references `totalAmountMinor`/`tdsAmountMinor` in ConditionFields only — no `Minor` *storage*; omitted intentionally)
 *   - backend/src/models/bank/BankAccount.ts                (line 16 `balanceMinor`)
 *   - backend/src/models/bank/BankTransaction.ts            (lines 25-27 `debitMinor`, `creditMinor`, `balanceMinor`)
 *   - backend/src/models/core/TenantUserRole.ts             (line 30 `capabilities.approvalLimitMinor`)
 *   - backend/src/models/integration/TenantComplianceConfig.ts (lines 34, 37, 40, 50)
 *   - backend/src/models/compliance/TdsRateTable.ts         (lines 10-11)
 */
export const MINOR_FIELD_REGISTRY: readonly CollectionValidatorSpec[] = [
  {
    modelName: "Invoice",
    groups: [
      // Top-level (line 119)
      { prefix: "", fields: ["invoiceAmountMinor"], nullable: true },
      // parsed.* and parsed.gst.* (lines 178, 189-194)
      {
        prefix: "parsed",
        fields: ["totalAmountMinor"],
        nullable: true
      },
      {
        prefix: "parsed.gst",
        fields: ["subtotalMinor", "cgstMinor", "sgstMinor", "igstMinor", "cessMinor", "totalTaxMinor"],
        nullable: true
      },
      // parsed.lineItems[] (lines 205, 207-209)
      {
        prefix: "parsed.lineItems",
        fields: ["amountMinor", "cgstMinor", "sgstMinor", "igstMinor"],
        nullable: true,
        array: true
      },
      // compliance.tds.* (lines 271-272)
      {
        prefix: "compliance.tds",
        fields: ["amountMinor", "netPayableMinor"],
        nullable: true
      },
      // compliance.tcs.* (line 318)
      {
        prefix: "compliance.tcs",
        fields: ["amountMinor"],
        nullable: true
      }
    ]
  },
  {
    modelName: "BankAccount",
    groups: [{ prefix: "", fields: ["balanceMinor"], nullable: true }]
  },
  {
    modelName: "BankTransaction",
    groups: [{ prefix: "", fields: ["debitMinor", "creditMinor", "balanceMinor"], nullable: true }]
  },
  {
    modelName: "TenantUserRole",
    groups: [{ prefix: "capabilities", fields: ["approvalLimitMinor"], nullable: true }]
  },
  {
    modelName: "TenantComplianceConfig",
    groups: [
      {
        prefix: "",
        fields: ["maxInvoiceTotalMinor", "eInvoiceThresholdMinor", "minimumExpectedTotalMinor", "reconciliationAmountToleranceMinor"],
        nullable: true
      }
    ]
  },
  {
    modelName: "TdsRateTable",
    // thresholdSingleMinor and thresholdAnnualMinor are both `required: true`, so non-nullable.
    groups: [{ prefix: "", fields: ["thresholdSingleMinor", "thresholdAnnualMinor"], nullable: false }]
  }
] as const;

/** bson types that satisfy our integer-minor contract. `multipleOf: 1` is the enforcer. */
const INTEGER_BSON_TYPES = ["int", "long", "double"] as const;

export interface MinorFieldRule {
  bsonType: readonly string[];
  multipleOf: 1;
}

export function buildMinorFieldRule(nullable: boolean): MinorFieldRule {
  return {
    bsonType: nullable ? [...INTEGER_BSON_TYPES, "null"] : [...INTEGER_BSON_TYPES],
    multipleOf: 1
  };
}

/**
 * Build the `$jsonSchema` document for one collection. Result shape:
 *   {
 *     bsonType: "object",
 *     properties: {
 *       <topLevelField>: { bsonType: [...], multipleOf: 1 },
 *       <prefix>: { bsonType: "object", properties: { <field>: { ... } } }
 *     }
 *   }
 *
 * Nested prefixes (e.g. `parsed.gst`) produce recursive `bsonType: object` wrappers
 * so that Mongo validates deep fields. Array prefixes (e.g. `parsed.lineItems`)
 * produce a `{ bsonType: 'array', items: { properties: {...} } }` wrapper.
 *
 * Undefined / missing subtrees are allowed — we never mark any `*Minor` field
 * as `required` at the DB layer. That responsibility remains with Mongoose /
 * app-level services.
 */
export function buildCollectionJsonSchema(spec: CollectionValidatorSpec): Record<string, unknown> {
  const root: Record<string, unknown> = { bsonType: "object", properties: {} };
  const rootProps = root.properties as Record<string, unknown>;

  for (const group of spec.groups) {
    const fieldSchemas: Record<string, MinorFieldRule> = {};
    for (const field of group.fields) {
      fieldSchemas[field] = buildMinorFieldRule(group.nullable ?? false);
    }

    if (group.prefix === "") {
      Object.assign(rootProps, fieldSchemas);
      continue;
    }

    const segments = group.prefix.split(".");
    let cursor = rootProps;

    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i]!;
      const isLast = i === segments.length - 1;
      if (isLast) {
        if (group.array) {
          cursor[segment] = {
            bsonType: "array",
            items: { bsonType: "object", properties: fieldSchemas }
          };
        } else {
          // merge with any existing properties at this prefix (multiple groups may share a prefix).
          const existing = (cursor[segment] as { properties?: Record<string, unknown> } | undefined) ?? {
            bsonType: "object",
            properties: {}
          };
          const merged = {
            bsonType: "object",
            properties: { ...(existing.properties ?? {}), ...fieldSchemas }
          };
          cursor[segment] = merged;
        }
      } else {
        const existing = (cursor[segment] as { properties?: Record<string, unknown> } | undefined) ?? {
          bsonType: "object",
          properties: {}
        };
        const next = {
          bsonType: "object",
          properties: { ...(existing.properties ?? {}) }
        };
        cursor[segment] = next;
        cursor = next.properties as Record<string, unknown>;
      }
    }
  }

  return root;
}

/** Convenience: build all specs upfront. */
export function buildAllJsonSchemas(): Array<{ modelName: string; jsonSchema: Record<string, unknown> }> {
  return MINOR_FIELD_REGISTRY.map((spec) => ({
    modelName: spec.modelName,
    jsonSchema: buildCollectionJsonSchema(spec)
  }));
}
