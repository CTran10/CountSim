import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppShell } from "../components/AppShell";
import "./globals.css";

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
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
