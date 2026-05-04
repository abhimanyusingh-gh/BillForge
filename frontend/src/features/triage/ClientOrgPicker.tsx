import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import type { ClientOrgOption } from "@/components/workspace/HierarchyBadges";

const PICKER_TITLE_DEFAULT = "Choose a client";
const PICKER_PLACEHOLDER_DEFAULT = "Search by company name...";

interface ClientOrgPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (option: ClientOrgOption) => void;
  clientOrgs: ClientOrgOption[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  activeClientOrgId?: string | null;
  title?: string;
  placeholder?: string;
  emptyHelpText?: string;
  onGoToOnboarding?: () => void;
  testIdPrefix?: string;
  suggested?: ClientOrgOption[];
}

function filterClientOrgs(orgs: ClientOrgOption[], query: string): ClientOrgOption[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) return orgs;
  return orgs.filter((org) => org.companyName.toLowerCase().includes(trimmed));
}

function dedupeSuggested(
  suggested: ClientOrgOption[] | undefined,
  filtered: ClientOrgOption[]
): ClientOrgOption[] {
  if (!suggested || suggested.length === 0) return [];
  const visibleIds = new Set(filtered.map((org) => org.id));
  return suggested.filter((org) => visibleIds.has(org.id));
}

export function ClientOrgPicker({
  open,
  onClose,
  onSelect,
  clientOrgs,
  isLoading,
  isError,
  onRetry,
  activeClientOrgId,
  title = PICKER_TITLE_DEFAULT,
  placeholder = PICKER_PLACEHOLDER_DEFAULT,
  emptyHelpText,
  onGoToOnboarding,
  testIdPrefix = "client-org-picker",
  suggested
}: ClientOrgPickerProps) {
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  useModalDismiss({ open, onClose, options: { saveFocusOnOpen: true, lockScroll: false } });

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHighlightedIndex(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  const filtered = useMemo(
    () => (clientOrgs ? filterClientOrgs(clientOrgs, query) : []),
    [clientOrgs, query]
  );

  const visibleSuggested = useMemo(
    () => dedupeSuggested(suggested, filtered),
    [suggested, filtered]
  );

  const orderedOptions = useMemo(() => {
    if (visibleSuggested.length === 0) return filtered;
    const suggestedIds = new Set(visibleSuggested.map((org) => org.id));
    const remaining = filtered.filter((org) => !suggestedIds.has(org.id));
    return [...visibleSuggested, ...remaining];
  }, [visibleSuggested, filtered]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [orderedOptions]);

  if (!open) return null;

  const isEmpty = !isLoading && !isError && (clientOrgs?.length ?? 0) === 0;
  const hasData = !isLoading && !isError && (clientOrgs?.length ?? 0) > 0;

  function commit(option: ClientOrgOption) {
    onSelect(option);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (orderedOptions.length === 0) return;
      setHighlightedIndex((prev) => (prev + 1) % orderedOptions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (orderedOptions.length === 0) return;
      setHighlightedIndex((prev) => (prev - 1 + orderedOptions.length) % orderedOptions.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = orderedOptions[highlightedIndex];
      if (option) commit(option);
    }
  }

  const activeDescendant = hasData && orderedOptions[highlightedIndex]
    ? `${listboxId}-option-${orderedOptions[highlightedIndex].id}`
    : undefined;
  const suggestedIdSet = new Set(visibleSuggested.map((org) => org.id));

  return (
    <div
      className="popup-overlay realm-switcher-overlay"
      role="presentation"
      onClick={onClose}
      data-testid={`${testIdPrefix}-overlay`}
    >
      <section
        className="popup-card realm-switcher-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${listboxId}-title`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="popup-header">
          <h2 id={`${listboxId}-title`}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close picker">
            Close
          </button>
        </div>

        <input
          ref={inputRef}
          type="text"
          className="input realm-switcher-input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label={placeholder}
          aria-controls={listboxId}
          aria-activedescendant={activeDescendant}
          aria-autocomplete="list"
          data-testid={`${testIdPrefix}-input`}
        />

        {isLoading && (
          <p className="realm-switcher-status" data-testid={`${testIdPrefix}-loading`}>
            Loading clients...
          </p>
        )}

        {isError && (
          <div className="realm-switcher-status realm-switcher-status-error" data-testid={`${testIdPrefix}-error`}>
            <span>Couldn't load your clients.</span>
            <button type="button" className="app-button app-button-secondary" onClick={onRetry}>
              Retry
            </button>
          </div>
        )}

        {isEmpty && (
          <div className="realm-switcher-status" data-testid={`${testIdPrefix}-empty`}>
            <span>{emptyHelpText ?? "No clients yet."}</span>
            {onGoToOnboarding ? (
              <button
                type="button"
                className="app-button app-button-secondary"
                onClick={() => {
                  onGoToOnboarding();
                  onClose();
                }}
              >
                Go to Onboarding
              </button>
            ) : null}
          </div>
        )}

        {hasData && orderedOptions.length === 0 && (
          <p className="realm-switcher-status" data-testid={`${testIdPrefix}-no-match`}>
            No clients match "{query}".
          </p>
        )}

        {hasData && orderedOptions.length > 0 && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Client organizations"
            className="realm-switcher-list"
            data-testid={`${testIdPrefix}-list`}
          >
            {orderedOptions.map((org, idx) => {
              const isActive = org.id === (activeClientOrgId ?? null);
              const isHighlighted = idx === highlightedIndex;
              const isSuggested = suggestedIdSet.has(org.id);
              const optionId = `${listboxId}-option-${org.id}`;
              return (
                <li
                  key={org.id}
                  id={optionId}
                  role="option"
                  aria-selected={isActive}
                  data-testid={`${testIdPrefix}-option-${org.id}`}
                  data-highlighted={isHighlighted ? "true" : undefined}
                  data-active={isActive ? "true" : undefined}
                  data-suggested={isSuggested ? "true" : undefined}
                  className="realm-switcher-option"
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => commit(org)}
                >
                  <span className="realm-switcher-option-name">
                    {org.companyName}
                    {isSuggested ? (
                      <span
                        className="realm-switcher-option-suggested"
                        data-testid={`${testIdPrefix}-suggested-badge-${org.id}`}
                      >
                        Suggested
                      </span>
                    ) : null}
                  </span>
                  {isActive ? (
                    <span className="realm-switcher-option-check" aria-label="Currently active">
                      ✓
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
