import { Types } from "mongoose";
import { describeHarness } from "@/test-utils/mongoTestHarness.js";
import { ClientOrganizationModel } from "@/models/integration/ClientOrganization.js";
import {
  findClientOrgIdsForTenant,
  findClientOrgIdByIdForTenant
} from "@/services/auth/tenantScope.js";

const GSTIN_A = "29ABCDE1234F1Z5";
const GSTIN_B = "29BCDEF2345G1Z6";
const GSTIN_OTHER = "29CDEFG3456H1Z7";

describeHarness("tenantScope helpers", () => {
  test("findClientOrgIdsForTenant returns only the tenant's client-orgs", async () => {
    const tenantA = new Types.ObjectId().toString();
    const tenantB = new Types.ObjectId().toString();

    const [orgA1, orgA2] = await Promise.all([
      ClientOrganizationModel.create({ tenantId: tenantA, gstin: GSTIN_A, companyName: "A1" }),
      ClientOrganizationModel.create({ tenantId: tenantA, gstin: GSTIN_B, companyName: "A2" })
    ]);
    await ClientOrganizationModel.create({ tenantId: tenantB, gstin: GSTIN_OTHER, companyName: "B1" });

    const idsA = await findClientOrgIdsForTenant(tenantA);
    const idsB = await findClientOrgIdsForTenant(tenantB);

    expect(idsA.map((i) => i.toString()).sort()).toEqual(
      [orgA1._id.toString(), orgA2._id.toString()].sort()
    );
    expect(idsB).toHaveLength(1);
    expect(idsA.map((i) => i.toString())).not.toContain(idsB[0].toString());
  });

  test("findClientOrgIdsForTenant returns [] for unknown tenant", async () => {
    const ids = await findClientOrgIdsForTenant(new Types.ObjectId().toString());
    expect(ids).toEqual([]);
  });

  test("findClientOrgIdByIdForTenant returns id when owned", async () => {
    const tenantId = new Types.ObjectId().toString();
    const org = await ClientOrganizationModel.create({
      tenantId,
      gstin: GSTIN_A,
      companyName: "Owned"
    });

    const result = await findClientOrgIdByIdForTenant(org._id.toString(), tenantId);
    expect(result?.toString()).toBe(org._id.toString());
  });

  test("findClientOrgIdByIdForTenant returns null when client-org belongs to another tenant", async () => {
    const tenantA = new Types.ObjectId().toString();
    const tenantB = new Types.ObjectId().toString();
    const orgA = await ClientOrganizationModel.create({
      tenantId: tenantA,
      gstin: GSTIN_A,
      companyName: "A"
    });

    const result = await findClientOrgIdByIdForTenant(orgA._id.toString(), tenantB);
    expect(result).toBeNull();
  });
});
