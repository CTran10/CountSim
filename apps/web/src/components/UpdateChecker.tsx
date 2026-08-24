"use client";

import { useState } from "react";

import type { UpdateCheckResult } from "../lib/updateCheck";
import styles from "./UpdateChecker.module.css";

type UpdateState =
  | { readonly status: "idle" }
  | { readonly status: "checking" }
  | { readonly status: "error" }
  | { readonly result: UpdateCheckResult; readonly status: "complete" };

function isUpdateCheckResult(value: unknown): value is UpdateCheckResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "currentVersion" in value &&
    typeof value.currentVersion === "string" &&
    "latestVersion" in value &&
    typeof value.latestVersion === "string" &&
    "releaseUrl" in value &&
    typeof value.releaseUrl === "string" &&
    "updateAvailable" in value &&
    typeof value.updateAvailable === "boolean"
  );
}

export function UpdateChecker() {
  const [state, setState] = useState<UpdateState>({ status: "idle" });

  async function check() {
    setState({ status: "checking" });
    try {
      const response = await fetch("/api/update-check", { cache: "no-store" });
      const result: unknown = await response.json();
      if (!response.ok || !isUpdateCheckResult(result)) throw new Error();
      setState({ result, status: "complete" });
    } catch {
      setState({ status: "error" });
    }
  }

  const checking = state.status === "checking";
  return (
    <section aria-label="Application updates" className={styles.checker}>
      <button disabled={checking} onClick={() => void check()} type="button">
        {checking ? "Checking for updates" : "Check for updates"}
      </button>
      <div aria-live="polite" className={styles.status}>
        {state.status === "error" ? (
          <p>Could not check for updates. Try again.</p>
        ) : state.status === "complete" ? (
          state.result.updateAvailable ? (
            <p>
              Version {state.result.latestVersion} is available.{" "}
              <a
                href={state.result.releaseUrl}
                rel="noreferrer"
                target="_blank"
              >
                View release
              </a>
            </p>
          ) : (
            <p>TrueEdge {state.result.currentVersion} is up to date.</p>
          )
        ) : null}
      </div>
    </section>
  );
}
