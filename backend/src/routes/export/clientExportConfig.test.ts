import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { createClientExportConfigRouter } from "@/routes/export/clientExportConfig.ts";
import { ClientExportConfigModel } from "@/models/integration/ClientExportConfig.ts";
import { defaultAuth, findHandler, mockRequest, mockResponse } from "@/routes/testHelpers.ts";

// Build an ObjectId from the first 24 hex chars of a fresh UUIDv4 — gives a
// unique value per test run without re-using a hardcoded fixture id.
const ACTIVE_CLIENT_ORG_ID = new Types.ObjectId(randomUUID().replace(/-/g, "").slice(0, 24));
const authedReq = (overrides: Record<string, unknown> = {}) =>
  mockRequest({ authContext: defaultAuth, activeClientOrgId: ACTIVE_CLIENT_ORG_ID, ...overrides });

describe("clientExportConfig routes", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("GET /export-config", () => {
    it("returns empty object when no config exists", async () => {
      jest.spyOn(ClientExportConfigModel, "findOne").mockReturnValue({
        lean: jest.fn().mockResolvedValue(null)
      } as never);

      const router = createClientExportConfigRouter();
      const handler = findHandler(router, "get", "/export-config");
      const res = mockResponse();

      await handler(
        authedReq({ params: { tenantId: "tenant-a" } }),
        res,
        jest.fn()
      );

      expect(res.statusCode).toBe(200);
      expect(res.jsonBody).toEqual({});
    });

    it("returns existing config", async () => {
      const existing = {
        tenantId: "tenant-a",
        tallyCompanyName: "My Company",
        tallyCgstLedger: "Custom CGST"
      };
      jest.spyOn(ClientExportConfigModel, "findOne").mockReturnValue({
        lean: jest.fn().mockResolvedValue(existing)
      } as never);

      const router = createClientExportConfigRouter();
      const handler = findHandler(router, "get", "/export-config");
      const res = mockResponse();

      await handler(
        authedReq({ params: { tenantId: "tenant-a" } }),
        res,
        jest.fn()
      );

      expect(res.statusCode).toBe(200);
      expect(res.jsonBody).toEqual(existing);
    });

  });

  describe("PATCH /export-config", () => {
    it("upserts config with valid tally fields", async () => {
      const saved = {
        tenantId: "tenant-a",
        tallyCompanyName: "Updated Company",
        toObject: () => ({ tenantId: "tenant-a", tallyCompanyName: "Updated Company" })
      };
      jest.spyOn(ClientExportConfigModel, "findOneAndUpdate").mockResolvedValue(saved as never);

      const router = createClientExportConfigRouter();
      const handler = findHandler(router, "patch", "/export-config");
      const res = mockResponse();

      await handler(
        authedReq({ params: { tenantId: "tenant-a", clientOrgId: ACTIVE_CLIENT_ORG_ID },
          body: { tallyCompanyName: "Updated Company" }
        }),
        res,
        jest.fn()
      );

      expect(res.statusCode).toBe(200);
      expect(ClientExportConfigModel.findOneAndUpdate).toHaveBeenCalledWith(
        { tenantId: "tenant-a", clientOrgId: ACTIVE_CLIENT_ORG_ID },
        { $set: expect.objectContaining({ tallyCompanyName: "Updated Company" }) },
        expect.objectContaining({ upsert: true })
      );
    });

    it("validates csvColumns entries", async () => {
      const router = createClientExportConfigRouter();
      const handler = findHandler(router, "patch", "/export-config");
      const res = mockResponse();

      await handler(
        authedReq({ params: { tenantId: "tenant-a", clientOrgId: ACTIVE_CLIENT_ORG_ID },
          body: { csvColumns: [{ key: "invalidKey", label: "Bad" }] }
        }),
        res,
        jest.fn()
      );

      expect(res.statusCode).toBe(400);
      expect((res.jsonBody as { message: string }).message).toContain("invalidKey");
    });

    it("accepts valid csvColumns", async () => {
      const saved = {
        toObject: () => ({
          tenantId: "tenant-a",
          csvColumns: [{ key: "invoiceNumber", label: "Inv #" }]
        })
      };
      jest.spyOn(ClientExportConfigModel, "findOneAndUpdate").mockResolvedValue(saved as never);

      const router = createClientExportConfigRouter();
      const handler = findHandler(router, "patch", "/export-config");
      const res = mockResponse();

      await handler(
        authedReq({ params: { tenantId: "tenant-a", clientOrgId: ACTIVE_CLIENT_ORG_ID },
          body: { csvColumns: [{ key: "invoiceNumber", label: "Inv #" }] }
        }),
        res,
        jest.fn()
      );

      expect(res.statusCode).toBe(200);
    });

    it("clears csvColumns when set to null", async () => {
      const saved = {
        toObject: () => ({ tenantId: "tenant-a", csvColumns: [] })
      };
      jest.spyOn(ClientExportConfigModel, "findOneAndUpdate").mockResolvedValue(saved as never);

      const router = createClientExportConfigRouter();
      const handler = findHandler(router, "patch", "/export-config");
      const res = mockResponse();

      await handler(
        authedReq({ params: { tenantId: "tenant-a", clientOrgId: ACTIVE_CLIENT_ORG_ID },
          body: { csvColumns: null }
        }),
        res,
        jest.fn()
      );

      expect(res.statusCode).toBe(200);
      expect(ClientExportConfigModel.findOneAndUpdate).toHaveBeenCalledWith(
        { tenantId: "tenant-a", clientOrgId: ACTIVE_CLIENT_ORG_ID },
        { $set: expect.objectContaining({ csvColumns: [] }) },
        expect.anything()
      );
    });

    it("clears a tally field when set to null", async () => {
      const saved = {
        toObject: () => ({ tenantId: "tenant-a" })
      };
      jest.spyOn(ClientExportConfigModel, "findOneAndUpdate").mockResolvedValue(saved as never);

      const router = createClientExportConfigRouter();
      const handler = findHandler(router, "patch", "/export-config");
      const res = mockResponse();

      await handler(
        authedReq({ params: { tenantId: "tenant-a", clientOrgId: ACTIVE_CLIENT_ORG_ID },
          body: { tallyCompanyName: null }
        }),
        res,
        jest.fn()
      );

      expect(res.statusCode).toBe(200);
      expect(ClientExportConfigModel.findOneAndUpdate).toHaveBeenCalledWith(
        { tenantId: "tenant-a", clientOrgId: ACTIVE_CLIENT_ORG_ID },
        { $set: expect.objectContaining({ tallyCompanyName: undefined }) },
        expect.anything()
      );
    });

    it("returns 400 when no valid fields provided", async () => {
      const router = createClientExportConfigRouter();
      const handler = findHandler(router, "patch", "/export-config");
      const res = mockResponse();

      await handler(
        authedReq({ params: { tenantId: "tenant-a", clientOrgId: ACTIVE_CLIENT_ORG_ID },
          body: {}
        }),
        res,
        jest.fn()
      );

      expect(res.statusCode).toBe(400);
    });

    it("calls next with error when findOneAndUpdate throws", async () => {
      const thrownError = new Error("MongoDB failure");
      jest.spyOn(ClientExportConfigModel, "findOneAndUpdate").mockRejectedValue(thrownError as never);

      const router = createClientExportConfigRouter();
      const handler = findHandler(router, "patch", "/export-config");
      const res = mockResponse();
      const next = jest.fn();

      await handler(
        authedReq({ params: { tenantId: "tenant-a", clientOrgId: ACTIVE_CLIENT_ORG_ID },
          body: { tallyCompanyName: "Test" }
        }),
        res,
        next
      );

      expect(next).toHaveBeenCalledWith(thrownError);
    });
  });
});
