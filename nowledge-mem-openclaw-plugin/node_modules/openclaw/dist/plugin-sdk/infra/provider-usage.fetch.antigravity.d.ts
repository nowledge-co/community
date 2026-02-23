import type { ProviderUsageSnapshot } from "./provider-usage.types.js";
export declare function fetchAntigravityUsage(token: string, timeoutMs: number, fetchFn: typeof fetch): Promise<ProviderUsageSnapshot>;
