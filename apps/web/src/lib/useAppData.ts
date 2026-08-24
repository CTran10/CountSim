"use client";

import { useSyncExternalStore } from "react";

import {
  APP_DATA_CHANGED_EVENT,
  APP_DATA_KEY,
  EMPTY_APP_DATA,
  readAppData,
  type AppData
} from "./storage";

let cachedSerialized: string | null | undefined;
let cachedData: AppData = EMPTY_APP_DATA;

function clientSnapshot(): AppData {
  try {
    const serialized = window.localStorage.getItem(APP_DATA_KEY);
    if (serialized !== cachedSerialized) {
      cachedSerialized = serialized;
      cachedData = readAppData(window.localStorage);
    }
  } catch {
    cachedSerialized = undefined;
    cachedData = EMPTY_APP_DATA;
  }
  return cachedData;
}

function serverSnapshot(): AppData {
  return EMPTY_APP_DATA;
}

function subscribe(onChange: () => void): () => void {
  function handleStorage(event: StorageEvent) {
    if (event.key === APP_DATA_KEY || event.key === null) onChange();
  }
  window.addEventListener("storage", handleStorage);
  window.addEventListener(APP_DATA_CHANGED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(APP_DATA_CHANGED_EVENT, onChange);
  };
}

export function useAppData(): AppData {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
