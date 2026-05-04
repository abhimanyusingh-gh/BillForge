import type { AnalyticsOverview } from "@/types";

const TILE_TONE = {
  Default: "default",
  Warn: "warn",
  Violet: "violet",
  Accent: "accent"
} as const;

type TileTone = (typeof TILE_TONE)[keyof typeof TILE_TONE];

interface TileSpec {
  key: string;
  title: string;
  value: string | number;
  sub: string;
  tone: TileTone;
  onClick?: () => void;
}

interface OverviewKpiTilesProps {
  kpis: AnalyticsOverview["kpis"] | null;
  approvedAmountLabel: string;
  onNavigateActionRequired?: () => void;
  onNavigateExports?: () => void;
}

function valueOrDash(v: number | undefined | null): string | number {
  return v == null ? "—" : v;
}

export function OverviewKpiTiles({
  kpis,
  approvedAmountLabel,
  onNavigateActionRequired,
  onNavigateExports
}: OverviewKpiTilesProps) {
  const tiles: TileSpec[] = [
    {
      key: "needs-review",
      title: "Needs review",
      value: valueOrDash(kpis?.needsReviewCount),
      sub: kpis && kpis.needsReviewCount > 0 ? "Open Action Required queue" : "Inbox zero",
      tone: TILE_TONE.Warn,
      onClick: onNavigateActionRequired
    },
    {
      key: "awaiting-approval",
      title: "Awaiting approval",
      value: kpis ? Math.max(kpis.totalInvoices - kpis.approvedCount - kpis.exportedCount - kpis.needsReviewCount, 0) : "—",
      sub: "With approver",
      tone: TILE_TONE.Violet,
      onClick: onNavigateActionRequired
    },
    {
      key: "approved-amount",
      title: "Approved amount",
      value: approvedAmountLabel,
      sub: kpis ? `${kpis.approvedCount} invoices` : "—",
      tone: TILE_TONE.Accent,
      onClick: onNavigateExports
    },
    {
      key: "exported",
      title: "Exported",
      value: valueOrDash(kpis?.exportedCount),
      sub: kpis ? `${kpis.exportedCount} vouchers` : "—",
      tone: TILE_TONE.Default,
      onClick: onNavigateExports
    }
  ];

  return (
    <div className="overview-tile-row" role="list">
      {tiles.map((tile) => {
        const isButton = Boolean(tile.onClick);
        const valueTone = tile.tone === TILE_TONE.Default ? undefined : tile.tone;
        return (
          <button
            key={tile.key}
            type="button"
            role="listitem"
            className="overview-tile"
            data-tile-id={tile.key}
            disabled={!isButton}
            onClick={tile.onClick}
          >
            <span className="overview-tile-label">{tile.title}</span>
            <span className="overview-tile-value lb-num" data-tone={valueTone}>{tile.value}</span>
            <span className="overview-tile-sub">{tile.sub}</span>
          </button>
        );
      })}
    </div>
  );
}
