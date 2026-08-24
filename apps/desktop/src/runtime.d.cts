export const LOCAL_SERVER_PORT: number;
export const RUNTIME_MARKER: string;
export function resolveServerEntry(
  resourceRoot: string,
  exists?: (candidate: string) => boolean
): string;
export function isAppUrl(candidate: string, appOrigin: string): boolean;
export function isAllowedExternalUrl(candidate: string): boolean;
export function isRuntimeResponse(statusCode: number, marker: string): boolean;
