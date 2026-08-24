"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  readBrowserAppData,
  saveCustomGame,
  writeBrowserAppData,
  type StoredCustomGame
} from "../../lib/storage";
import { useAppData } from "../../lib/useAppData";
import styles from "./CustomGameForm.module.css";

export function CustomGameForm() {
  const [status, setStatus] = useState("");
  const savedGames = useAppData().customGames;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusAfterDelete = useRef(false);

  useEffect(() => {
    if (!focusAfterDelete.current) return;
    focusAfterDelete.current = false;
    headingRef.current?.focus();
  }, [savedGames]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const decks = Number(form.get("decks"));
    const penetrationMode = String(form.get("penetrationMode"));
    const fixedPenetration = Number(form.get("penetration")) / 100;
    const minimumPenetration = Number(form.get("minimumPenetration")) / 100;
    const maximumPenetration = Number(form.get("maximumPenetration")) / 100;
    const observedPenetration = String(form.get("observations") ?? "")
      .split(/[\s,]+/u)
      .filter(Boolean)
      .map((item) => Number(item) / 100);
    const deviationProfile = String(form.get("deviationProfile"));
    if (name.length < 1 || name.length > 80) {
      setStatus("Name must contain 1 to 80 characters.");
      return;
    }
    const inRange = (value: number) =>
      Number.isFinite(value) && value > 0.4 && value < 0.95;
    if (
      (penetrationMode === "fixed" && !inRange(fixedPenetration)) ||
      (penetrationMode === "range" &&
        (!inRange(minimumPenetration) ||
          !inRange(maximumPenetration) ||
          minimumPenetration > maximumPenetration)) ||
      (penetrationMode === "observed_distribution" &&
        (observedPenetration.length < 2 ||
          observedPenetration.length > 40 ||
          observedPenetration.some((value) => !inRange(value))))
    ) {
      setStatus(
        "Use 41% to 94%. Ranges must be ordered and observed mode needs 2 to 40 values."
      );
      return;
    }
    const soft17 = String(form.get("soft17"));
    const das = form.get("das") === "on";
    const rsa = form.get("rsa") === "on";
    const supportedProfile =
      decks === 1 || (decks === 2 && soft17 === "S17")
        ? "basic-strategy-only"
        : decks === 2
          ? das
            ? rsa
              ? "hilo-dd-h17-das-rsa"
              : "hilo-dd-h17-das"
            : "hilo-dd-h17-no-das"
          : soft17 === "S17"
            ? "hi-lo-shoe-s17"
            : das
              ? rsa
                ? "hilo-6d-h17-das-rsa"
                : "hilo-6d-h17-das"
              : "hi-lo-shoe-h17";
    const compatibleProfile =
      deviationProfile === "basic-strategy-only" ||
      deviationProfile === supportedProfile;
    if (!compatibleProfile) {
      setStatus(
        `Choose ${supportedProfile.replaceAll("-", " ")} for this deck count and soft-17 rule.`
      );
      return;
    }
    const id = `custom-${
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, "-")
        .replace(/^-|-$/gu, "")
        .slice(0, 48) || "game"
    }`;
    const current = readBrowserAppData();
    const penetration: StoredCustomGame["penetration"] =
      penetrationMode === "range"
        ? {
            mode: "range",
            minimum: minimumPenetration,
            maximum: maximumPenetration
          }
        : penetrationMode === "observed_distribution"
          ? { mode: "observed_distribution", values: observedPenetration }
          : { mode: "fixed", value: fixedPenetration };
    let next;
    try {
      next = saveCustomGame(current, {
        id,
        name,
        penetration,
        shuffle: String(form.get("shuffle")) as StoredCustomGame["shuffle"],
        rules: {
          decks,
          blackjackPayout: String(form.get("payout")),
          dealerSoft17: String(form.get("soft17")),
          doubleRule: String(form.get("doubleRule")),
          doubleAfterSplit: das,
          resplitAces: rsa,
          hitSplitAces: form.get("hsa") === "on",
          doubleSplitAces: form.get("dsa") === "on",
          surrender: String(form.get("surrender")),
          maxSplitHands: Number(form.get("maxHands")),
          dealerPeek: form.get("peek") === "on",
          burnCard: form.get("burn") === "on",
          deviationProfile
        }
      });
    } catch {
      setStatus("The custom game contains an unsupported rules combination.");
      return;
    }
    if (writeBrowserAppData(next)) {
      setStatus(`Saved ${name} in this browser.`);
    } else {
      setStatus("The game could not be saved in browser storage.");
    }
  }

  function deleteGame(id: string) {
    const current = readBrowserAppData();
    const next = {
      ...current,
      customGames: current.customGames.filter((game) => game.id !== id)
    };
    if (writeBrowserAppData(next)) {
      focusAfterDelete.current = true;
      setStatus("Custom game deleted.");
    } else {
      setStatus("The custom game could not be deleted.");
    }
  }

  return (
    <section className={styles.custom} aria-labelledby="custom-heading">
      <div className={styles.heading}>
        <div>
          <span>Local ruleset</span>
          <h2 id="custom-heading" ref={headingRef} tabIndex={-1}>
            Build a custom game
          </h2>
        </div>
        <p>
          Saved only in this browser. Casino names do not enter engine logic.
        </p>
      </div>
      <form onSubmit={handleSubmit}>
        <label className={styles.wideField}>
          <span>Game name</span>
          <input
            maxLength={80}
            name="name"
            placeholder="Casino game I saw tonight"
            required
          />
        </label>
        <label>
          <span>Decks</span>
          <select defaultValue="6" name="decks">
            {[1, 2, 4, 6, 8].map((decks) => (
              <option key={decks} value={decks}>
                {decks}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Blackjack</span>
          <select defaultValue="3:2" name="payout">
            <option value="3:2">3:2</option>
            <option value="6:5">6:5</option>
          </select>
        </label>
        <label>
          <span>Dealer soft 17</span>
          <select defaultValue="H17" name="soft17">
            <option value="H17">H17</option>
            <option value="S17">S17</option>
          </select>
        </label>
        <label>
          <span>Double rule</span>
          <select defaultValue="any_two" name="doubleRule">
            <option value="any_two">Any two</option>
            <option value="9_10_11">9, 10, or 11</option>
            <option value="10_11">10 or 11</option>
          </select>
        </label>
        <label>
          <span>Surrender</span>
          <select defaultValue="none" name="surrender">
            <option value="none">None</option>
            <option value="late">Late</option>
            <option value="early">Early</option>
          </select>
        </label>
        <label>
          <span>Maximum hands</span>
          <select defaultValue="4" name="maxHands">
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
          </select>
        </label>
        <label>
          <span>Penetration model</span>
          <select defaultValue="fixed" name="penetrationMode">
            <option value="fixed">Fixed</option>
            <option value="range">Realistic range</option>
            <option value="observed_distribution">Observed values</option>
          </select>
        </label>
        <label>
          <span>Fixed penetration</span>
          <div className={styles.suffixedInput}>
            <input
              defaultValue="75"
              max="94"
              min="41"
              name="penetration"
              required
              type="number"
            />
            <b>%</b>
          </div>
        </label>
        <label>
          <span>Range minimum</span>
          <div className={styles.suffixedInput}>
            <input
              defaultValue="70"
              max="94"
              min="41"
              name="minimumPenetration"
              type="number"
            />
            <b>%</b>
          </div>
        </label>
        <label>
          <span>Range maximum</span>
          <div className={styles.suffixedInput}>
            <input
              defaultValue="80"
              max="94"
              min="41"
              name="maximumPenetration"
              type="number"
            />
            <b>%</b>
          </div>
        </label>
        <label className={styles.wideField}>
          <span>Observed penetration values</span>
          <input
            defaultValue="72, 76, 74, 68, 77, 73"
            maxLength={320}
            name="observations"
          />
        </label>
        <label>
          <span>Shuffle behavior</span>
          <select defaultValue="perfect_random" name="shuffle">
            <option value="perfect_random">Perfect random</option>
            <option value="automatic">Automatic shuffle</option>
            <option value="simulated_hand">Simulated hand shuffle</option>
            <option value="continuous">Continuous shuffler</option>
          </select>
        </label>
        <label>
          <span>Hi-Lo deviation profile</span>
          <select defaultValue="hilo-6d-h17-das-rsa" name="deviationProfile">
            <option value="basic-strategy-only">Basic strategy only</option>
            <option value="hilo-dd-h17-no-das">Double deck H17 · no DAS</option>
            <option value="hilo-dd-h17-das">Double deck H17 · DAS</option>
            <option value="hilo-dd-h17-das-rsa">
              Double deck H17 · DAS · RSA
            </option>
            <option value="hilo-6d-h17-das">Six deck H17 · DAS</option>
            <option value="hilo-6d-h17-das-rsa">
              Six deck H17 · DAS · RSA
            </option>
            <option value="hi-lo-shoe-h17">Shoe H17 · generic</option>
            <option value="hi-lo-shoe-s17">Shoe S17</option>
          </select>
        </label>
        <fieldset className={styles.toggles}>
          <legend>Player options</legend>
          <label>
            <input defaultChecked name="das" type="checkbox" /> DAS
          </label>
          <label>
            <input defaultChecked name="rsa" type="checkbox" /> Resplit aces
          </label>
          <label>
            <input name="hsa" type="checkbox" /> Hit split aces
          </label>
          <label>
            <input name="dsa" type="checkbox" /> Double split aces
          </label>
          <label>
            <input defaultChecked name="peek" type="checkbox" /> Dealer peek
          </label>
          <label>
            <input name="burn" type="checkbox" /> Burn card
          </label>
        </fieldset>
        <div className={styles.formFooter}>
          <p aria-live="polite">{status}</p>
          <button type="submit">Save custom game</button>
        </div>
      </form>
      {savedGames.length === 0 ? null : (
        <div className={styles.savedGames}>
          <h3>Saved games</h3>
          {savedGames.map((game) => (
            <div key={game.id}>
              <span>{game.name}</span>
              <small>
                {String(game.rules.decks)}D · {String(game.rules.dealerSoft17)}{" "}
                · {game.shuffle.replaceAll("_", " ")}
              </small>
              <Link href={`/setup?preset=${encodeURIComponent(game.id)}`}>
                Use
              </Link>
              <button onClick={() => deleteGame(game.id)} type="button">
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
