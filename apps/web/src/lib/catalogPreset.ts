import { getPreset } from "@trueedge/casino-catalog";

export const CATALOG_OVERRIDE_PREFIX = "custom-catalog-";

export function sourceCatalogPresetId(presetId: string): string {
  return presetId.startsWith(CATALOG_OVERRIDE_PREFIX)
    ? presetId.slice(CATALOG_OVERRIDE_PREFIX.length)
    : presetId;
}

export function catalogTableMinimumCents(presetId: string): number | null {
  const preset = getPreset(sourceCatalogPresetId(presetId));
  return (
    preset?.provenance.currentPostedLimits?.minimumCents ??
    preset?.historicalLimits.minimumCents ??
    null
  );
}
