"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

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

export function AppShell({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>
      <aside className={styles.sidebar} aria-label="Primary navigation">
        <Link className={styles.brand} href="/" aria-label="TrueEdge home">
          <span aria-hidden="true">TE</span>
          <strong>TrueEdge</strong>
        </Link>
        <nav>
          {NAV_ITEMS.map((item) => {
            const active = matchesPath(pathname, item.href);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={active ? styles.activeNav : styles.navLink}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className={styles.sidebarFoot}>
          <span>Local training</span>
          <p>Virtual funds only</p>
        </div>
      </aside>

      <header className={styles.mobileHeader}>
        <Link className={styles.mobileBrand} href="/">
          <span aria-hidden="true">TE</span>
          <strong>TrueEdge</strong>
        </Link>
        <nav aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const active = matchesPath(pathname, item.href);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                href={item.href}
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
