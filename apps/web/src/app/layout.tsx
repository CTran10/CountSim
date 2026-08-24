import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppShell } from "../components/AppShell";
import { DEFAULT_THEME, THEME_STORAGE_KEY } from "../lib/theme";
import "./globals.css";

const themeInitScript = `
try {
  const savedTheme = window.localStorage.getItem("${THEME_STORAGE_KEY}");
  if (savedTheme === "dark" || savedTheme === "light") {
    document.documentElement.dataset.theme = savedTheme;
  }
} catch {}
`;

export const metadata: Metadata = {
  title: "TrueEdge | Blackjack training lab",
  description:
    "Practice rule-specific blackjack, Hi-Lo counting, deviations, and session discipline with deterministic virtual shoes."
};

export default function RootLayout({
  children
}: {
  readonly children: ReactNode;
}) {
  return (
    <html data-theme={DEFAULT_THEME} lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
