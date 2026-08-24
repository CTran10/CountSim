const fs = require("node:fs");
const path = require("node:path");

const LOCAL_SERVER_PORT = 47_831;
const RUNTIME_MARKER = "trueedge/1";

function resolveServerEntry(resourceRoot, exists = fs.existsSync) {
  const candidates = [
    path.join(resourceRoot, "server.js"),
    path.join(resourceRoot, "apps", "web", "server.js")
  ];
  const entry = candidates.find((candidate) => exists(candidate));
  if (entry === undefined) {
    throw new Error("The bundled TrueEdge server could not be found.");
  }
  return entry;
}

function isAppUrl(candidate, appOrigin) {
  try {
    return new URL(candidate).origin === appOrigin;
  } catch {
    return false;
  }
}

function isAllowedExternalUrl(candidate) {
  try {
    return new URL(candidate).protocol === "https:";
  } catch {
    return false;
  }
}

function isRuntimeResponse(statusCode, marker) {
  return statusCode < 500 && marker === RUNTIME_MARKER;
}

module.exports = {
  LOCAL_SERVER_PORT,
  RUNTIME_MARKER,
  isAllowedExternalUrl,
  isAppUrl,
  isRuntimeResponse,
  resolveServerEntry
};
