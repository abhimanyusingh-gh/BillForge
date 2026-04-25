import { Types } from "mongoose";
import { createTenantExportConfigRouter } from "@/routes/export/tenantExportConfig.ts";
import { ClientExportConfigModel } from "@/models/integration/ClientExportConfig.ts";
import { defaultAuth, findHandler, mockRequest, mockResponse } from "@/routes/testHelpers.ts";

const ACTIVE_CLIENT_ORG_ID = new Types.ObjectId("65f0000000000000000000c1");
const authedReq = (overrides: Record<string, unknown> = {}) =>
  mockRequest({ authContext: defaultAuth, activeClientOrgId: ACTIVE_CLIENT_ORG_ID, ...overrides });

describe("tenantExportConfig routes", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("GET /tenant/:tenantId/export-config", () => {
    it("returns empty object when no config exists", async () => {
      jest.spyOn(ClientExportConfigModel, "findOne").mockReturnValue({
        lean: jest.fn().mockResolvedValue(null)
      } as never);

      const router = createTenantExportConfigRouter();
      const handler = findHandler(router, "get", "/tenant/:tenantId/export-config");
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

      const router = createTenantExportConfigRouter();
      const handler = findHandler(router, "get", "/tenant/:tenantId/export-config");
      const res = mockResponse();

      await handler(
        authedReq({ params: { tenantId: "tenant-a" } }),
        res,
        jest.fn()
      );

      expect(res.statusCode).toBe(200);
      expect(res.jsonBody).toEqual(existing);
    });

    it("returns 403 when tenantId does not match auth context", async () => {
      const router = createTenantExportConfigRouter();
      const handler = findHandler(router, "get", "/tenant/:tenantId/export-config");
      const res = mockResponse();

      await handler(
        authedReq({ params: { tenantId: "other-tenant" } }),
        res,
        jest.fn()
      );

      expect(res.statusCode).toBe(403);
    });
  });

  describe("PATCH /tenant/:tenantId/export-config", () => {
    it("upserts config with valid tally fields", async () => {
      const saved = {
        tenantId: "tenant-a",
        tallyCompanyName: "Updated Company",
        toObject: () => ({ tenantId: "tenant-a", tallyCompanyName: "Updated Company" })
      };
      jest.spyOn(ClientExportConfigModel, "findOneAndUpdate").mockResolvedValue(saved as never);

      const router = createTenantExportConfigRouter();
      const handler = findHandler(router, "patch", "/tenant/:tenantId/export-config");
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
      const router = createTenantExportConfigRouter();
      const handler = findHandler(router, "patch", "/tenant/:tenantId/export-config");
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

      const router = createTenantExportConfigRouter();
      const handler = findHandler(router, "patch", "/tenant/:tenantId/export-config");
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

      const router = createTenantExportConfigRouter();
      const handler = findHandler(router, "patch", "/tenant/:tenantId/export-config");
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

      const router = createTenantExportConfigRouter();
      const handler = findHandler(router, "patch", "/tenant/:tenantId/export-config");
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
      const router = createTenantExportConfigRouter();
      const handler = findHandler(router, "patch", "/tenant/:tenantId/export-config");
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

    it("returns 403 when tenantId does not match auth context", async () => {
      const router = createTenantExportConfigRouter();
      const handler = findHandler(router, "patch", "/tenant/:tenantId/export-config");
      const res = mockResponse();

      await handler(
        authedReq({ params: { tenantId: "other-tenant" },
          body: { tallyCompanyName: "Hijack" }
        }),
        res,
        jest.fn()
      );

      expect(res.statusCode).toBe(403);
    });

    it("calls next with error when findOneAndUpdate throws", async () => {
      const thrownError = new Error("MongoDB failure");
      jest.spyOn(ClientExportConfigModel, "findOneAndUpdate").mockRejectedValue(thrownError as never);

      const router = createTenantExportConfigRouter();
      const handler = findHandler(router, "patch", "/tenant/:tenantId/export-config");
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
