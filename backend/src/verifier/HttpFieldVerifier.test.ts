import { HttpFieldVerifier } from "./HttpFieldVerifier.ts";
import { logger } from "../utils/logger.ts";

describe("HttpFieldVerifier", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("logs verifier token usage when usage payload is present", async () => {
    const infoSpy = jest.spyOn(logger, "info").mockImplementation(() => undefined);
    const post = jest.fn(async () => ({
      data: {
        parsed: {
          invoiceNumber: "INV-1"
        },
        issues: [],
        changedFields: ["invoiceNumber"],
        usage: {
          prompt_tokens: 90,
          completion_tokens: 30,
          total_tokens: 120
        }
      }
    }));

    const verifier = new HttpFieldVerifier({
      baseUrl: "http://localhost:8100",
      timeoutMs: 5_000,
      httpClient: { post } as never
    });

    const result = await verifier.verify({
      parsed: {},
      ocrText: "Invoice Number INV-1",
      ocrBlocks: [],
      mode: "relaxed",
      hints: {
        mimeType: "image/png",
        vendorTemplateMatched: false,
        fieldCandidates: {}
      }
    });

    expect(result.parsed).toEqual({
      invoiceNumber: "INV-1"
    });
    expect(result.changedFields).toEqual(["invoiceNumber"]);

    const requestEndCalls = infoSpy.mock.calls.filter((call) => call[0] === "verifier.http.request.end");
    expect(requestEndCalls).toHaveLength(1);
    expect(requestEndCalls[0]?.[1]).toEqual(
      expect.objectContaining({
        llmPromptTokens: 90,
        llmCompletionTokens: 30,
        llmTotalTokens: 120,
        llmTokenUsageReturned: true
      })
    );
  });

  it("returns fallback result and logs warning when verifier request fails", async () => {
    const warnSpy = jest.spyOn(logger, "warn").mockImplementation(() => undefined);
    const post = jest.fn(async () => {
      throw new Error("connection refused");
    });
    const verifier = new HttpFieldVerifier({
      baseUrl: "http://localhost:8100",
      timeoutMs: 5_000,
      httpClient: { post } as never
    });
    const input = {
      parsed: {
        vendorName: "ACME"
      },
      ocrText: "Vendor ACME",
      ocrBlocks: [],
      mode: "strict" as const,
      hints: {
        mimeType: "image/png",
        vendorTemplateMatched: false,
        fieldCandidates: {}
      }
    };

    const result = await verifier.verify(input);

    expect(result.parsed).toEqual(input.parsed);
    expect(result.issues).toEqual(["Field verifier request failed; continuing with deterministic extraction."]);
    expect(result.changedFields).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      "verifier.http.failed",
      expect.objectContaining({
        error: "connection refused"
      })
    );
  });
});
