# Changelog

## 0.1.0

- Add the native Devin manifest, credential-free local MCP connection, and
  namespaced memory skills.
- Capture exact local sessions after turns, compaction, and session end through
  Devin lifecycle hooks and `nmem t sync --from devin --hook-stdin`.
- Support local CLI/Desktop message-tree import and enterprise Cloud v3
  synchronization while keeping child sessions as separate Threads.
