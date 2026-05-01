/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/api/client", () => {
  const { buildApiClientMockModule } = require("@/test-utils/mockApiClient");
  return buildApiClientMockModule();
});

import { TdsLiabilityTable } from "@/features/reports/TdsLiabilityTable";
import type { TdsLiabilityVendorBucket } from "@/api/reports";

function row(overrides: Partial<TdsLiabilityVendorBucket> = {}): TdsLiabilityVendorBucket {
  return {
    vendorFingerprint: "vendor-a",
    section: "194C",
    cumulativeBaseMinor: 50_00_000,
    cumulativeTdsMinor: 1_00_000,
    invoiceCount: 5,
    thresholdCrossedAt: null,
    ...overrides
  };
}

describe("TdsLiabilityTable", () => {
  it("renders the empty state when there are zero rows and no filter is active", () => {
    render(<TdsLiabilityTable rows={[]} isFiltered={false} />);
    expect(screen.getByTestId("tds-table-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("tds-liability-table")).toBeNull();
  });

  it("renders the zero-result state when filtered to nothing and offers a clear-filters CTA", () => {
    const onClearFilters = jest.fn();
    render(<TdsLiabilityTable rows={[]} isFiltered onClearFilters={onClearFilters} />);
    expect(screen.getByTestId("tds-table-zero-result")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /clear filters/i }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it("shows a danger badge with both color (tone) and shape (icon) when a row crossed threshold", () => {
    const crossed = row({ vendorFingerprint: "vendor-x", thresholdCrossedAt: "2026-01-15T00:00:00.000Z" });
    render(<TdsLiabilityTable rows={[crossed]} isFiltered={false} />);
    const dataRow = screen.getByTestId("tds-row");
    expect(dataRow).toHaveAttribute("data-threshold-crossed", "true");
    const badge = within(dataRow).getByText(/Crossed/);
    expect(badge.querySelector(".material-symbols-outlined")?.textContent).toBe("warning");
  });

  it("toggles sort direction when the same column header is clicked twice", () => {
    const rows = [
      row({ vendorFingerprint: "alpha", cumulativeTdsMinor: 100 }),
      row({ vendorFingerprint: "bravo", cumulativeTdsMinor: 50 })
    ];
    render(<TdsLiabilityTable rows={rows} isFiltered={false} />);
    const initialOrder = screen.getAllByTestId("tds-row").map((r) => r.querySelector("td")?.textContent);
    expect(initialOrder).toEqual(["alpha", "bravo"]);
    fireEvent.click(screen.getByTestId("tds-sort-cumulativeTdsMinor"));
    const afterToggle = screen.getAllByTestId("tds-row").map((r) => r.querySelector("td")?.textContent);
    expect(afterToggle).toEqual(["bravo", "alpha"]);
  });

  it("invokes onSelectVendor when the vendor link is clicked", () => {
    const onSelectVendor = jest.fn();
    render(
      <TdsLiabilityTable
        rows={[row({ vendorFingerprint: "vendor-link" })]}
        isFiltered={false}
        onSelectVendor={onSelectVendor}
      />
    );
    fireEvent.click(screen.getByTestId("tds-vendor-link-vendor-link"));
    expect(onSelectVendor).toHaveBeenCalledWith("vendor-link");
  });
});
