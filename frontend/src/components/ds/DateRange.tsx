import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

export const DATE_RANGE_PRESET_KIND = {
  preset: "preset",
  quarter: "quarter",
  year: "year",
  custom: "custom"
} as const;

export type DateRangePresetKind =
  (typeof DATE_RANGE_PRESET_KIND)[keyof typeof DATE_RANGE_PRESET_KIND];

export interface DateRangePreset {
  id: string;
  label: string;
  from: string;
  to: string;
  sub?: string;
  kind?: DateRangePresetKind;
}

export interface DateRangeValue {
  from: string;
  to: string;
  presetId?: string;
  label?: string;
}

interface DateRangeProps {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
  presets?: ReadonlyArray<DateRangePreset>;
  quarterPresets?: ReadonlyArray<DateRangePreset>;
  yearPresets?: ReadonlyArray<DateRangePreset>;
  showCustom?: boolean;
  showCompare?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  id?: string;
  triggerLabel?: string;
}

const ISO_DATE_DISPLAY_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "short",
  day: "2-digit"
});

function formatIsoForTrigger(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return ISO_DATE_DISPLAY_FORMATTER.format(new Date(Date.UTC(y, m - 1, d)));
}

function findMatchingPresetId(
  value: DateRangeValue,
  presets: ReadonlyArray<DateRangePreset>
): string | null {
  for (const p of presets) {
    if (p.from === value.from && p.to === value.to) return p.id;
  }
  return null;
}

function pickInitialTab(
  value: DateRangeValue,
  presets: ReadonlyArray<DateRangePreset>,
  quarters: ReadonlyArray<DateRangePreset>,
  years: ReadonlyArray<DateRangePreset>
): DateRangePresetKind {
  if (value.presetId) {
    if (presets.some((p) => p.id === value.presetId)) return DATE_RANGE_PRESET_KIND.preset;
    if (quarters.some((p) => p.id === value.presetId)) return DATE_RANGE_PRESET_KIND.quarter;
    if (years.some((p) => p.id === value.presetId)) return DATE_RANGE_PRESET_KIND.year;
    return DATE_RANGE_PRESET_KIND.custom;
  }
  if (presets.length > 0) return DATE_RANGE_PRESET_KIND.preset;
  if (quarters.length > 0) return DATE_RANGE_PRESET_KIND.quarter;
  if (years.length > 0) return DATE_RANGE_PRESET_KIND.year;
  return DATE_RANGE_PRESET_KIND.custom;
}

function PresetGrid({
  presets,
  activeId,
  onPick,
  testIdPrefix
}: {
  presets: ReadonlyArray<DateRangePreset>;
  activeId: string | null;
  onPick: (preset: DateRangePreset) => void;
  testIdPrefix: string;
}) {
  return (
    <div className="lb-daterange-presets">
      {presets.map((p) => (
        <button
          key={p.id}
          type="button"
          className="lb-daterange-preset"
          data-active={activeId === p.id ? "true" : undefined}
          data-testid={`${testIdPrefix}-${p.id}`}
          onClick={() => onPick(p)}
        >
          {p.label}
          {p.sub ? <span className="lb-daterange-preset-sub">{p.sub}</span> : null}
        </button>
      ))}
    </div>
  );
}

function YearList({
  presets,
  activeId,
  onPick
}: {
  presets: ReadonlyArray<DateRangePreset>;
  activeId: string | null;
  onPick: (preset: DateRangePreset) => void;
}) {
  return (
    <div className="lb-daterange-years">
      {presets.map((f) => (
        <button
          key={f.id}
          type="button"
          className="lb-daterange-year"
          data-active={activeId === f.id ? "true" : undefined}
          data-testid={`lb-daterange-year-${f.id}`}
          onClick={() => onPick(f)}
        >
          <span>{f.label}</span>
          <span className="lb-daterange-year-range">
            {formatIsoForTrigger(f.from)} → {formatIsoForTrigger(f.to)}
          </span>
        </button>
      ))}
    </div>
  );
}

function CustomFields({
  initialFrom,
  initialTo,
  onApply
}: {
  initialFrom: string;
  initialTo: string;
  onApply: (from: string, to: string) => void;
}) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const valid = from !== "" && to !== "" && from <= to;
  return (
    <div className="lb-daterange-custom">
      <div className="lb-daterange-custom-grid">
        <label className="lb-daterange-custom-field">
          <span className="lb-daterange-custom-label">From</span>
          <input
            type="date"
            className="lb-daterange-custom-input"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            data-testid="lb-daterange-custom-from"
          />
        </label>
        <label className="lb-daterange-custom-field">
          <span className="lb-daterange-custom-label">To</span>
          <input
            type="date"
            className="lb-daterange-custom-input"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            data-testid="lb-daterange-custom-to"
          />
        </label>
      </div>
      <button
        type="button"
        className="lb-daterange-apply"
        disabled={!valid}
        onClick={() => onApply(from, to)}
        data-testid="lb-daterange-apply"
      >
        Apply range
      </button>
    </div>
  );
}

