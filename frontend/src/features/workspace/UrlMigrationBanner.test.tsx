/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { UrlMigrationBanner, readDismissal, writeDismissal } from "@/features/workspace/UrlMigrationBanner";

const KEY = "ledgerbuddy:url-migration-dismissed:?tab=dashboard->#/invoices";

function renderWithMainLandmark(ui: React.ReactElement) {
  return render(
    <>
      <main id="main-content" tabIndex={-1}>main</main>
      {ui}
    </>
  );
}

describe("UrlMigrationBanner", () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.useRealTimers();
  });

  it("renders the old-path → new-path message with the provided new URL", () => {
    render(<UrlMigrationBanner oldPath="?tab=dashboard" newPath="#/invoices" />);
    expect(screen.getByRole("status")).toHaveTextContent(/This page has moved to/);
    expect(screen.getByText("#/invoices")).toBeInTheDocument();
  });

  it("dismisses on click and persists dismissal as a TTL record in localStorage", () => {
    render(<UrlMigrationBanner oldPath="?tab=dashboard" newPath="#/invoices" />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss url migration/i }));
    expect(screen.queryByRole("status")).toBeNull();

    const raw = window.localStorage.getItem(KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed.dismissed).toBe(true);
    expect(typeof parsed.timestamp).toBe("number");
  });

  it("stays hidden across re-mounts while the TTL is valid", () => {
    const { unmount } = render(<UrlMigrationBanner oldPath="?tab=exports" newPath="#/exports" />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss url migration/i }));
    unmount();

    render(<UrlMigrationBanner oldPath="?tab=exports" newPath="#/exports" />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("re-fires the banner after 30-day TTL expires", () => {
    const olderThanTtl = Date.now() - (31 * 24 * 60 * 60 * 1000);
    window.localStorage.setItem(
      "ledgerbuddy:url-migration-dismissed:?tab=exports->#/exports",
      JSON.stringify({ dismissed: true, timestamp: olderThanTtl })
    );

    render(<UrlMigrationBanner oldPath="?tab=exports" newPath="#/exports" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("keeps one dismissal scoped per old→new pair", () => {
    const { unmount } = render(<UrlMigrationBanner oldPath="?tab=exports" newPath="#/exports" />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss url migration/i }));
    unmount();

    render(<UrlMigrationBanner oldPath="?tab=dashboard" newPath="#/invoices" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("moves focus to #main-content after dismiss", async () => {
    const rafSpy = jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0 as unknown as number;
    });

    renderWithMainLandmark(<UrlMigrationBanner oldPath="?tab=dashboard" newPath="#/invoices" />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss url migration/i }));

    expect(document.activeElement).toBe(document.getElementById("main-content"));
    rafSpy.mockRestore();
  });

  describe("readDismissal/writeDismissal TTL helpers", () => {
    it("returns false when nothing is stored", () => {
      expect(readDismissal("missing-key")).toBe(false);
    });

    it("returns true within TTL window and false once expired", () => {
      const now = 1_700_000_000_000;
      writeDismissal("k", now);
      expect(readDismissal("k", now + 1000)).toBe(true);
      expect(readDismissal("k", now + 31 * 24 * 60 * 60 * 1000)).toBe(false);
    });

    it("ignores malformed records", () => {
      window.localStorage.setItem("k", "not-json");
      expect(readDismissal("k")).toBe(false);
    });
  });
});
