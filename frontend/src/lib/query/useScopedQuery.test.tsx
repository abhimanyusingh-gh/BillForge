/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useScopedQuery, useScopedMutation } from "@/lib/query/useScopedQuery";
import { setActiveClientOrgId } from "@/hooks/useActiveClientOrg";

function reset() {
  window.history.replaceState({}, "", "/");
  window.localStorage.clear();
}

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } }
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe("lib/query/useScopedQuery", () => {
  beforeEach(reset);
  afterEach(reset);

  it("is disabled when no clientOrgId is active", () => {
    const { wrapper } = makeWrapper();
    const queryFn = jest.fn();
    const { result } = renderHook(
      () =>
        useScopedQuery({
          queryKey: ["thing"],
          queryFn: (ctx) => {
            queryFn(ctx);
            return Promise.resolve("never");
          }
        }),
      { wrapper }
    );
    expect(result.current.isFetching).toBe(false);
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("partitions cache by clientOrgId — switching realms refetches", async () => {
    const { client, wrapper } = makeWrapper();
    setActiveClientOrgId("realm-A");
    const queryFn = jest.fn(({ activeClientOrgId }) =>
      Promise.resolve(`payload-${activeClientOrgId}`)
    );
    const { result, rerender } = renderHook(
      () =>
        useScopedQuery<string>({
          queryKey: ["scope-test"],
          queryFn
        }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.data).toBe("payload-realm-A"));
    const realmAKeys = client.getQueryCache().findAll({ queryKey: ["clientOrg", "realm-A"] });
    expect(realmAKeys.length).toBe(1);

    act(() => {
      setActiveClientOrgId("realm-B");
    });
    rerender();
    await waitFor(() => expect(result.current.data).toBe("payload-realm-B"));

    const bothKeys = client.getQueryCache().findAll({ queryKey: ["clientOrg"] });
    expect(bothKeys.length).toBe(2);
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it("forwards the activeClientOrgId in the queryFn context", async () => {
    const { wrapper } = makeWrapper();
    setActiveClientOrgId("ctx-org");
    const queryFn = jest.fn(({ activeClientOrgId }) => Promise.resolve(activeClientOrgId));
    const { result } = renderHook(
      () => useScopedQuery<string>({ queryKey: ["ctx"], queryFn }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.data).toBe("ctx-org"));
    expect(queryFn).toHaveBeenCalledWith({ activeClientOrgId: "ctx-org" });
  });
});

describe("lib/query/useScopedMutation", () => {
  beforeEach(reset);
  afterEach(reset);

  it("rejects when no clientOrgId is active", async () => {
    const { wrapper } = makeWrapper();
    const mutationFn = jest.fn();
    const { result } = renderHook(
      () =>
        useScopedMutation<string, Error, void>({
          mutationFn: (ctx) => {
            mutationFn(ctx);
            return Promise.resolve("nope");
          }
        }),
      { wrapper }
    );

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toThrow(/No active clientOrgId/);
    });
    expect(mutationFn).not.toHaveBeenCalled();
  });

  it("invokes the mutationFn with the active context when a realm is set", async () => {
    const { wrapper } = makeWrapper();
    setActiveClientOrgId("mut-org");
    const mutationFn = jest.fn((ctx, vars: { x: number }) =>
      Promise.resolve(`${ctx.activeClientOrgId}:${vars.x}`)
    );
    const { result } = renderHook(
      () =>
        useScopedMutation<string, Error, { x: number }>({
          mutationFn
        }),
      { wrapper }
    );
    await act(async () => {
      const out = await result.current.mutateAsync({ x: 7 });
      expect(out).toBe("mut-org:7");
    });
    expect(mutationFn).toHaveBeenCalledWith({ activeClientOrgId: "mut-org" }, { x: 7 });
  });
});