export function DateRange({
  value,
  onChange,
  presets = [],
  quarterPresets = [],
  yearPresets = [],
  showCustom = true,
  showCompare = true,
  disabled = false,
  ariaLabel,
  id,
  triggerLabel
}: DateRangeProps) {
  const reactId = useId();
  const triggerId = id ?? `${reactId}-trigger`;
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const initialTab = useMemo(
    () => pickInitialTab(value, presets, quarterPresets, yearPresets),
    [value, presets, quarterPresets, yearPresets]
  );
  const [tab, setTab] = useState<DateRangePresetKind>(initialTab);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const presetActiveId = useMemo(() => findMatchingPresetId(value, presets), [value, presets]);
  const quarterActiveId = useMemo(
    () => findMatchingPresetId(value, quarterPresets),
    [value, quarterPresets]
  );
  const yearActiveId = useMemo(
    () => findMatchingPresetId(value, yearPresets),
    [value, yearPresets]
  );

  const commit = useCallback(
    (next: DateRangeValue) => {
      onChange(next);
      setOpen(false);
    },
    [onChange]
  );

  const onPickPreset = (kind: DateRangePresetKind) => (preset: DateRangePreset) => {
    commit({ from: preset.from, to: preset.to, presetId: preset.id, label: preset.label });
    void kind;
  };

  const onApplyCustom = (from: string, to: string) => {
    commit({ from, to, label: "Custom" });
  };

  const triggerText =
    triggerLabel ?? value.label ?? (presetActiveId
      ? presets.find((p) => p.id === presetActiveId)?.label
      : undefined) ?? "Custom";

  const tabs = useMemo(() => {
    const out: Array<{ id: DateRangePresetKind; label: string; visible: boolean }> = [
      { id: DATE_RANGE_PRESET_KIND.preset, label: "Presets", visible: presets.length > 0 },
      { id: DATE_RANGE_PRESET_KIND.quarter, label: "Quarter", visible: quarterPresets.length > 0 },
      { id: DATE_RANGE_PRESET_KIND.year, label: "Financial year", visible: yearPresets.length > 0 },
      { id: DATE_RANGE_PRESET_KIND.custom, label: "Custom", visible: showCustom }
    ];
    return out.filter((t) => t.visible);
  }, [presets.length, quarterPresets.length, yearPresets.length, showCustom]);

  return (
    <div className="lb-daterange" ref={containerRef}>
      <button
        type="button"
        id={triggerId}
        className="lb-daterange-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setTab(initialTab);
          setOpen((prev) => !prev);
        }}
        data-testid="lb-daterange-trigger"
      >
        <span className="material-symbols-outlined lb-daterange-trigger-icon" aria-hidden="true">
          event
        </span>
        <span className="lb-daterange-trigger-label">{triggerText}</span>
        <span className="lb-daterange-trigger-range" data-testid="lb-daterange-trigger-range">
          {formatIsoForTrigger(value.from)} → {formatIsoForTrigger(value.to)}
        </span>
        <span
          className="material-symbols-outlined lb-daterange-trigger-caret"
          aria-hidden="true"
        >
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>

      {open ? (
        <div
          className="lb-daterange-popover"
          role="dialog"
          aria-label={ariaLabel ?? "Date range"}
          data-testid="lb-daterange-popover"
        >
          {tabs.length > 1 ? (
            <div className="lb-daterange-tablist" role="tablist">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className="lb-daterange-tab"
                  data-active={tab === t.id ? "true" : undefined}
                  data-testid={`lb-daterange-tab-${t.id}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          ) : null}

          {tab === DATE_RANGE_PRESET_KIND.preset && presets.length > 0 ? (
            <PresetGrid
              presets={presets}
              activeId={presetActiveId}
              onPick={onPickPreset(DATE_RANGE_PRESET_KIND.preset)}
              testIdPrefix="lb-daterange-preset"
            />
          ) : null}

          {tab === DATE_RANGE_PRESET_KIND.quarter && quarterPresets.length > 0 ? (
            <PresetGrid
              presets={quarterPresets}
              activeId={quarterActiveId}
              onPick={onPickPreset(DATE_RANGE_PRESET_KIND.quarter)}
              testIdPrefix="lb-daterange-quarter"
            />
          ) : null}

          {tab === DATE_RANGE_PRESET_KIND.year && yearPresets.length > 0 ? (
            <YearList
              presets={yearPresets}
              activeId={yearActiveId}
              onPick={onPickPreset(DATE_RANGE_PRESET_KIND.year)}
            />
          ) : null}

          {tab === DATE_RANGE_PRESET_KIND.custom && showCustom ? (
            <CustomFields
              initialFrom={value.from}
              initialTo={value.to}
              onApply={onApplyCustom}
            />
          ) : null}

          {showCompare ? (
            <div className="lb-daterange-footer">
              <span>Compares to previous period</span>
              <span className="lb-daterange-footer-mono">IST</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
