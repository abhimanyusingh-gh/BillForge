import { useEffect } from "react";

interface RealmPillProps {
  label: string;
  onOpen: () => void;
}

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

export function RealmPill({ label, onOpen }: RealmPillProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "k" && event.key !== "K") return;
      if (!(event.metaKey || event.ctrlKey)) return;
      if (isTextField(event.target)) return;
      event.preventDefault();
      onOpen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpen]);

  return (
    <div className="realm-pill-group">
      <span className="realm-pill-eyebrow">Client org</span>
      <button type="button" className="realm-pill" onClick={onOpen} aria-label="Switch client org">
        <span className="material-symbols-outlined realm-pill-icon">account_tree</span>
        <span className="realm-pill-name">{label}</span>
        <span className="kbd">⌘K</span>
      </button>
    </div>
  );
}
