/**
 * @jest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { useTabHashRouting } from "@/features/workspace/useTabHashRouting";
import { TAB_HASH_PATH, LEGACY_QUERY_TABS } from "@/features/workspace/tabHashConfig";

function setLocation(search: string, hash: string) {
  window.history.replaceState({}, "", `/${search}${hash}`);
}

describe("useTabHashRouting", () => {
  beforeEach(() => {
    setLocation("", "");
  });

  it("writes the hash for the current active tab on mount when no legacy query or hash present", () => {
    renderHook(() => useTabHashRouting({ activeTab: "overview", onTabChange: jest.fn() }));
    expect(window.location.hash).toBe(TAB_HASH_PATH.overview);
  });

  it("detects legacy ?tab=<x> and returns migration info, rewrites URL to the new hash path", () => {
    setLocation("?tab=dashboard", "");
    const onTabChange = jest.fn();
    const { result, rerender } = renderHook(
      (props: { activeTab: "overview" | "dashboard" }) =>
        useTabHashRouting({ activeTab: props.activeTab, onTabChange }),
      { initialProps: { activeTab: "overview" } }
    );

    expect(result.current.migration).toEqual({ oldPath: "?tab=dashboard", newPath: "#/invoices" });
    expect(onTabChange).toHaveBeenCalledWith("dashboard");
    expect(window.location.search).toBe("");

    rerender({ activeTab: "dashboard" });
    expect(window.location.hash).toBe("#/invoices");
  });

  it("applies hash → tab on mount when a supported hash is present and no legacy query", () => {
    setLocation("", "#/exports");
    const onTabChange = jest.fn();
    renderHook(() => useTabHashRouting({ activeTab: "overview", onTabChange }));
    expect(onTabChange).toHaveBeenCalledWith("exports");
  });

  it("updates the hash when activeTab changes after mount", () => {
    const { rerender } = renderHook(
      (props: { activeTab: "overview" | "dashboard" }) => useTabHashRouting({ activeTab: props.activeTab, onTabChange: jest.fn() }),
      { initialProps: { activeTab: "overview" } }
    );
    expect(window.location.hash).toBe("#/overview");

    rerender({ activeTab: "dashboard" });
    expect(window.location.hash).toBe("#/invoices");
  });

  it("reacts to window hashchange events and calls onTabChange", () => {
    const onTabChange = jest.fn();
    renderHook(() => useTabHashRouting({ activeTab: "overview", onTabChange }));
    onTabChange.mockClear();

    act(() => {
      window.history.replaceState({}, "", "/#/reconciliation");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(onTabChange).toHaveBeenCalledWith("statements");
  });

  it("keeps migration set after mount (banner, not the hook, owns dismissal)", () => {
    setLocation("?tab=exports", "");
    const { result, rerender } = renderHook(
      (props: { activeTab: "overview" | "exports" }) =>
        useTabHashRouting({ activeTab: props.activeTab, onTabChange: jest.fn() }),
      { initialProps: { activeTab: "overview" } }
    );
    expect(result.current.migration).not.toBeNull();
    rerender({ activeTab: "exports" });
    expect(result.current.migration).not.toBeNull();
  });

  it("LEGACY_QUERY_TABS is derived from TAB_HASH_PATH keys (single source of truth)", () => {
    expect([...LEGACY_QUERY_TABS].sort()).toEqual(Object.keys(TAB_HASH_PATH).sort());
  });
});
