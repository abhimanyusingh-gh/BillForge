import { createRiskSignal } from "@/services/compliance/riskSignalFactory";

describe("createRiskSignal", () => {
  it("returns a ComplianceRiskSignal with all fields populated", () => {
    const signal = createRiskSignal("TEST_CODE", "compliance", "warning", "Something happened.", 5);

    expect(signal).toEqual({
      code: "TEST_CODE",
      category: "compliance",
      severity: "warning",
      message: "Something happened.",
      confidencePenalty: 5,
      status: "open",
      resolvedBy: null,
      resolvedAt: null
    });
  });

  it("sets status to open for every signal", () => {
    const signal = createRiskSignal("X", "fraud", "critical", "", 10);
    expect(signal.status).toBe("open");
  });

  it("sets resolvedBy and resolvedAt to null", () => {
    const signal = createRiskSignal("Y", "financial", "info", "msg", 0);
    expect(signal.resolvedBy).toBeNull();
    expect(signal.resolvedAt).toBeNull();
  });

  it("preserves zero confidencePenalty", () => {
    const signal = createRiskSignal("Z", "data-quality", "info", "low", 0);
    expect(signal.confidencePenalty).toBe(0);
  });

  it("preserves high confidencePenalty", () => {
    const signal = createRiskSignal("W", "fraud", "critical", "bad", 30);
    expect(signal.confidencePenalty).toBe(30);
  });
});
