import { useEffect, useMemo, useRef, useState } from "react";
import { useClientOrgs } from "@/features/chrome/realm-palette/useClientOrgs";
import { useSessionStore } from "@/state/sessionStore";
import type { ClientOrg } from "@/domain/chrome/clientOrg";

interface RealmPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface Section {
  title: string;
  items: ClientOrg[];
}

function filterByQuery(orgs: ClientOrg[], query: string): ClientOrg[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return orgs;
  return orgs.filter(
    (org) => org.companyName.toLowerCase().includes(q) || org.gstin.toLowerCase().includes(q)
  );
}

function buildSections(filtered: ClientOrg[], recentIds: ClientOrg["id"][]): {
  sections: Section[];
  flat: ClientOrg[];
} {
  const recentSet = new Set(recentIds);
  const recent = filtered.filter((org) => recentSet.has(org.id));
  const others = filtered.filter((org) => !recentSet.has(org.id));
  const sections: Section[] = [];
  if (recent.length > 0) sections.push({ title: "Recent", items: recent });
  if (others.length > 0) sections.push({ title: `All client orgs (${others.length})`, items: others });
  return { sections, flat: [...recent, ...others] };
}

export function RealmPalette({ open, onClose }: RealmPaletteProps) {
  const { orgs, isLoading, error } = useClientOrgs(open);
  const recentIds = useSessionStore((state) => state.recentClientOrgIds);
  const currentId = useSessionStore((state) => state.currentClientOrgId);
  const setCurrent = useSessionStore((state) => state.setCurrentClientOrg);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHighlight(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  const filtered = useMemo(() => filterByQuery(orgs, query), [orgs, query]);
  const { sections, flat } = useMemo(() => buildSections(filtered, recentIds), [filtered, recentIds]);

  useEffect(() => {
    setHighlight((prev) => {
      if (flat.length === 0) return 0;
      return Math.min(prev, flat.length - 1);
    });
  }, [flat.length]);

  if (!open) return null;

  const select = (org: ClientOrg) => {
    setCurrent(org.id);
    onClose();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((prev) => Math.min(flat.length - 1, prev + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((prev) => Math.max(0, prev - 1));
      return;
    }
    if (event.key === "Enter" && flat[highlight]) {
      event.preventDefault();
      select(flat[highlight]);
    }
  };

  let runningIndex = 0;

  return (
    <div className="scrim" onClick={onClose} role="presentation">
      <div className="cmdk" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Client org switcher">
        <div className="cmdk-input">
          <span className="material-symbols-outlined">search</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Switch client org…"
            aria-label="Search client orgs"
          />
          <span className="lb-kbd">Esc</span>
        </div>
        <div className="cmdk-scroll">
          {isLoading ? <div className="cmdk-empty">Loading client orgs…</div> : null}
          {error ? <div className="cmdk-empty cmdk-error">{error}</div> : null}
          {!isLoading && !error && flat.length === 0 ? (
            <div className="cmdk-empty">No client orgs match.</div>
          ) : null}
          {sections.map((section) => (
            <div key={section.title} className="cmdk-section">
              <h4>{section.title}</h4>
              {section.items.map((org) => {
                const index = runningIndex++;
                const isHighlighted = index === highlight;
                const isActive = currentId === org.id;
                return (
                  <button
                    type="button"
                    key={org.id}
                    className={`cmdk-row${isHighlighted ? " highlight" : ""}`}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => select(org)}
                    aria-selected={isHighlighted}
                  >
                    <span className="leading">
                      <span className="material-symbols-outlined cmdk-leading-icon">account_tree</span>
                    </span>
                    <span className="cmdk-row-name">{org.companyName}</span>
                    {isActive ? <span className="meta cmdk-row-active">active</span> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="cmdk-foot">
          <span><span className="kbd">↵</span>Switch</span>
          <span><span className="kbd">↑</span><span className="kbd">↓</span>Navigate</span>
          <span className="cmdk-foot-spacer"><span className="kbd">⌘K</span>Toggle</span>
        </div>
      </div>
    </div>
  );
}
