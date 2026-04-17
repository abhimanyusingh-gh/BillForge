/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ReconciliationWeightsSection } from "@/features/tenant-admin/ReconciliationWeightsSection";

let mockFetchComplianceConfig: jest.Mock;
let mockSaveComplianceConfig: jest.Mock;

jest.mock("@/api/admin", () => ({
  get fetchComplianceConfig() {
    return mockFetchComplianceConfig;
  },
  get saveComplianceConfig() {
    return mockSaveComplianceConfig;
  }
}));

const DEFAULT_CONFIG = {
  reconciliationWeightExactAmount: 50,
  reconciliationWeightCloseAmount: 10,
  reconciliationWeightInvoiceNumber: 30,
  reconciliationWeightVendorName: 20,
  reconciliationWeightDateProximity: 10
};

beforeEach(() => {
  mockFetchComplianceConfig = jest.fn();
  mockSaveComplianceConfig = jest.fn();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("ReconciliationWeightsSection", () => {
  it("renders with default weights", async () => {
    mockFetchComplianceConfig.mockResolvedValue(DEFAULT_CONFIG);

    await act(async () => {
      render(<ReconciliationWeightsSection />);
    });

    const inputs = screen.getAllByRole("spinbutton");
    expect(inputs).toHaveLength(5);
    expect(inputs[0]).toHaveValue(50);
    expect(inputs[1]).toHaveValue(10);
    expect(inputs[2]).toHaveValue(30);
    expect(inputs[3]).toHaveValue(20);
    expect(inputs[4]).toHaveValue(10);
  });

  it("renders with custom weights from API", async () => {
    mockFetchComplianceConfig.mockResolvedValue({
      reconciliationWeightExactAmount: 80,
      reconciliationWeightCloseAmount: 5,
      reconciliationWeightInvoiceNumber: 40,
      reconciliationWeightVendorName: 15,
      reconciliationWeightDateProximity: 25
    });

    await act(async () => {
      render(<ReconciliationWeightsSection />);
    });

    const inputs = screen.getAllByRole("spinbutton");
    expect(inputs[0]).toHaveValue(80);
    expect(inputs[1]).toHaveValue(5);
    expect(inputs[2]).toHaveValue(40);
    expect(inputs[3]).toHaveValue(15);
    expect(inputs[4]).toHaveValue(25);
  });

  it("shows loading state during fetch", () => {
    mockFetchComplianceConfig.mockReturnValue(new Promise(() => {}));

    render(<ReconciliationWeightsSection />);

    expect(screen.getByText("Loading reconciliation weights...")).toBeInTheDocument();
    expect(screen.queryByText("Reconciliation Scoring Weights")).not.toBeInTheDocument();
  });

  it("shows error state with retry button on fetch failure", async () => {
    mockFetchComplianceConfig.mockRejectedValue(new Error("Something unexpected happened"));

    await act(async () => {
      render(<ReconciliationWeightsSection />);
    });

    expect(screen.getByText("Something unexpected happened")).toBeInTheDocument();

    const retryButton = screen.getByRole("button", { name: "Retry" });
    expect(retryButton).toBeInTheDocument();

    mockFetchComplianceConfig.mockResolvedValue(DEFAULT_CONFIG);

    await act(async () => {
      fireEvent.click(retryButton);
    });

    expect(screen.getByText("Reconciliation Scoring Weights")).toBeInTheDocument();
    expect(mockFetchComplianceConfig).toHaveBeenCalledTimes(2);
  });

  it("edits a weight value", async () => {
    mockFetchComplianceConfig.mockResolvedValue(DEFAULT_CONFIG);

    await act(async () => {
      render(<ReconciliationWeightsSection />);
    });

    const inputs = screen.getAllByRole("spinbutton");
    fireEvent.change(inputs[0], { target: { value: "80" } });

    expect(inputs[0]).toHaveValue(80);
  });

  it("shows total weight budget", async () => {
    mockFetchComplianceConfig.mockResolvedValue(DEFAULT_CONFIG);

    await act(async () => {
      render(<ReconciliationWeightsSection />);
    });

    expect(screen.getByText("Total weight budget: 120 / 300")).toBeInTheDocument();
  });

  it("saves successfully and shows success message", async () => {
    mockFetchComplianceConfig.mockResolvedValue(DEFAULT_CONFIG);
    mockSaveComplianceConfig.mockResolvedValue({
      ...DEFAULT_CONFIG,
      reconciliationWeightExactAmount: 80
    });

    await act(async () => {
      render(<ReconciliationWeightsSection />);
    });

    const inputs = screen.getAllByRole("spinbutton");
    fireEvent.change(inputs[0], { target: { value: "80" } });

    const saveButton = screen.getByRole("button", { name: "Save Weights" });

    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(mockSaveComplianceConfig).toHaveBeenCalledWith({
      reconciliationWeightExactAmount: 80,
      reconciliationWeightCloseAmount: 10,
      reconciliationWeightInvoiceNumber: 30,
      reconciliationWeightVendorName: 20,
      reconciliationWeightDateProximity: 10
    });

    expect(screen.getByText("Reconciliation weights saved.")).toBeInTheDocument();
  });

  it("shows inline error on save failure", async () => {
    mockFetchComplianceConfig.mockResolvedValue(DEFAULT_CONFIG);
    mockSaveComplianceConfig.mockRejectedValue(new Error("Server error"));

    await act(async () => {
      render(<ReconciliationWeightsSection />);
    });

    const inputs = screen.getAllByRole("spinbutton");
    fireEvent.change(inputs[0], { target: { value: "80" } });

    const saveButton = screen.getByRole("button", { name: "Save Weights" });

    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(screen.getByText("Server error")).toBeInTheDocument();
    expect(screen.queryByText("Reconciliation weights saved.")).not.toBeInTheDocument();
  });

  it("clamps weight values to 0–100 range", async () => {
    mockFetchComplianceConfig.mockResolvedValue(DEFAULT_CONFIG);

    await act(async () => {
      render(<ReconciliationWeightsSection />);
    });

    const inputs = screen.getAllByRole("spinbutton");

    fireEvent.change(inputs[0], { target: { value: "150" } });
    expect(inputs[0]).toHaveValue(100);

    fireEvent.change(inputs[0], { target: { value: "-10" } });
    expect(inputs[0]).toHaveValue(0);
  });

  it("only shows save button when values differ from saved state", async () => {
    mockFetchComplianceConfig.mockResolvedValue(DEFAULT_CONFIG);

    await act(async () => {
      render(<ReconciliationWeightsSection />);
    });

    expect(screen.queryByRole("button", { name: "Save Weights" })).not.toBeInTheDocument();

    const inputs = screen.getAllByRole("spinbutton");
    fireEvent.change(inputs[0], { target: { value: "80" } });

    expect(screen.getByRole("button", { name: "Save Weights" })).toBeInTheDocument();

    fireEvent.change(inputs[0], { target: { value: "50" } });

    expect(screen.queryByRole("button", { name: "Save Weights" })).not.toBeInTheDocument();
  });

  it("renders all five weight field labels", async () => {
    mockFetchComplianceConfig.mockResolvedValue(DEFAULT_CONFIG);

    await act(async () => {
      render(<ReconciliationWeightsSection />);
    });

    expect(screen.getByText("Exact Amount Match")).toBeInTheDocument();
    expect(screen.getByText("Close Amount Match")).toBeInTheDocument();
    expect(screen.getByText("Invoice Number Match")).toBeInTheDocument();
    expect(screen.getByText("Vendor Name Match")).toBeInTheDocument();
    expect(screen.getByText("Date Proximity")).toBeInTheDocument();
  });
});
