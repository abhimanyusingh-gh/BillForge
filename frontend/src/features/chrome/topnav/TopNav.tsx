import { useState } from "react";
import { AvatarMenu } from "@/features/chrome/topnav/AvatarMenu";
import { RealmPill } from "@/features/chrome/topnav/RealmPill";
import { RealmPalette } from "@/features/chrome/realm-palette/RealmPalette";
import { useTheme } from "@/state/useTheme";

interface TopNavProps {
  realmLabel: string;
}

export function TopNav({ realmLabel }: TopNavProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { appliedTheme, theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(appliedTheme === "dark" ? "light" : "dark");
  };

  const themeIcon = appliedTheme === "dark" ? "light_mode" : "dark_mode";
  const themeTitle = `Switch to ${appliedTheme === "dark" ? "light" : "dark"} theme${theme === "system" ? " (overrides system)" : ""}`;

  return (
    <header className="app-topnav">
      <RealmPill label={realmLabel} onOpen={() => setPaletteOpen(true)} />
      <div className="topnav-actions">
        <button type="button" className="iconbtn" title="Search — coming in Step 4" disabled aria-label="Search">
          <span className="material-symbols-outlined">search</span>
        </button>
        <button
          type="button"
          className="iconbtn"
          title="Notifications — coming in Step 6"
          disabled
          aria-label="Notifications"
        >
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <button type="button" className="iconbtn" title={themeTitle} onClick={toggleTheme} aria-label="Toggle theme">
          <span className="material-symbols-outlined">{themeIcon}</span>
        </button>
        <AvatarMenu />
      </div>
      <RealmPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </header>
  );
}
