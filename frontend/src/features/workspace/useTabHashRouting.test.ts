/**
 * @jest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { useTabHashRouting, TAB_HASH_PATH } from "@/features/workspace/useTabHashRouting";

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

  it("dismissMigration clears the migration state", () => {
    setLocation("?tab=exports", "");
    const { result } = renderHook(() =>
      useTabHashRouting({ activeTab: "overview", onTabChange: jest.fn() })
    );
    expect(result.current.migration).not.toBeNull();

    act(() => {
      result.current.dismissMigration();
    });
    expect(result.current.migration).toBeNull();
  });
});
