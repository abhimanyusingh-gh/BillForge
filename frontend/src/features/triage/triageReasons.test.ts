import {
  TRIAGE_REJECT_REASON,
  TRIAGE_REJECT_REASON_OPTIONS,
  buildRejectPayloadReason
} from "@/features/triage/triageReasons";

describe("features/triage/triageReasons", () => {
  it("exposes a stable enum and matching option set", () => {
    expect(TRIAGE_REJECT_REASON).toEqual({
      NotForAnyClient: "not_for_any_client",
      Spam: "spam",
      WrongVendor: "wrong_vendor",
      Other: "other"
    });
    const values = TRIAGE_REJECT_REASON_OPTIONS.map((opt) => opt.value).sort();
    expect(values).toEqual(["not_for_any_client", "other", "spam", "wrong_vendor"]);
  });

  it("flags Other as requiring free text and the others as optional", () => {
    for (const opt of TRIAGE_REJECT_REASON_OPTIONS) {
      expect(opt.requiresFreeText).toBe(opt.value === TRIAGE_REJECT_REASON.Other);
    }
  });

  it("builds the payload reason as label-only when no notes are provided", () => {
    expect(buildRejectPayloadReason(TRIAGE_REJECT_REASON.Spam, "")).toBe("Spam");
    expect(buildRejectPayloadReason(TRIAGE_REJECT_REASON.NotForAnyClient, "   ")).toBe(
      "Not for any of my clients"
    );
  });

  it("appends free-text notes after a colon when provided", () => {
    expect(buildRejectPayloadReason(TRIAGE_REJECT_REASON.WrongVendor, "Sent to wrong AP")).toBe(
      "Wrong vendor: Sent to wrong AP"
    );
    expect(buildRejectPayloadReason(TRIAGE_REJECT_REASON.Other, "Personal email")).toBe(
      "Other (describe below): Personal email"
    );
  });
});
