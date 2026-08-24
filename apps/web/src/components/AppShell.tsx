"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";

import { catalogTableMinimumCents } from "../lib/catalogPreset";
import { useSelectedGameId } from "../lib/gamePreference";
import {
  DEFAULT_THEME,
  getThemeSnapshot,
  subscribeToTheme,
  type Theme,
  updateTheme
} from "../lib/theme";
import styles from "./Shell.module.css";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/games", label: "Games" },
  { href: "/setup", label: "Session" },
  { href: "/play", label: "Table" },
  { href: "/drill", label: "Drills" },
  { href: "/review", label: "Review" },
  { href: "/progress", label: "Progress" }
] as const;

function matchesPath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

function navigationHref(href: string, selectedGameId: string): string {
  const preset = encodeURIComponent(selectedGameId);
  if (href === "/setup") return `/setup?preset=${preset}`;
  if (href !== "/play") return href;
  if (selectedGameId.startsWith("custom-")) {
    return `/setup?preset=${preset}`;
  }
  const minimumCents = catalogTableMinimumCents(selectedGameId) ?? 500;
  return `/play?preset=${preset}&minBet=${minimumCents / 100}`;
}

function ThemeToggle({
  onToggle,
  placement,
  theme
}: {
  readonly onToggle: () => void;
  readonly placement: "mobile" | "sidebar";
  readonly theme: Theme;
}) {
  const nextTheme = theme === "dark" ? "light" : "dark";
  const placementClass =
    placement === "sidebar" ? styles.sidebarTheme : styles.mobileTheme;

  return (
    <button
      aria-checked={theme === "dark"}
      aria-label={`Switch to ${nextTheme} mode`}
      className={`${styles.themeToggle} ${placementClass}`}
      onClick={onToggle}
      role="switch"
      type="button"
    >
      <span className={styles.themeLabel}>{theme}</span>
      <span aria-hidden="true" className={styles.themeTrack}>
        <span className={styles.themeThumb} />
      </span>
    </button>
  );
}

export function AppShell({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  const selectedGameId = useSelectedGameId();
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    (): Theme => DEFAULT_THEME
  );

  function toggleTheme() {
    updateTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>
      <aside className={styles.sidebar} aria-label="Primary navigation">
        <ThemeToggle onToggle={toggleTheme} placement="sidebar" theme={theme} />
        <nav>
          {NAV_ITEMS.map((item) => {
            const active = matchesPath(pathname, item.href);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={active ? styles.activeNav : styles.navLink}
                href={navigationHref(item.href, selectedGameId)}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <header className={styles.mobileHeader}>
        <ThemeToggle onToggle={toggleTheme} placement="mobile" theme={theme} />
        <nav aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const active = matchesPath(pathname, item.href);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                href={navigationHref(item.href, selectedGameId)}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className={styles.main} id="main-content">
        {children}
      </main>
    </div>
  );
}
