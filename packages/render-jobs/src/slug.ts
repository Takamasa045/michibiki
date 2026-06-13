const SLUG_FALLBACK = "video";
const SLUG_MAX_LENGTH = 40;

/**
 * Canonical slugify for human-readable output folder names.
 *
 * Mirrors the per-engine slugify helpers in engine-remotion / engine-hyperframes /
 * engine-editframe; those copies are cleanup candidates that should migrate to this
 * shared implementation.
 */
export function slugify(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized.length > 0 ? normalized.slice(0, SLUG_MAX_LENGTH) : SLUG_FALLBACK;
}
