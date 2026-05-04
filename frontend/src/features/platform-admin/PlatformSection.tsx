import type { ReactNode } from "react";
import { HelpTooltip } from "@/components/common/HelpTooltip";

interface PlatformSectionProps {
  title: string;
  icon: string;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  testId?: string;
  helpText?: string;
  subtitle?: string;
}

export function PlatformSection({
  title,
  icon,
  collapsed,
  onToggle,
  children,
  actions,
  className,
  testId,
  helpText,
  subtitle
}: PlatformSectionProps) {
  const sectionClassName = ["pa-card", className].filter(Boolean).join(" ");

  return (
    <section className={sectionClassName} data-testid={testId}>
      <header className="pa-card-head">
        <span className="material-symbols-outlined pa-card-head-icon" aria-hidden="true">{icon}</span>
        <h2>{title}</h2>
        {helpText ? <HelpTooltip text={helpText} /> : null}
        {subtitle ? <span className="pa-card-sub">{subtitle}</span> : null}
        <div className="pa-card-tools">
          {!collapsed ? actions : null}
          <button
            type="button"
            className="app-button app-button-secondary"
            aria-label={`Toggle ${title} section`}
            onClick={onToggle}
          >
            <span className="material-symbols-outlined">{collapsed ? "expand_more" : "expand_less"}</span>
            {collapsed ? "Expand" : "Collapse"}
          </button>
        </div>
      </header>
      {collapsed ? <p className="muted section-collapsed-note pa-card-body">Section collapsed.</p> : children}
    </section>
  );
}
