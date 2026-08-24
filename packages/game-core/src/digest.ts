export const DIGEST_ALGORITHM = "fnv1a64-canonical-json-v1" as const;

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) {
      throw new Error("Deterministic data cannot contain undefined values.");
    }
    return serialized;
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }

  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(",")}}`;
}

export function deterministicDigest(value: unknown): string {
  const text = canonicalize(value);
  let hash = 0xcbf29ce484222325n;

  for (let index = 0; index < text.length; index += 1) {
    const codePoint = text.codePointAt(index);
    if (codePoint === undefined) continue;
    hash ^= BigInt(codePoint);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
    if (codePoint > 0xffff) index += 1;
  }

  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}
