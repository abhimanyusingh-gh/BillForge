import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useChromeCounters } from "@/features/chrome/sidebar/useChromeCounters";

const fetchActionRequiredCountMock = vi.fn();
const fetchTriageCountMock = vi.fn();

vi.mock("@/api/chromeService", () => ({
  chromeService: {
    fetchActionRequiredCount: (...args: unknown[]) => fetchActionRequiredCountMock(...args),
    fetchTriageCount: (...args: unknown[]) => fetchTriageCountMock(...args)
  }
}));

beforeEach(() => {
  fetchActionRequiredCountMock.mockReset();
  fetchTriageCountMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useChromeCounters", () => {
  it("returns the BE counts and clears the loading flag", async () => {
    fetchActionRequiredCountMock.mockResolvedValue(11);
    fetchTriageCountMock.mockResolvedValue(4);

    const { result } = renderHook(() => useChromeCounters());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.action).toBe(11);
    expect(result.current.triage).toBe(4);
  });

  it("falls back to zero when the service rejects", async () => {
    fetchActionRequiredCountMock.mockRejectedValue(new Error("boom"));
    fetchTriageCountMock.mockResolvedValue(0);

    const { result } = renderHook(() => useChromeCounters());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.action).toBe(0);
    expect(result.current.triage).toBe(0);
  });

  it("aborts the in-flight fetch on unmount", async () => {
    let signalRef: AbortSignal | undefined;
    fetchActionRequiredCountMock.mockImplementation((signal: AbortSignal) => {
      signalRef = signal;
      return new Promise(() => undefined);
    });
    fetchTriageCountMock.mockResolvedValue(0);

    const { unmount } = renderHook(() => useChromeCounters());
    expect(signalRef?.aborted).toBe(false);
    unmount();
    expect(signalRef?.aborted).toBe(true);
  });
});
