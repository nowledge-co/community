# Use Nowledge Mem from a hosted AI client

Dots, Grok Bot, and other hosted clients can use the same Remote MCP procedure.
Muse is **pending account verification**. Its connection, message access, and
scheduled execution have not been verified.

## Copy this prompt

```text
Read https://mem.nowledge.co/SKILL.md, then read
https://raw.githubusercontent.com/nowledge-co/community/main/shared/remote-mcp/SKILL.md.
Reuse my Nowledge Mem connection. Help me read context, search knowledge, and save
original conversations in Threads. Set up host-owned sync once a day by default.
Confirm my timezone, execution time, conversations, and target Space. Reuse an
existing matching task. Report daily sync as enabled only after the host confirms
a scheduled task that can access originals and call MCP tools in the background.
If a required capability is missing, report that daily sync is not enabled.
```

```text
先读取 https://mem.nowledge.co/SKILL.md，再读取
https://raw.githubusercontent.com/nowledge-co/community/main/shared/remote-mcp/SKILL.md。
复用我的 Nowledge Mem 连接，读取上下文、检索知识，把对话原文保存为 Threads。
默认由宿主每天同步一次。确认我的时区、执行时间、对话范围与目标 Space，复用已有任务。
只有宿主确认定时任务能在后台读取原文并调用 MCP 后，才报告每日同步已启用。
缺少必要能力时明确报告每日同步尚未启用。
```

## What setup does

1. Choose your Cloud workspace or your App's public Access Anywhere address.
   For App, keep the App and its public connection running at the scheduled time.
2. Complete OAuth. Allow Thread synchronization explicitly; knowledge writes and
   conversation storage have separate permissions. Do not paste credentials in chat.
3. Paste the prompt into your host. A host that can fetch skills can read the
   [shared skill](SKILL.md) directly. Reading a skill alone does not connect Mem.
4. Choose a daily time in your timezone and the conversations and Space to use.
5. Check the host's actual task confirmation. The setup is incomplete if the host
   cannot access originals or call MCP on its schedule. A manual sync can still
   save messages that the host can actually provide.

Conversation originals stay in Threads. One conversation continues in the same
Thread on later days. Memory distillation is separate. A saved snapshot does not
prove that all historical or future host conversations are accessible.

## Check a run

The host should report the Thread identity and message counts after a successful
storage receipt. Repeating the same snapshot must not add duplicate messages.
If no messages changed, there is no need for a notification. If permission,
message access, scheduling, or size limits stop a run, its status must say so.
Do not accept a summary or a reminder as proof that original conversations synced.

The shared skill owns the exact message, permission, retry, and size rules.
Per-host guides should link to it instead of copying a separate sync procedure.
