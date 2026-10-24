# Use Nowledge Mem from a hosted AI client

Dots, Grok Bot, Meta Muse and other hosted clients use the same Remote MCP
procedure. Muse has passed real-account Desktop OAuth and a synthetic Thread
save, replay and readback check. Daily execution and personal transcript access
still need verification in your account.

## Connect Muse

1. In Nowledge Mem App, open **Connectors → AI Tools → Meta Muse → Copy setup prompt**.
   Complete browser pairing if prompted, then paste the prompt into Muse.
   Existing connections and active pairing are reused.
2. In Cloud, copy the Muse setup prompt and paste it into Muse. Keep the full
   workspace endpoint, including its query string. No Desktop pairing is needed.

3. Muse displays its real OAuth connect action. Approve only the requested
   context and Thread scopes. Credentials do not belong in chat.
4. Ask Muse to verify a synthetic Thread save, identical replay with zero
   additions and original readback. Then choose your real conversation scope,
   Space, timezone and daily time. A daily task needs its own confirmation.

The [shared skill](SKILL.md#muse-setup) contains the verified custom-client
steps, discovery, request approval handling and response checks. If copying
fails, allow clipboard access and retry the same action. Muse setup happens in
chat; there is no separate Install action or manual-text panel on its card.

## Copy this prompt for a verified connection

```text
Read https://mem.nowledge.co/SKILL.md and https://raw.githubusercontent.com/nowledge-co/community/main/shared/remote-mcp/SKILL.md. Follow the shared guide and save the full skill. Reuse the connection, confirmed Space and schedule settings. Sync the current conversation's originals once a day to the same Thread; do not replace them with a Memory. Report the connection, skill saved location and actual status of the daily task. If setup is incomplete, explain why.
```

```text
读取 https://mem.nowledge.co/SKILL.md 和 https://raw.githubusercontent.com/nowledge-co/community/main/shared/remote-mcp/SKILL.md，按共享指南配置并保存完整 skill。复用已有连接、已确认的 Space 和时间设置；默认每天一次同步当前对话原文到同一 Thread，不替换为 Memory。完成后报告连接、skill 保存位置和每日任务的实际状态；无法完成时说明原因。
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
