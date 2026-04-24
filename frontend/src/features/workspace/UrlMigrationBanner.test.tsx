/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { UrlMigrationBanner } from "@/features/workspace/UrlMigrationBanner";

describe("UrlMigrationBanner", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the old-path → new-path message with the provided new URL", () => {
    render(<UrlMigrationBanner oldPath="?tab=dashboard" newPath="#/invoices" />);
    expect(screen.getByRole("status")).toHaveTextContent(/This page has moved to/);
    expect(screen.getByText("#/invoices")).toBeInTheDocument();
  });

  it("dismisses on click and persists dismissal in localStorage", () => {
    const onDismiss = jest.fn();
    const { rerender } = render(
      <UrlMigrationBanner oldPath="?tab=dashboard" newPath="#/invoices" onDismiss={onDismiss} />
    );
    fireEvent.click(screen.getByRole("button", { name: /dismiss url migration/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).toBeNull();

    rerender(<UrlMigrationBanner oldPath="?tab=dashboard" newPath="#/invoices" onDismiss={onDismiss} />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(window.localStorage.getItem("ledgerbuddy:url-migration-dismissed:?tab=dashboard->#/invoices")).toBe("1");
  });

  it("stays hidden across re-mounts once dismissed (different instance, same key)", () => {
    const { unmount } = render(<UrlMigrationBanner oldPath="?tab=exports" newPath="#/exports" />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss url migration/i }));
    unmount();

    render(<UrlMigrationBanner oldPath="?tab=exports" newPath="#/exports" />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("keeps one dismissal scoped per old→new pair", () => {
    const { unmount } = render(<UrlMigrationBanner oldPath="?tab=exports" newPath="#/exports" />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss url migration/i }));
    unmount();

    render(<UrlMigrationBanner oldPath="?tab=dashboard" newPath="#/invoices" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
