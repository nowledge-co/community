# Use Nowledge Mem from a hosted AI client

Muse, Dots and Grok Bot use the same [full Remote MCP skill](SKILL.md).
Copy a short prompt; the skill owns detailed connection and synchronization rules.
Connect through Remote MCP and authorize tool access with OAuth. The
`sync_thread` tool saves original conversations in Threads.

## Connect Muse

On App versions offering the Muse card, choose **Connectors → AI Tools → Meta
Muse → Copy setup prompt**. Complete browser pairing if prompted and paste into
Muse. Reuse existing connections and active pairing. When the card is absent,
use the App's existing Access Anywhere public MCP URL with the short prompt
below, and complete existing Remote MCP owner pairing when needed. Report a
missing endpoint or pairing control rather than promising unavailable UI.

Cloud uses its complete workspace MCP URL, including `space_protocol=exact-v1`,
without Desktop pairing. Muse displays its real OAuth action; credentials do
not belong in chat. The full skill contains the verified custom-client steps.

## Short prompt

```text
Read https://mem.nowledge.co/SKILL.md and https://mem.nowledge.co/docs/integrations/meta-muse to connect me to Nowledge Mem Remote MCP (OAuth). Use the complete remote URL already provided or confirmed. Follow the shared guide to configure the connection and save the full skill.

Save the current conversation's originals, including this reply, to the same Thread. After each reply, call sync automatically. Check the actual sync status and summarize what you changed.
```

```text
读取 https://mem.nowledge.co/SKILL.md 和 https://mem.nowledge.co/docs/integrations/meta-muse，为我接入 Nowledge Mem 远程 MCP（OAuth），使用已提供或确认的完整远程地址，按共享指南配置并保存完整 skill。

将当前对话原文（含本轮回复）保存到同一 Thread，默认每次回复都自动调用同步。检查同步的实际状态，并总结你改了什么。
```

## Synchronize each reply

Default to an automatic sync for each normal assistant reply, including the
reply's original content in the same Thread and confirmed Space. Read and save
the full skill first. Follow its stable-ID, full-snapshot, permission, receipt
and failure rules. A sync-only receipt must not recursively trigger another
reply/sync. A scheduler is not required by default. Do not silently change
existing schedules.

Report actual connection, skill saved location and synchronization status.
If the host cannot provide originals or call the tool for each reply, report
that automatic sync is not enabled and offer explicit sync or supported export.
A summary is not conversation originals; Memory distillation stays separate.
