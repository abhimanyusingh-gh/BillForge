/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Badge } from "@/components/ds/Badge";
import { BADGE_STATUS, type BadgeStatus } from "@/types/badgeStatus";

describe("ds/Badge", () => {
  it("renders children as accessible name when no title given", () => {
    render(<Badge>Active</Badge>);
    const badge = screen.getByText("Active");
    expect(badge.tagName).toBe("SPAN");
    expect(badge.getAttribute("role")).toBeNull();
  });

  it("exposes role=img + aria-label when title supplied (dot badge use case)", () => {
    render(<Badge title="3 critical risk signals" tone="danger" />);
    const badge = screen.getByRole("img", { name: "3 critical risk signals" });
    expect(badge).toBeInTheDocument();
  });

  it("applies tone-specific background and foreground styling", () => {
    const { rerender } = render(<Badge tone="success">Valid</Badge>);
    let badge = screen.getByText("Valid");
    expect(badge.style.background).toContain("--badge-valid-bg");
    expect(badge.style.color).toContain("--badge-valid-fg");

    rerender(<Badge tone="danger">Error</Badge>);
    badge = screen.getByText("Error");
    expect(badge.style.background).toContain("--badge-invalid-bg");
  });

  it("applies size-based padding and font-size", () => {
    const { rerender } = render(<Badge size="sm">x</Badge>);
    let badge = screen.getByText("x");
    const smPadding = badge.style.padding;

    rerender(<Badge size="md">x</Badge>);
    badge = screen.getByText("x");
    expect(badge.style.padding).not.toBe(smPadding);
  });

  it("renders icon with aria-hidden when icon prop provided", () => {
    render(<Badge icon="warning">Review</Badge>);
    const badge = screen.getByText("Review");
    const icon = badge.querySelector(".material-symbols-outlined");
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    expect(icon?.textContent).toBe("warning");
  });

  it("forwards className", () => {
    const { container } = render(<Badge className="x-test">Tag</Badge>);
    expect(container.querySelector(".x-test")).not.toBeNull();
  });

  it("renders the title prop as a title attribute on the root element", () => {
    render(<Badge title="Ready to export">Ready to export</Badge>);
    expect(screen.getByText("Ready to export")).toHaveAttribute("title", "Ready to export");
  });

  describe("status prop (invoice pipeline taxonomy)", () => {
    const STATUS_LABEL_BY_VALUE: Record<BadgeStatus, string> = {
      [BADGE_STATUS.PENDING]: "Pending",
      [BADGE_STATUS.PARSED]: "Parsed",
      [BADGE_STATUS.NEEDS_REVIEW]: "Needs review",
      [BADGE_STATUS.AWAITING_APPROVAL]: "Awaiting approval",
      [BADGE_STATUS.APPROVED]: "Approved",
      [BADGE_STATUS.EXPORTED]: "Exported",
      [BADGE_STATUS.FAILED_OCR]: "Failed OCR",
      [BADGE_STATUS.FAILED_PARSE]: "Failed parse"
    };

    const CASES: ReadonlyArray<{ status: BadgeStatus; expectedClass: string }> = [
      { status: BADGE_STATUS.PENDING, expectedClass: "lb-badge-status-pending" },
      { status: BADGE_STATUS.PARSED, expectedClass: "lb-badge-status-parsed" },
      { status: BADGE_STATUS.NEEDS_REVIEW, expectedClass: "lb-badge-status-needs-review" },
      { status: BADGE_STATUS.AWAITING_APPROVAL, expectedClass: "lb-badge-status-awaiting-approval" },
      { status: BADGE_STATUS.APPROVED, expectedClass: "lb-badge-status-approved" },
      { status: BADGE_STATUS.EXPORTED, expectedClass: "lb-badge-status-exported" },
      { status: BADGE_STATUS.FAILED_OCR, expectedClass: "lb-badge-status-failed-ocr" },
      { status: BADGE_STATUS.FAILED_PARSE, expectedClass: "lb-badge-status-failed-parse" }
    ];

    it.each(CASES)(
      "applies the $expectedClass class for status=$status and labels with the README taxonomy",
      ({ status, expectedClass }) => {
        const { container } = render(<Badge status={status} />);
        const badge = container.querySelector(`[data-status="${status}"]`) as HTMLElement | null;
        expect(badge).not.toBeNull();
        expect(badge).toHaveClass("lb-badge-status");
        expect(badge).toHaveClass(expectedClass);
        expect(badge).toHaveTextContent(STATUS_LABEL_BY_VALUE[status]);
      }
    );

    it("renders a status dot by default and omits it when showStatusDot=false", () => {
      const { container, rerender } = render(<Badge status={BADGE_STATUS.APPROVED} />);
      expect(container.querySelector(".lb-badge-status-dot")).not.toBeNull();
      rerender(<Badge status={BADGE_STATUS.APPROVED} showStatusDot={false} />);
      expect(container.querySelector(".lb-badge-status-dot")).toBeNull();
    });

    it("lets children override the auto-derived label", () => {
      render(<Badge status={BADGE_STATUS.NEEDS_REVIEW}>Custom label</Badge>);
      expect(screen.getByText("Custom label")).toBeInTheDocument();
      expect(screen.queryByText("Needs review")).toBeNull();
    });

    it("forwards className alongside status classes", () => {
      const { container } = render(
        <Badge status={BADGE_STATUS.EXPORTED} className="x-extra" />
      );
      const badge = container.querySelector(".lb-badge-status") as HTMLElement | null;
      expect(badge).not.toBeNull();
      expect(badge).toHaveClass("x-extra");
      expect(badge).toHaveClass("lb-badge-status-exported");
    });

    it("uses the auto-derived label as the accessible name when no children are passed", () => {
      render(<Badge status={BADGE_STATUS.APPROVED} />);
      expect(screen.getByText("Approved")).toBeInTheDocument();
    });
  });
});
