# Changelog

## 0.1.1

- Fix: prompt-time recall no longer fires on a bare continuation prompt (e.g. "继续"/"continue" typed alone to resume after an interruption). That prompt is also the literal search query, and a query with no content beyond the trigger word surfaced unrelated memories instead of anything about the interrupted turn.

## 0.1.0

- Initial community DeepSeek Harness bundle.
- Adds native Context Bundle injection, prompt-time recall, Mem MCP tools, and turn-end DSH transcript import.
