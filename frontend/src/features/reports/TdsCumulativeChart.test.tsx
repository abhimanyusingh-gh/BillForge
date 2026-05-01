/**
 * @jest-environment jsdom
 */
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TdsCumulativeChart } from "@/features/reports/TdsCumulativeChart";
import { TDS_QUARTER, type TdsLiabilityQuarterBucket } from "@/api/reports";

jest.mock("recharts", () => {
  const Stub = ({ children }: { children?: ReactNode }) => <div data-testid="recharts-stub">{children}</div>;
  return new Proxy({}, { get: () => Stub });
});

jest.mock("@/api/client", () => {
  const { buildApiClientMockModule } = require("@/test-utils/mockApiClient");
  return buildApiClientMockModule();
});

describe("TdsCumulativeChart", () => {
  it("renders the empty state when no data and no filter is active", () => {
    render(<TdsCumulativeChart byQuarter={[]} isFiltered={false} />);
    expect(screen.getByTestId("tds-chart-empty")).toBeInTheDocument();
  });

  it("renders the zero-result state with a clear-filters CTA when filtered to nothing", () => {
    const onClearFilters = jest.fn();
    render(<TdsCumulativeChart byQuarter={[]} isFiltered onClearFilters={onClearFilters} />);
    expect(screen.getByTestId("tds-chart-zero-result")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /clear filters/i }));
    expect(onClearFilters).toHaveBeenCalled();
  });

  it("renders the chart container when data is present", () => {
    const data: TdsLiabilityQuarterBucket[] = [
      { quarter: TDS_QUARTER.Q1, section: "194C", cumulativeBaseMinor: 1000, cumulativeTdsMinor: 100, invoiceCount: 1 },
      { quarter: TDS_QUARTER.Q2, section: "194C", cumulativeBaseMinor: 2000, cumulativeTdsMinor: 200, invoiceCount: 2 }
    ];
    render(<TdsCumulativeChart byQuarter={data} isFiltered={false} />);
    expect(screen.getByTestId("tds-cumulative-chart")).toBeInTheDocument();
  });
});
