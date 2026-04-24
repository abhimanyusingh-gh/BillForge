import type { Invoice } from "@/types";
import { BADGE_SIZE, BADGE_TONE, Badge, type BadgeTone } from "@/components/ds/Badge";
import { type ActionHintKind, getActionHint } from "@/lib/invoice/actionHint";

const TONE_BY_KIND: Record<ActionHintKind, BadgeTone> = {
  Ready: BADGE_TONE.success,
  Pending: BADGE_TONE.info,
  Blocked: BADGE_TONE.danger,
  MissingData: BADGE_TONE.warning,
  Done: BADGE_TONE.neutral
};

const ICON_BY_KIND: Record<ActionHintKind, string> = {
  Ready: "check_circle",
  Pending: "hourglass_empty",
  Blocked: "block",
  MissingData: "report",
  Done: "cloud_done"
};

interface ActionHintBadgeProps {
  invoice: Invoice;
}

export function ActionHintBadge({ invoice }: ActionHintBadgeProps) {
  const hint = getActionHint(invoice);
  if (!hint) return null;
  const tone = TONE_BY_KIND[hint.kind];
  const icon = ICON_BY_KIND[hint.kind];
  return (
    <Badge
      tone={tone}
      size={BADGE_SIZE.sm}
      icon={icon}
      title={hint.text}
      className={`action-hint-badge action-hint-${hint.kind.toLowerCase()}`}
    >
      {hint.text}
    </Badge>
  );
}

