/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ApprovalLimitsSection } from "./ApprovalLimitsSection";

const mockFetchApprovalLimits = jest.fn();
const mockSaveApprovalLimits = jest.fn();

jest.mock("@/api/admin", () => ({
  fetchApprovalLimits: (...args: unknown[]) => mockFetchApprovalLimits(...args),
  saveApprovalLimits: (...args: unknown[]) => mockSaveApprovalLimits(...args),
}));

const LIMITS_RESPONSE = {
  limits: {
    TENANT_ADMIN: { approvalLimitMinor: null, userIds: ["u-admin"] },
    ap_clerk: { approvalLimitMinor: 10000000, userIds: ["u-clerk"] },
    senior_accountant: { approvalLimitMinor: 100000000, userIds: [] },
    ca: { approvalLimitMinor: null, userIds: [] },
    tax_specialist: { approvalLimitMinor: null, userIds: [] },
    firm_partner: { approvalLimitMinor: null, userIds: [] },
    ops_admin: { approvalLimitMinor: 0, userIds: [] },
    audit_clerk: { approvalLimitMinor: 0, userIds: [] },
  },
  complianceSignoffUsers: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("ApprovalLimitsSection", () => {
  it("renders all role rows from the response", async () => {
    mockFetchApprovalLimits.mockResolvedValue(LIMITS_RESPONSE);
    await act(async () => {
      render(<ApprovalLimitsSection currentUserId="u-admin" currentUserRole="TENANT_ADMIN" />);
    });

    expect(screen.getByText("Tenant Admin")).toBeInTheDocument();
    expect(screen.getByText("AP Clerk")).toBeInTheDocument();
    expect(screen.getByText("Senior Accountant")).toBeInTheDocument();
    expect(screen.getByText("Chartered Accountant")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockFetchApprovalLimits.mockReturnValue(new Promise(() => {}));
    render(<ApprovalLimitsSection currentUserId="u-admin" currentUserRole="TENANT_ADMIN" />);
    expect(screen.getByText("Loading approval limits...")).toBeInTheDocument();
  });

  it("shows error state with retry button on load failure", async () => {
    mockFetchApprovalLimits.mockRejectedValue(new Error("Network error"));
    await act(async () => {
      render(<ApprovalLimitsSection currentUserId="u-admin" currentUserRole="TENANT_ADMIN" />);
    });

    expect(screen.getByText("Failed to load approval limits.")).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("renders current user role row as read-only", async () => {
    mockFetchApprovalLimits.mockResolvedValue(LIMITS_RESPONSE);
    await act(async () => {
      render(<ApprovalLimitsSection currentUserId="u-admin" currentUserRole="TENANT_ADMIN" />);
    });

    const unlimitedToggles = screen.getAllByLabelText(/unlimited toggle/i);
    const tenantAdminToggle = unlimitedToggles.find(
      (el) => el.getAttribute("aria-label") === "Tenant Admin unlimited toggle"
    );
    expect(tenantAdminToggle).toBeDisabled();
    expect(tenantAdminToggle?.getAttribute("title")).toBe("You cannot modify your own approval limit");
  });

  it("toggles unlimited on/off for editable roles", async () => {
    mockFetchApprovalLimits.mockResolvedValue(LIMITS_RESPONSE);
    await act(async () => {
      render(<ApprovalLimitsSection currentUserId="u-admin" currentUserRole="TENANT_ADMIN" />);
    });

    const apClerkInput = screen.getByLabelText("AP Clerk approval limit") as HTMLInputElement;
    expect(apClerkInput).not.toBeDisabled();
    expect(apClerkInput.value).toBe("100000");

    const apClerkUnlimited = screen.getByLabelText("AP Clerk unlimited toggle") as HTMLInputElement;
    expect(apClerkUnlimited.checked).toBe(false);

    fireEvent.click(apClerkUnlimited);
    expect(apClerkUnlimited.checked).toBe(true);

    const apClerkInputAfter = screen.getByLabelText("AP Clerk approval limit") as HTMLInputElement;
    expect(apClerkInputAfter).toBeDisabled();
  });

  it("shows save button only when dirty", async () => {
    mockFetchApprovalLimits.mockResolvedValue(LIMITS_RESPONSE);
    await act(async () => {
      render(<ApprovalLimitsSection currentUserId="u-admin" currentUserRole="TENANT_ADMIN" />);
    });

    expect(screen.queryByText("Save Limits")).not.toBeInTheDocument();

    const apClerkUnlimited = screen.getByLabelText("AP Clerk unlimited toggle");
    fireEvent.click(apClerkUnlimited);

    expect(screen.getByText("Save Limits")).toBeInTheDocument();
  });

  it("calls saveApprovalLimits on save and excludes current user role", async () => {
    mockFetchApprovalLimits.mockResolvedValue(LIMITS_RESPONSE);
    mockSaveApprovalLimits.mockResolvedValue({ updated: true });
    await act(async () => {
      render(<ApprovalLimitsSection currentUserId="u-admin" currentUserRole="TENANT_ADMIN" />);
    });

    const apClerkUnlimited = screen.getByLabelText("AP Clerk unlimited toggle");
    fireEvent.click(apClerkUnlimited);

    const saveBtn = screen.getByText("Save Limits");
    await act(async () => { fireEvent.click(saveBtn); });

    expect(mockSaveApprovalLimits).toHaveBeenCalledTimes(1);
    const payload = mockSaveApprovalLimits.mock.calls[0][0];
    expect(payload).not.toHaveProperty("TENANT_ADMIN");
    expect(payload.ap_clerk).toBeNull();
  });

  it("shows inline error on save failure", async () => {
    mockFetchApprovalLimits.mockResolvedValue(LIMITS_RESPONSE);
    mockSaveApprovalLimits.mockRejectedValue({ code: "UNKNOWN" });
    await act(async () => {
      render(<ApprovalLimitsSection currentUserId="u-admin" currentUserRole="TENANT_ADMIN" />);
    });

    const apClerkUnlimited = screen.getByLabelText("AP Clerk unlimited toggle");
    fireEvent.click(apClerkUnlimited);

    const saveBtn = screen.getByText("Save Limits");
    await act(async () => { fireEvent.click(saveBtn); });

    expect(screen.getByRole("alert")).toHaveTextContent("Failed to save approval limits.");
  });

  it("shows success message after save", async () => {
    mockFetchApprovalLimits.mockResolvedValue(LIMITS_RESPONSE);
    mockSaveApprovalLimits.mockResolvedValue({ updated: true });
    await act(async () => {
      render(<ApprovalLimitsSection currentUserId="u-admin" currentUserRole="TENANT_ADMIN" />);
    });

    const apClerkUnlimited = screen.getByLabelText("AP Clerk unlimited toggle");
    fireEvent.click(apClerkUnlimited);

    const saveBtn = screen.getByText("Save Limits");
    await act(async () => { fireEvent.click(saveBtn); });

    expect(screen.getByText("Approval limits saved.")).toBeInTheDocument();
  });

  it("updates limit value when typing in a numeric input", async () => {
    mockFetchApprovalLimits.mockResolvedValue(LIMITS_RESPONSE);
    await act(async () => {
      render(<ApprovalLimitsSection currentUserId="u-admin" currentUserRole="TENANT_ADMIN" />);
    });

    const apClerkInput = screen.getByLabelText("AP Clerk approval limit") as HTMLInputElement;
    fireEvent.change(apClerkInput, { target: { value: "50000" } });
    expect(apClerkInput.value).toBe("50000");
  });
});
