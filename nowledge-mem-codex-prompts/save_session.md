---
description: Save current Codex session to Nowledge knowledge base
---

Use the `nmem t save` command to automatically save the current Codex session:

## Basic Usage

```bash
# Save current session
nmem t save --from codex

# Save with summary
nmem t save --from codex -s "Brief summary of what we accomplished"
```

## Advanced Options

If you need to save a specific session or all sessions:

```bash
# List available sessions for current directory
find ~/.codex/sessions -name "rollout-*.jsonl" -exec sh -c '
  cwd=$(pwd)
  meta=$(head -n1 "$1" | jq -r "select(.payload.cwd == \"$cwd\") | .payload")
  if [ -n "$meta" ]; then
    id=$(echo "$meta" | jq -r ".id")
    ts=$(echo "$meta" | jq -r ".timestamp")
    preview=$(head -n20 "$1" | jq -r "select(.type == \"event_msg\" and .payload.type == \"user_message\" and .payload.kind == \"plain\") | .payload.message" | head -n1 | cut -c1-80)
    echo "$id | $ts | ${preview:-<no preview>}"
  fi
' _ {} \; | sort -r

# Save specific session by ID
nmem t save --from codex --session-id <session-id> -s "Summary"

# Save all sessions for current project
nmem t save --from codex -m all
```

## Workflow

1. **Analyze our conversation** and create a concise 1-2 sentence summary of what we accomplished

2. **Save the session** using the command:
   ```bash
   nmem t save --from codex -s "Your summary here"
   ```

3. **Confirm the save** - The command will show:
   - Thread ID (e.g., `codex-abc123`)
   - Number of messages saved
   - Whether it was created or appended

## Example

```bash
# After completing work on authentication
nmem t save --from codex -s "Implemented JWT authentication with refresh tokens"
```

**Note:** The command is idempotent - re-running it will only append new messages, preventing duplicates.
