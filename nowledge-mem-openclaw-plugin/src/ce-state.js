/**
 * Shared mutable state flag for context engine activation.
 *
 * When the CE is bootstrapped, `active` is set to true. Event hooks
 * check this flag to avoid duplicate work — the CE's lifecycle methods
 * (assemble, afterTurn, etc.) replace hook behavior when active.
 */
export const ceState = { active: false };
