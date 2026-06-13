const SLUG_FALLBACK = "video";
const SLUG_MAX_LENGTH = 40;

/**
 * Canonical slugify for human-readable folder and project names.
 *
 * Single source of truth shared by render-jobs (output folder names) and the
 * engine adapters (generated project names), so the three previously-duplicated
 * per-engine copies stay in sync.
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
