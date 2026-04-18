/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { StepCard } from "./StepCard";
import type { WorkflowStep, TenantUser } from "@/types";

const tenantUsers: TenantUser[] = [
  { userId: "u1", email: "alice@example.com", role: "ca", enabled: true },
  { userId: "u2", email: "bob@example.com", role: "senior_accountant", enabled: true },
];

const baseStep: WorkflowStep = {
  order: 1,
  name: "Step 1",
  approverType: "any_member",
  rule: "any",
  condition: null,
};

const baseProps = {
  step: baseStep,
  stepCount: 1,
  tenantUsers,
  onUpdate: jest.fn(),
  onRemove: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe("StepCard", () => {
  it("renders step order", () => {
    render(<StepCard {...baseProps} />);
    expect(screen.getByText("Step 1")).toBeInTheDocument();
  });

  it("shows compliance sign-off badge for compliance_signoff type", () => {
    render(
      <StepCard
        {...baseProps}
        step={{ ...baseStep, type: "compliance_signoff" }}
      />
    );
    expect(screen.getByText("Compliance Sign-off")).toBeInTheDocument();
  });

  it("does not show compliance sign-off badge for approval type", () => {
    render(
      <StepCard
        {...baseProps}
        step={{ ...baseStep, type: "approval" }}
      />
    );
    expect(screen.queryByText("Compliance Sign-off")).not.toBeInTheDocument();
  });

  it("shows eligible compliance users when step is compliance_signoff and users exist", () => {
    const complianceUsers = [
      { userId: "u1", role: "ca" },
      { userId: "u2", role: "senior_accountant" },
    ];
    render(
      <StepCard
        {...baseProps}
        step={{ ...baseStep, type: "compliance_signoff" }}
        complianceSignoffUsers={complianceUsers}
      />
    );

    expect(screen.getByText("Eligible compliance sign-off users:")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com (ca)")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com (senior_accountant)")).toBeInTheDocument();
  });

  it("shows warning when compliance_signoff step has no eligible users", () => {
    render(
      <StepCard
        {...baseProps}
        step={{ ...baseStep, type: "compliance_signoff" }}
        complianceSignoffUsers={[]}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "No users have compliance sign-off capability."
    );
    expect(screen.getByText("Grant capability in Users section")).toBeInTheDocument();
  });

  it("does not show compliance section for non-compliance_signoff steps", () => {
    render(
      <StepCard
        {...baseProps}
        step={{ ...baseStep, type: "approval" }}
        complianceSignoffUsers={[{ userId: "u1", role: "ca" }]}
      />
    );

    expect(screen.queryByText("Eligible compliance sign-off users:")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows remove button when stepCount > 1", () => {
    render(<StepCard {...baseProps} stepCount={2} />);
    expect(screen.getByText("Remove")).toBeInTheDocument();
  });

  it("hides remove button when stepCount is 1", () => {
    render(<StepCard {...baseProps} stepCount={1} />);
    expect(screen.queryByText("Remove")).not.toBeInTheDocument();
  });

  it("resolves userId to email for compliance users", () => {
    render(
      <StepCard
        {...baseProps}
        step={{ ...baseStep, type: "compliance_signoff" }}
        complianceSignoffUsers={[{ userId: "unknown-id", role: "ca" }]}
      />
    );

    expect(screen.getByText("unknown-id (ca)")).toBeInTheDocument();
  });
});
