/** Resolve a configured human reference against the authenticated backend roster.
 * Never slugify an ID, invent a Space, or fall back to an unscoped write.
 */
export function resolveSpaceReference(snapshot: unknown, reference: string): string {
  const spaces = (snapshot as { spaces?: unknown })?.spaces;
  if (!Array.isArray(spaces)) throw new Error("Space roster did not contain spaces");
  const exact = spaces.filter(s => s && (s.id === reference || s.key === reference));
  const normalized = reference.trim().normalize("NFKC").toLowerCase();
  const matches = exact.length ? exact : spaces.filter(s => s &&
    [s.name, ...(Array.isArray(s.aliases) ? s.aliases : [])].some(value =>
      typeof value === "string" && value.trim().normalize("NFKC").toLowerCase() === normalized));
  if (matches.length !== 1 || typeof matches[0].id !== "string") {
    throw new Error("Unknown or ambiguous configured Space; choose a Space from nmem spaces list");
  }
  return matches[0].id;
}

/** Resolve only host-configured selectors. Explicit per-call space_id stays exact. */
export async function exactSpaceBody(
  body: unknown, reference: string | undefined,
  load: () => Promise<unknown>,
): Promise<unknown> {
  if (!reference || !body || typeof body !== "object" || Array.isArray(body)) return body;
  const record = body as Record<string, unknown>;
  if (Object.hasOwn(record, "space_id")) return body;
  return { ...record, space_id: resolveSpaceReference(await load(), reference) };
}
