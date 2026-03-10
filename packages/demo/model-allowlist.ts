/**
 * Model allowlist enforcement for the demo server.
 *
 * Prevents accidental use of expensive paid models.
 * Default: only gpt-5-mini is allowed.
 * Override via DEMO_ALLOWED_MODELS env var (comma-separated).
 */

/** Create a model allowlist Set from a comma-separated string. */
export function createAllowlist(envValue?: string): ReadonlySet<string> {
  const raw = envValue || "gpt-5-mini";
  return new Set(raw.split(",").map(m => m.trim()).filter(Boolean));
}

/** Check if a model is allowed by the allowlist. */
export function isModelAllowed(allowlist: ReadonlySet<string>, model: string): boolean {
  return allowlist.has(model);
}

/** Filter a list of model objects to only allowed models. */
export function filterModels<T extends { id?: string; name?: string }>(
  allowlist: ReadonlySet<string>,
  models: T[],
): T[] {
  return models.filter(m => {
    const id = m.id || m.name || "";
    return allowlist.has(id);
  });
}
