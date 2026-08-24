import desktopPackage from "../../../desktop/package.json";

const GITHUB_API_VERSION = "2026-03-10";
const LATEST_RELEASE_API_URL =
  "https://api.github.com/repos/CTran10/CountSim/releases/latest";
const RELEASE_PATH_PREFIX = "/CTran10/CountSim/releases/";
const VERSION_PATTERN = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export const CURRENT_APP_VERSION = desktopPackage.version;

export interface UpdateCheckResult {
  readonly currentVersion: string;
  readonly latestVersion: string;
  readonly releaseUrl: string;
  readonly updateAvailable: boolean;
}

type FetchRelease = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

function versionParts(version: string): readonly [number, number, number] {
  const match = VERSION_PATTERN.exec(version);
  if (match === null)
    throw new Error("Release version is not valid semantic versioning.");
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isNewerVersion(candidate: string, current: string): boolean {
  const candidateParts = versionParts(candidate);
  const currentParts = versionParts(current);
  for (let index = 0; index < candidateParts.length; index += 1) {
    const candidatePart = candidateParts[index]!;
    const currentPart = currentParts[index]!;
    if (candidatePart !== currentPart) return candidatePart > currentPart;
  }
  return false;
}

function releaseVersion(tagName: string): string {
  versionParts(tagName);
  return tagName.startsWith("v") ? tagName.slice(1) : tagName;
}

function safeReleaseUrl(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    !url.pathname.startsWith(RELEASE_PATH_PREFIX)
  ) {
    throw new Error("Release URL is outside the expected GitHub repository.");
  }
  return url.toString();
}

function githubRelease(value: unknown): {
  readonly html_url: string;
  readonly tag_name: string;
} {
  if (
    typeof value !== "object" ||
    value === null ||
    !("html_url" in value) ||
    typeof value.html_url !== "string" ||
    !("tag_name" in value) ||
    typeof value.tag_name !== "string"
  ) {
    throw new Error("GitHub returned an invalid release response.");
  }
  return { html_url: value.html_url, tag_name: value.tag_name };
}

export async function checkForUpdate(
  fetchRelease: FetchRelease = fetch
): Promise<UpdateCheckResult> {
  const response = await fetchRelease(LATEST_RELEASE_API_URL, {
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": `TrueEdge/${CURRENT_APP_VERSION}`,
      "X-GitHub-Api-Version": GITHUB_API_VERSION
    },
    signal: AbortSignal.timeout(8_000)
  });
  if (!response.ok) {
    throw new Error(
      `GitHub release check failed with status ${response.status}.`
    );
  }

  const release = githubRelease(await response.json());
  const latestVersion = releaseVersion(release.tag_name);
  return {
    currentVersion: CURRENT_APP_VERSION,
    latestVersion,
    releaseUrl: safeReleaseUrl(release.html_url),
    updateAvailable: isNewerVersion(latestVersion, CURRENT_APP_VERSION)
  };
}
