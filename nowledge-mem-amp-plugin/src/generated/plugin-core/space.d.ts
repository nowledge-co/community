/** Resolve a configured human reference against the authenticated backend roster.
 * Never slugify an ID, invent a Space, or fall back to an unscoped write.
 */
export declare function resolveSpaceReference(snapshot: unknown, reference: string): string;
/** Resolve only host-configured selectors. Explicit per-call space_id stays exact. */
export declare function exactSpaceBody(body: unknown, reference: string | undefined, load: () => Promise<unknown>): Promise<unknown>;
