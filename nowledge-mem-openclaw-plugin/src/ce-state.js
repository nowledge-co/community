/**
 * Shared mutable state flag for context engine activation.
 *
 * When the CE is bootstrapped, `active` is set to true. Prompt-building hooks
 * use this to avoid duplicate context injection. Capture hooks stay enabled as
 * a safety net because thread sync is already tail-synced and idempotent.
 */
export const ceState = { active: false };
