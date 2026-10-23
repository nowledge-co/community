# Use Nowledge Mem from a hosted AI client

Dots, Grok Bot, Meta Muse and other hosted clients use the same Remote MCP
procedure. Muse has passed real-account Desktop OAuth and a synthetic Thread
save, replay and readback check. Daily execution and personal transcript access
still need verification in your account.

## Connect Muse

1. In Nowledge Mem App, open **Connectors → AI Tools → Meta Muse → Guided setup**.
   Complete browser pairing, then choose **Open Muse** and paste the copied
   setup prompt. Use the same browser for pairing and OAuth approval.
2. In Cloud, choose **Open Muse** from the Cloud OAuth configuration and paste
   its prompt. Keep the full workspace endpoint, including its query string.
3. Muse displays its real OAuth connect action. Approve only the requested
   context and Thread scopes. Credentials do not belong in chat.
4. Ask Muse to verify a synthetic Thread save, identical replay with zero
   additions and original readback. Then choose your real conversation scope,
   Space, timezone and daily time. A daily task needs its own confirmation.

The [shared skill](SKILL.md#muse-setup) contains the verified custom-client
steps, discovery, request approval handling and response checks. If clipboard
access fails, expand **Read or copy manually** in the configuration page.
Opening Muse cannot install a native plugin or enable a daily task by itself.

## Copy this prompt for a verified connection

```text
Read https://mem.nowledge.co/SKILL.md, then read
https://raw.githubusercontent.com/nowledge-co/community/main/shared/remote-mcp/SKILL.md.
Reuse my Nowledge Mem connection. Help me read context, search knowledge, and save
original conversations in Threads. Set up host-owned sync once a day by default.
Use the current conversation and reuse my confirmed Space, timezone, time and
host defaults. Ask only for missing values with no usable default. Reuse one
Thread through durable IDs and mappings; choose its title automatically. Read
and retain the full skill in the host skill store or private connector docs and
report its version and saved location. Reuse an existing matching task. Report daily sync as enabled only after the host confirms
a scheduled task that can access originals and call MCP tools in the background.
If a required capability is missing, report that daily sync is not enabled.
```

```text
先读取 https://mem.nowledge.co/SKILL.md，再读取
https://raw.githubusercontent.com/nowledge-co/community/main/shared/remote-mcp/SKILL.md。
复用我的 Nowledge Mem 连接，读取上下文、检索知识，把对话原文保存为 Threads。
默认由宿主每天同步一次。默认当前对话，复用已确认的 Space、时区、时间和宿主默认值；仅询问没有默认值的缺失项。自动生成标题，用稳定 ID 与持久映射复用同一 Thread。读取并保存完整 skill 到宿主技能库或私有连接器文档，报告版本和保存位置，复用已有任务。
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
