import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

export interface ComboboxOption<T> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface ComboboxProps<T> {
  options: ReadonlyArray<ComboboxOption<T>>;
  value: T | null;
  onChange: (value: T) => void;
  onClear?: () => void;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  loading?: boolean;
  emptyText?: string;
  searchable?: boolean;
  clearLabel?: string;
  autoOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  id?: string;
  name?: string;
  optionKey: (value: T) => string;
}

const DEFAULT_PLACEHOLDER = "Select...";
const DEFAULT_SEARCH_PLACEHOLDER = "Search...";
const DEFAULT_EMPTY_TEXT = "No matches";
const DEFAULT_LOADING_TEXT = "Loading...";

const KEY = {
  Enter: "Enter",
  Escape: "Escape",
  ArrowDown: "ArrowDown",
  ArrowUp: "ArrowUp",
  Tab: "Tab",
  Space: " "
} as const;

function filterOptions<T>(
  options: ReadonlyArray<ComboboxOption<T>>,
  query: string
): ReadonlyArray<ComboboxOption<T>> {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) return options;
  return options.filter((opt) => {
    if (opt.label.toLowerCase().includes(trimmed)) return true;
    if (opt.description && opt.description.toLowerCase().includes(trimmed)) return true;
    return false;
  });
}

export function Combobox<T>({
  options,
  value,
  onChange,
  onClear,
  label,
  placeholder = DEFAULT_PLACEHOLDER,
  searchPlaceholder = DEFAULT_SEARCH_PLACEHOLDER,
  helperText,
  error,
  disabled = false,
  loading = false,
  emptyText = DEFAULT_EMPTY_TEXT,
  searchable = true,
  clearLabel = "Clear selection",
  autoOpen = false,
  onOpenChange,
  id,
  name,
  optionKey
}: ComboboxProps<T>) {
  const reactId = useId();
  const triggerId = id ?? `${reactId}-trigger`;
  const listboxId = `${reactId}-listbox`;
  const helperId = `${reactId}-helper`;
  const errorId = `${reactId}-error`;

  const [open, setOpenRaw] = useState(autoOpen);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const setOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setOpenRaw((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        if (resolved !== prev) onOpenChange?.(resolved);
        return resolved;
      });
    },
    [onOpenChange]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () => (searchable ? filterOptions(options, query) : options),
    [options, query, searchable]
  );

  const selectedOption = useMemo(() => {
    if (value == null) return null;
    const targetKey = optionKey(value);
    return options.find((opt) => optionKey(opt.value) === targetKey) ?? null;
  }, [options, value, optionKey]);

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
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHighlightedIndex(0);
    if (searchable) {
      const handle = window.setTimeout(() => searchRef.current?.focus(), 0);
      return () => window.clearTimeout(handle);
    }
    return undefined;
  }, [open, searchable]);

  useEffect(() => {
    if (highlightedIndex >= filtered.length) {
      setHighlightedIndex(filtered.length === 0 ? 0 : filtered.length - 1);
    }
  }, [filtered, highlightedIndex]);

  const closeAndRefocus = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const commit = useCallback(
    (option: ComboboxOption<T>) => {
      if (option.disabled) return;
      onChange(option.value);
      setOpen(false);
      triggerRef.current?.focus();
    },
    [onChange]
  );

  const handleTriggerKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;
      if (
        event.key === KEY.Enter ||
        event.key === KEY.Space ||
        event.key === KEY.ArrowDown
      ) {
        event.preventDefault();
        setOpen(true);
      }
    },
    [disabled]
  );

  const handleListKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.key === KEY.Escape) {
        event.preventDefault();
        closeAndRefocus();
        return;
      }
      if (event.key === KEY.ArrowDown) {
        event.preventDefault();
        if (filtered.length === 0) return;
        setHighlightedIndex((prev) => (prev + 1) % filtered.length);
        return;
      }
      if (event.key === KEY.ArrowUp) {
        event.preventDefault();
        if (filtered.length === 0) return;
        setHighlightedIndex(
          (prev) => (prev - 1 + filtered.length) % filtered.length
        );
        return;
      }
      if (event.key === KEY.Enter) {
        event.preventDefault();
        const opt = filtered[highlightedIndex];
        if (opt) commit(opt);
      }
    },
    [filtered, highlightedIndex, commit, closeAndRefocus]
  );

  const triggerLabel = selectedOption ? selectedOption.label : placeholder;
  const isPlaceholder = !selectedOption;
  const describedBy = error ? errorId : helperText ? helperId : undefined;
  const activeDescendant =
    open && filtered[highlightedIndex]
      ? `${listboxId}-option-${optionKey(filtered[highlightedIndex].value)}`
      : undefined;

  return (
    <div className="lb-combobox" ref={containerRef}>
      {label ? (
        <label className="lb-combobox-label" htmlFor={triggerId}>
          {label}
        </label>
      ) : null}
      {name && selectedOption ? (
        <input type="hidden" name={name} value={optionKey(selectedOption.value)} />
      ) : null}
      <button
        type="button"
        ref={triggerRef}
        id={triggerId}
        className={
          "lb-combobox-trigger" +
          (error ? " lb-combobox-trigger-error" : "") +
          (isPlaceholder ? " lb-combobox-trigger-placeholder" : "")
        }
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-disabled={disabled || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="lb-combobox-trigger-label">{triggerLabel}</span>
        <span
          className="material-symbols-outlined lb-combobox-trigger-caret"
          aria-hidden="true"
        >
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>

      {open ? (
        <div className="lb-combobox-popover" onKeyDown={handleListKeyDown}>
          {searchable ? (
            <input
              ref={searchRef}
              type="text"
              className="lb-combobox-search"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label={searchPlaceholder}
              aria-controls={listboxId}
              aria-activedescendant={activeDescendant}
              aria-autocomplete="list"
            />
          ) : null}
          <div
            id={listboxId}
            role="listbox"
            aria-label={label ?? placeholder}
            tabIndex={searchable ? -1 : 0}
            className="lb-combobox-listbox"
          >
            {loading ? (
              <div className="lb-combobox-status">{DEFAULT_LOADING_TEXT}</div>
            ) : null}
            {!loading && onClear && selectedOption ? (
              <button
                type="button"
                className="lb-combobox-option lb-combobox-clear"
                onClick={() => {
                  onClear();
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
              >
                {clearLabel}
              </button>
            ) : null}
            {!loading && filtered.length === 0 ? (
              <div className="lb-combobox-status">{emptyText}</div>
            ) : null}
            {!loading
              ? filtered.map((opt, idx) => {
                  const key = optionKey(opt.value);
                  const isSelected =
                    selectedOption != null &&
                    optionKey(selectedOption.value) === key;
                  const isHighlighted = idx === highlightedIndex;
                  return (
                    <button
                      key={key}
                      id={`${listboxId}-option-${key}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={opt.disabled || undefined}
                      disabled={opt.disabled}
                      className={
                        "lb-combobox-option" +
                        (isSelected ? " lb-combobox-option-selected" : "") +
                        (isHighlighted ? " lb-combobox-option-highlighted" : "")
                      }
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      onClick={() => commit(opt)}
                    >
                      <span className="lb-combobox-option-label">{opt.label}</span>
                      {opt.description ? (
                        <span className="lb-combobox-option-description">
                          {opt.description}
                        </span>
                      ) : null}
                    </button>
                  );
                })
              : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <span id={errorId} className="lb-combobox-error" role="alert">
          {error}
        </span>
      ) : helperText ? (
        <span id={helperId} className="lb-combobox-helper">
          {helperText}
        </span>
      ) : null}
    </div>
  );
}
