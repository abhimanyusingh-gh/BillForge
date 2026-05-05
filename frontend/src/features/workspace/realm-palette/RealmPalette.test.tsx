import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RealmPalette } from "@/features/workspace/realm-palette/RealmPalette";
import { useSessionStore } from "@/state/sessionStore";
import { asClientOrgId, asTenantId } from "@/types/ids";

const listClientOrgsMock = vi.fn();

vi.mock("@/api/clientOrgService", () => ({
  clientOrgService: {
    listClientOrgs: (...args: unknown[]) => listClientOrgsMock(...args)
  }
}));

const sampleOrgs = [
  { id: asClientOrgId("co1"), companyName: "Acme Foods Pvt Ltd", gstin: "29ABCDE1234F1Z5", stateName: "Karnataka" },
  { id: asClientOrgId("co2"), companyName: "Bharat Steels", gstin: "27BHARA1234F1Z5", stateName: "Maharashtra" },
  { id: asClientOrgId("co3"), companyName: "Coastal Logistics", gstin: "29COAST1234F1Z5", stateName: "Karnataka" }
];

beforeEach(() => {
  listClientOrgsMock.mockReset();
  listClientOrgsMock.mockResolvedValue(sampleOrgs);
  act(() => {
    useSessionStore.getState().clearSession();
    useSessionStore.setState({ tenant: { id: asTenantId("t1"), name: "Khan & Associates" } });
  });
});

afterEach(() => {
  act(() => {
    useSessionStore.getState().clearSession();
  });
});

describe("RealmPalette", () => {
  it("does not render when closed", () => {
    const { container } = render(<RealmPalette open={false} onClose={() => undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("lists every client org returned by the service", async () => {
    render(<RealmPalette open onClose={() => undefined} />);
    await waitFor(() => {
      expect(screen.getByText("Acme Foods Pvt Ltd")).toBeInTheDocument();
      expect(screen.getByText("Bharat Steels")).toBeInTheDocument();
      expect(screen.getByText("Coastal Logistics")).toBeInTheDocument();
    });
  });

  it("filters rows by the search query", async () => {
    render(<RealmPalette open onClose={() => undefined} />);
    await waitFor(() => expect(screen.getByText("Acme Foods Pvt Ltd")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Search client orgs"), { target: { value: "bharat" } });
    expect(screen.queryByText("Acme Foods Pvt Ltd")).not.toBeInTheDocument();
    expect(screen.getByText("Bharat Steels")).toBeInTheDocument();
  });

  it("selects the highlighted org on Enter and closes the palette", async () => {
    const onClose = vi.fn();
    render(<RealmPalette open onClose={onClose} />);
    await waitFor(() => expect(screen.getByText("Acme Foods Pvt Ltd")).toBeInTheDocument());
    const input = screen.getByLabelText("Search client orgs");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onClose).toHaveBeenCalled();
    expect(useSessionStore.getState().currentClientOrgId).toBe(asClientOrgId("co2"));
    expect(useSessionStore.getState().recentClientOrgIds).toEqual([asClientOrgId("co2")]);
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(<RealmPalette open onClose={onClose} />);
    await waitFor(() => expect(screen.getByText("Acme Foods Pvt Ltd")).toBeInTheDocument());
    fireEvent.keyDown(screen.getByLabelText("Search client orgs"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("renders a Recent section when the user has prior selections", async () => {
    act(() => {
      useSessionStore.setState({ recentClientOrgIds: [asClientOrgId("co3")] });
    });
    render(<RealmPalette open onClose={() => undefined} />);
    await waitFor(() => expect(screen.getByText("Coastal Logistics")).toBeInTheDocument());
    expect(screen.getByText("Recent")).toBeInTheDocument();
    expect(screen.getByText(/All client orgs \(2\)/)).toBeInTheDocument();
  });
});
