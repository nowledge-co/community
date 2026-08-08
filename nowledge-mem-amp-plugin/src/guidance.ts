/**
 * Behavioral guidance injected into the agent.
 *
 * Single source of truth for the short guidance text the connector surfaces.
 * The shipped Amp Skill (`skills/nowledge-mem/SKILL.md`) is the long-form
 * version; this constant is the compact form referenced programmatically.
 */

/** Compact behavioral guidance for the `nowledge_mem_*` tools. */
export const BEHAVIORAL_GUIDANCE = `## Nowledge Mem

You have Nowledge Mem tools for cross-tool knowledge management. Use them proactively.

**At session start:** Call \`nowledge_mem_context_bundle\` when identity, scope, or rules may matter. It includes Working Memory, owner identity, AI Identity, active space, and the active rules. Use \`nowledge_mem_working_memory\` only for a lightweight daily briefing or fallback. Reference relevant parts naturally as the conversation progresses.

**When to search (\`nowledge_mem_search\`):**
- The user references previous work, a prior fix, or an earlier decision
- The task resumes a named feature, bug, refactor, or subsystem
- A debugging pattern resembles something solved earlier
- The user asks for rationale, preferences, procedures, or recurring workflow details
- The user uses recall language: "that approach", "like before", "the pattern we used"

**When to save or update:**
Save proactively when the conversation produces a decision, preference, plan, procedure, learning, or important context. Do not wait to be asked. Search first to check for related memories:
- If a related memory exists, call \`nowledge_mem_update\` to refine it
- If genuinely new, call \`nowledge_mem_save\`

**When to search threads (\`nowledge_mem_thread_search\`):**
- The user asks about a prior conversation or exact session history
- A memory result references a source thread

**When to save the session (\`nowledge_mem_save_thread\`):**
- The user asks to save the conversation or "remember this session"
- A long productive session is wrapping up
- The conversation produced decisions or context worth preserving as a full thread
` as const
