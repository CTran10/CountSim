"use client";

import { getPreset } from "@trueedge/casino-catalog";
import { useSyncExternalStore } from "react";

import {
  APP_DATA_CHANGED_EVENT,
  APP_DATA_KEY,
  readBrowserAppData
} from "./storage";

export const DEFAULT_SELECTED_GAME_ID = "lodge-6d";
export const SELECTED_GAME_STORAGE_KEY = "trueedge.selected-game";

const SELECTED_GAME_CHANGE_EVENT = "trueedge-selected-game-change";
const SELECTED_GAME_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/u;

function validGameId(value: string | null): value is string {
  return value !== null && SELECTED_GAME_ID_PATTERN.test(value);
}

function knownGameId(value: string | null): value is string {
  return (
    validGameId(value) &&
    (getPreset(value) !== undefined ||
      readBrowserAppData().customGames.some((game) => game.id === value))
  );
}

function getStoredSelectedGameId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const selected = window.localStorage.getItem(SELECTED_GAME_STORAGE_KEY);
    return validGameId(selected) ? selected : null;
  } catch {
    return null;
  }
}

export function getSelectedGameSnapshot(): string {
  if (typeof window === "undefined") return DEFAULT_SELECTED_GAME_ID;
  const selected = getStoredSelectedGameId();
  return knownGameId(selected) ? selected : DEFAULT_SELECTED_GAME_ID;
}

export function subscribeToSelectedGame(onStoreChange: () => void): () => void {
  function handleStorage(event: StorageEvent) {
    if (
      event.key === SELECTED_GAME_STORAGE_KEY ||
      event.key === APP_DATA_KEY ||
      event.key === null
    ) {
      onStoreChange();
    }
  }

  window.addEventListener(SELECTED_GAME_CHANGE_EVENT, onStoreChange);
  window.addEventListener(APP_DATA_CHANGED_EVENT, onStoreChange);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(SELECTED_GAME_CHANGE_EVENT, onStoreChange);
    window.removeEventListener(APP_DATA_CHANGED_EVENT, onStoreChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function updateSelectedGameId(gameId: string): void {
  const selected = knownGameId(gameId) ? gameId : DEFAULT_SELECTED_GAME_ID;
  try {
    window.localStorage.setItem(SELECTED_GAME_STORAGE_KEY, selected);
  } catch {}
  window.dispatchEvent(new Event(SELECTED_GAME_CHANGE_EVENT));
}

export function replaceSelectedGameId(
  currentGameId: string,
  nextGameId: string
): void {
  if (getStoredSelectedGameId() === currentGameId) {
    updateSelectedGameId(nextGameId);
  }
}

export function migrateSelectedGameId(
  currentGameId: string,
  nextGameId: string
): void {
  if (getSelectedGameSnapshot() === currentGameId) {
    updateSelectedGameId(nextGameId);
  }
}

export function useSelectedGameId(): string {
  return useSyncExternalStore(
    subscribeToSelectedGame,
    getSelectedGameSnapshot,
    () => DEFAULT_SELECTED_GAME_ID
  );
}
