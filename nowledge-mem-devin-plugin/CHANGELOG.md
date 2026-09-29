# Changelog

## 0.1.1

- Run lifecycle hooks on Windows. Devin runs hooks in a POSIX shell, which
  cannot find the Desktop's `nmem.cmd` by the bare name `nmem`, so every hook
  exited 127. The hooks now fall back to `nmem.cmd` when `nmem` does not
  resolve.

## 0.1.0

- Add the native Devin manifest, credential-free local MCP connection, and
  namespaced memory skills.
- Capture exact local sessions after turns, compaction, and session end through
  Devin lifecycle hooks and `nmem t sync --from devin --hook-stdin`.
- Support local CLI/Desktop message-tree import and enterprise Cloud v3
  synchronization while keeping child sessions as separate Threads.
