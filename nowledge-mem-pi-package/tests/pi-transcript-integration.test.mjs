import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import extension from "../extensions/nowledge-mem.ts";
import { RESUME_ENTRY } from "../extensions/thread-resume.ts";
import { projectCindyUserText } from "../extensions/cindy-dialogue.ts";

const timestamp = "2026-10-29T00:00:00.000Z";
const cindy = JSON.parse(readFileSync(new URL("./fixtures/cindy-context.json", import.meta.url), "utf8"));
const cindyRuntime = {
    CINDY_PI_SESSION_ID: "synthetic-cindy-task",
    CINDY_PI_PERMISSION_FILE: "/synthetic/cindy-permissions.json",
};
let session = 0;
const text = (value) => ({ type: "text", text: value });
const message = (id, role, content, extra = {}) => ({
    type: "message", id, timestamp, message: { role, content, ...extra },
});
const custom = (id, customType, content, extra = {}) => ({
    type: "custom_message", id, timestamp, customType, content, ...extra,
});

function capture(t, entries, source = "pi", runtime = {}, header) {
    const root = mkdtempSync(join(tmpdir(), "nmem-pi-dialogue-"));
    const overrides = {
        NMEM_PLUGIN_SOURCE_APP: source, NMEM_PLUGIN_HOST_LABEL: source === "pi" ? "Pi" : "Step Code",
        NMEM_API_URL: "http://127.0.0.1:14242", NMEM_API_KEY: "fixture-only",
        NMEM_SPACE: "dialogue-fixture", NMEM_SPACE_ID: "dialogue-fixture",
        NMEM_CLI_CONFIG_DIR: root, NMEM_CLI_PATH: join(root, process.platform === "win32" ? "missing-nmem.cmd" : "missing-nmem"),
        NMEM_AGENT_ID: "fixture-agent", NMEM_HOST_AGENT_ID: "fixture-host",
        CINDY_PI_SESSION_ID: "", CINDY_PI_PERMISSION_FILE: "", ...runtime,
    };
    const previous = Object.fromEntries(Object.keys(overrides).map((key) => [key, process.env[key]]));
    Object.assign(process.env, overrides);
    const priorFetch = globalThis.fetch;
    const requests = [];
    let remoteCount = 0;
    globalThis.fetch = async (url, request) => {
        const body = JSON.parse(request.body);
        requests.push({ url, body });
        remoteCount += body.messages.length;
        return Response.json(url.endsWith("/append")
            ? { success: true, messages_added: body.messages.length, total_messages: remoteCount }
            : { thread: { thread_id: body.thread_id, message_count: remoteCount } });
    };
    const handlers = new Map();
    const notices = [];
    const nativeId = `dialogue-fixture-${++session}`;
    const ctx = {
        sessionManager: {
            getSessionId: () => nativeId, getBranch: () => entries, getEntries: () => entries,
            getHeader: () => header,
            getCwd: () => root,
        },
        hasUI: false,
        ui: { notify: (message) => notices.push(message) },
    };
    extension({ on: (event, handler) => handlers.set(event, handler) });
    t.after(async () => {
        try { await handlers.get("session_shutdown")({}, ctx); }
        finally {
            globalThis.fetch = priorFetch;
            for (const [key, value] of Object.entries(previous)) {
                if (value === undefined) delete process.env[key];
                else process.env[key] = value;
            }
            rmSync(root, { recursive: true, force: true });
        }
    });
    return { requests, nativeId, root, cli: overrides.NMEM_CLI_PATH, notices,
        input: (value) => handlers.get("input")({ text: value }, ctx), flush: async () => {
        await handlers.get("input")({ text: "Fixture input" }, ctx);
        await handlers.get("session_before_compact")({}, ctx);
    } };
}

const forkTime = "2026-10-30T00:00:00.000Z";
const parentId = "00000000-0000-4000-8000-000000000029";
const forkHeader = { type: "session", version: 3, timestamp: forkTime,
    parentSession: `/synthetic/2026-10-29T00-00-00-000Z_${parentId}.jsonl` };
const ownMessage = (id, role, content) => ({ ...message(id, role, content), timestamp: "2026-10-30T00:01:00.000Z" });
const inherited = () => [message("parent-u", "user", "Repeated question"),
    message("parent-progress1", "assistant", "INHERITED progress one"),
    message("parent-progress2", "assistant", "INHERITED progress two"),
    message("parent-a", "assistant", "INHERITED main answer")];
const sideQuestion = (question) => [cindy.side, cindy.language, cindy.fork, question].join("\n\n");

// Synthetic shapes derived from the report, not a claim about actual wire bytes.
const scheduled = ["主人开启了自动跟进；这一轮由宿主的任务事件唤醒，不是主人刚说的话。",
    '<untrusted-data>{"event":"synthetic"}</untrusted-data>', "[Scheduled run context]\nSynthetic context",
    "[Routine checkpoint]\nSynthetic checkpoint", "[Silent scheduled run]\nSynthetic instruction"].join("\n\n");
const partner = ["[Task delivery] Host bookkeeping: synthetic", cindy.language,
    "[消息来源] 伙伴 Cindy", "[Session fork · internal context]\nSynthetic fork",
    "[任务来源] 用户原话：保留限制", "Objective: 伙伴补充的合成目标，不要发布"].join("\n\n");

test("Cindy mixed shapes retain their complete original text without claiming authorship", () => {
    for (const original of [scheduled, partner, cindy.channel + "\n\n" + partner]) {
        const result = projectCindyUserText(original, cindyRuntime);
        assert.equal(result.content, original);
        assert.equal(result.ambiguous, true);
        assert.equal(result.origin, undefined);
    }
    for (const original of ["```text\n" + partner + "\n```", "> " + scheduled.replaceAll("\n", "\n> "),
        scheduled.replace("[Silent scheduled run]", "[Unknown run]"),
        partner.replace("[任务来源]", "[未知来源]")]) {
        const result = projectCindyUserText(original, cindyRuntime);
        assert.equal(result.content, original);
        assert.equal(result.ambiguous, undefined);
    }
    assert.equal(projectCindyUserText(partner, {}).ambiguous, undefined);
});

test("Cindy ambiguous shapes defer the branch, including subsequent dialogue", async (t) => {
    for (const original of [scheduled, partner]) {
        await t.test(original === scheduled ? "scheduled" : "partner", async (child) => {
            const entries = [message("u1", "user", "Earlier question"), message("a1", "assistant", "Earlier answer")];
            const { flush, requests } = capture(child, entries, "pi", cindyRuntime);
            await flush();
            assert.equal(requests.length, 1);
            entries.push(message("mixed", "user", original), message("a2", "assistant", "Later answer"),
                message("u3", "user", "Later question"), message("a3", "assistant", "Later response"));
            await flush();
            assert.equal(requests.length, 1);
            assert.equal(entries[2].message.content, original);
        });
    }
});

test("a literal matching Cindy shape is also deferred and cannot create a title", async (t) => {
    const { flush, requests } = capture(t, [message("u", "user", partner), message("a", "assistant", "Answer")], "pi", cindyRuntime);
    await flush();
    assert.equal(requests.length, 0);
});
const parentTarget = { thread_id: "parent-selected", thread_storage_id: "parent-storage", space_id: "", connection_id: "fixture-connection" };
const resumeMarker = (id, target, timestamp) => ({ type: "custom", id, timestamp, customType: RESUME_ENTRY,
    data: { locator: Buffer.from(JSON.stringify(target)).toString("base64url") } });

function writeBindingCli(fixture) {
    const log = join(fixture.root, "cli-calls.jsonl");
    const script = join(fixture.root, "binding-cli.cjs");
    const body = `const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(args) + '\\n');
const index = args.indexOf('--locator');
const target = index < 0 ? ${JSON.stringify(parentTarget)} : JSON.parse(Buffer.from(args[index + 1], 'base64url'));
console.log(JSON.stringify({ binding: { binding_id: 'binding-' + target.thread_id, source: 'pi',
native_session_id: ${JSON.stringify(fixture.nativeId)}, target }, context: { context_text: 'Synthetic selected context' } }));
`;
    writeFileSync(script, body);
    writeFileSync(fixture.cli, process.platform === "win32"
        ? `@"${process.execPath}" "${script}" %*\r\n` : `#!${process.execPath}\n${body}`);
    chmodSync(fixture.cli, 0o700);
    return log;
}

test("A Cindy fork cannot inherit a selected Thread binding before or after its first side turn", async (t) => {
    const entries = [...inherited(), resumeMarker("parent-resume", parentTarget, timestamp)];
    const fixture = capture(t, entries, "pi", cindyRuntime, forkHeader);
    const log = writeBindingCli(fixture);
    // Even a previously persisted child binding must not resurrect an ancestor locator.
    const key = createHash("sha256").update(JSON.stringify(["pi", fixture.nativeId])).digest("hex");
    mkdirSync(join(fixture.root, "thread-resume"));
    writeFileSync(join(fixture.root, "thread-resume", `${key}.json`), "{}");
    assert.equal((await fixture.input("Before the first own user turn")).action, "continue");
    assert.equal(existsSync(log), false, "copied markers must not bootstrap a binding for the child");
    entries.push(ownMessage("u", "user", sideQuestion("Side question")), ownMessage("a", "assistant", "Side answer"));
    await fixture.flush();
    assert.equal(existsSync(log), false);
    assert.ok(fixture.requests[0].url.endsWith("/threads"));
    assert.equal(fixture.requests[0].body.thread_id, `pi-${fixture.nativeId}`);
    assert.equal(fixture.requests[0].body.metadata.pi_parent_session_id, parentId);
    assert.deepEqual(fixture.requests[0].body.messages.map((m) => m.content), ["Side question", "Side answer"]);
});

test("A Cindy child retains its own explicit Thread binding rather than an inherited marker", async (t) => {
    const childTarget = { ...parentTarget, thread_id: "child-selected", thread_storage_id: "child-storage" };
    const entries = [...inherited(), resumeMarker("parent-resume", parentTarget, timestamp),
        resumeMarker("child-resume", childTarget, forkTime), ownMessage("u", "user", sideQuestion("Side question")),
        ownMessage("a", "assistant", "Side answer")];
    const fixture = capture(t, entries, "pi", cindyRuntime, forkHeader);
    const log = writeBindingCli(fixture);
    await fixture.flush();
    assert.equal(existsSync(log), true);
    assert.ok(fixture.requests[0].url.endsWith("/threads/resume/append"));
    assert.equal(fixture.requests[0].body.binding_id, "binding-child-selected");
    assert.deepEqual(fixture.requests[0].body.messages.map((m) => m.content), ["Side question", "Side answer"]);
});

test("Cindy side chats capture only new occurrences, with clean prompts and parent lineage", async (t) => {
    const entries = [...inherited(), ownMessage("side-u1", "user", sideQuestion("Repeated question")),
        ownMessage("side-a1", "assistant", "Side answer")];
    const { flush, requests, nativeId } = capture(t, entries, "pi", cindyRuntime, forkHeader);
    await flush();
    const body = requests[0].body;
    assert.deepEqual(body.messages.map((m) => m.content), ["Repeated question", "Side answer"]);
    assert.deepEqual(body.messages.map((m) => m.metadata.external_id), ["pi-entry-side-u1", "pi-entry-side-a1"]);
    assert.equal(body.messages[0].timestamp, entries[4].timestamp);
    assert.equal(body.thread_id, `pi-${nativeId}`);
    assert.equal(body.metadata.pi_side_session, true);
    assert.equal(body.metadata.pi_parent_session_id, parentId);
    assert.ok(!JSON.stringify(body).includes("INHERITED"));
    assert.ok(!JSON.stringify(body).includes("[Side chat context]"));
    assert.ok(!JSON.stringify(body).includes("[UI language]"));
    assert.ok(!JSON.stringify(body).includes("[Session fork"));
    await flush();
    assert.equal(requests.length, 1);
    entries.push(ownMessage("side-u2", "user", sideQuestion("Next question")),
        ownMessage("side-a2", "assistant", "Next answer"));
    await flush();
    assert.equal(requests.length, 2);
    assert.equal(requests[1].body.expected_message_count, 2);
    assert.deepEqual(requests[1].body.messages.map((m) => m.metadata.external_id), ["pi-entry-side-u2", "pi-entry-side-a2"]);
});

test("Cindy fork shutdown before its first own user turn cannot upload inherited dialogue", async (t) => {
    const entries = inherited();
    const { flush, requests } = capture(t, entries, "pi", cindyRuntime, forkHeader);
    await flush();
    assert.equal(requests.length, 0);
    entries.push(ownMessage("side-u", "user", sideQuestion("New question")), ownMessage("side-a", "assistant", "Answer"));
    await flush();
    assert.deepEqual(requests[0].body.messages.map((m) => m.content), ["New question", "Answer"]);
});

test("An inherited-only Cindy fork remains ineligible for fresh-session Thread continuation", async (t) => {
    const { input, notices, requests } = capture(t, inherited(), "pi", cindyRuntime, forkHeader);
    const target = { thread_id: "selected", thread_storage_id: "storage", space_id: "", connection_id: "connection" };
    const locator = Buffer.from(JSON.stringify(target)).toString("base64url");
    const result = await input(`NMEM_THREAD_RESUME_V1:${locator}\n\nContinue`);
    assert.equal(result.action, "handled");
    assert.match(notices[0], /Start a new Pi session/);
    assert.equal(requests.length, 0);
});

test("Nested Cindy sides start at their own marker rather than an inherited side marker", async (t) => {
    const entries = [message("ancestor-u", "user", sideQuestion("INHERITED side question")),
        message("ancestor-a", "assistant", "INHERITED side answer"),
        ownMessage("u", "user", sideQuestion("    keep indentation")), ownMessage("a", "assistant", "Answer")];
    const { flush, requests } = capture(t, entries, "pi", cindyRuntime, forkHeader);
    await flush();
    assert.deepEqual(requests[0].body.messages.map((m) => m.content), ["    keep indentation", "Answer"]);
});

test("An internal-only side note establishes scope without becoming a user message", async (t) => {
    const { flush, requests } = capture(t, [...inherited(), ownMessage("note", "user", sideQuestion("")),
        ownMessage("u", "user", "Actual question"), ownMessage("a", "assistant", "Answer")], "pi", cindyRuntime, forkHeader);
    await flush();
    assert.deepEqual(requests[0].body.messages.map((m) => m.content), ["Actual question", "Answer"]);
});

test("Cindy ordinary forks retain inherited history and do not infer side scope from quoted notes", async (t) => {
    const quoted = "```text\n" + cindy.side + "\n```\nExplain this example";
    const entries = [...inherited(), ownMessage("u", "user", quoted), ownMessage("a", "assistant", "Answer")];
    const { flush, requests } = capture(t, entries, "pi", cindyRuntime, forkHeader);
    await flush();
    assert.equal(requests[0].body.messages.length, 6);
    assert.equal(requests[0].body.messages[4].content, quoted);
    assert.equal(requests[0].body.metadata.pi_side_session, undefined);
});

test("Ordinary Pi and other hosts cannot enable Cindy side scope", async (t) => {
    const entries = [...inherited(), ownMessage("u", "user", sideQuestion("Question")), ownMessage("a", "assistant", "Answer")];
    for (const [source, runtime] of [["pi", {}], ["omp", cindyRuntime], ["step-code", cindyRuntime]]) {
        await t.test(source, async (child) => {
            const { flush, requests } = capture(child, entries, source, runtime, forkHeader);
            await flush();
            assert.equal(requests[0].body.messages.length, 6);
            assert.equal(requests[0].body.messages[4].content, sideQuestion("Question"));
            assert.equal(requests[0].body.metadata.pi_side_session, undefined);
        });
    }
});

test("Cindy missing or ambiguous fork metadata cannot discard prior dialogue", async (t) => {
    const entries = [...inherited(), ownMessage("u", "user", sideQuestion("Question")), ownMessage("a", "assistant", "Answer")];
    const variants = [undefined, { ...forkHeader, parentSession: undefined }, { ...forkHeader, timestamp: "invalid" }];
    for (const [index, header] of variants.entries()) {
        await t.test(`metadata variant ${index}`, async (child) => {
            const { flush, requests } = capture(child, entries, "pi", cindyRuntime, header);
            await flush();
            assert.equal(requests[0].body.messages.length, 6);
            assert.equal(requests[0].body.messages[4].content, "Question");
            assert.equal(requests[0].body.metadata.pi_side_session, undefined);
        });
    }
});

test("Cindy forks with undated user entries retain their existing history", async (t) => {
    const entries = [...inherited(), ownMessage("u", "user", sideQuestion("Question")), ownMessage("a", "assistant", "Answer")];
    delete entries[0].timestamp;
    const { flush, requests } = capture(t, entries, "pi", cindyRuntime, forkHeader);
    await flush();
    assert.equal(requests[0].body.messages.length, 6);
    assert.equal(requests[0].body.metadata.pi_side_session, undefined);
});

test("A later side marker cannot discard earlier dialogue in an ordinary Cindy fork", async (t) => {
    const entries = [message("ancestor-u", "user", sideQuestion("Ancestor question")),
        message("ancestor-a", "assistant", "Ancestor answer"), ownMessage("u1", "user", "First local question"),
        ownMessage("a1", "assistant", "Answer"), ownMessage("u2", "user", sideQuestion("Later question")),
        ownMessage("a2", "assistant", "Answer")];
    const { flush, requests } = capture(t, entries, "pi", cindyRuntime, forkHeader);
    await flush();
    assert.equal(requests[0].body.messages.length, 6);
    assert.equal(requests[0].body.metadata.pi_side_session, undefined);
});

test("Pi sends only human dialogue through its native lifecycle", async (t) => {
    const { flush, requests, nativeId } = capture(t, [
        message("system", "system", [text("INTERNAL prompt and tools")]),
        message("developer", "developer", "INTERNAL developer context"),
        custom("injected", "skill-context", "INTERNAL expanded skill", { display: true }),
        message("custom", "custom", "INTERNAL injected context"),
        message("user", "user", [text("Check this file"), { type: "image", data: "INTERNAL base64" }]),
        message("call", "assistant", [{ type: "toolCall", name: "read", arguments: { path: "secret" } }]),
        message("result", "toolResult", [text("INTERNAL tool output")]),
        message("thinking", "assistant", [{ type: "thinking", thinking: "INTERNAL reasoning" }]),
        message("commentary", "assistant", [text("I will check it"), { type: "toolCall", name: "bash" }]),
        message("answer", "assistant", [
            { type: "thinking", text: "INTERNAL reasoning with text" },
            text("The file is correct"), { type: "unknown", text: "INTERNAL future block" },
        ]),
        message("bash", "bashExecution", [], { command: "read-secret", output: "INTERNAL shell output" }),
        message("summary", "compactionSummary", [], { summary: "INTERNAL compaction" }),
        message("branch-message", "branchSummary", [], { summary: "INTERNAL branch" }),
        { type: "compaction", id: "compact", summary: "INTERNAL summary" },
        { type: "branch_summary", id: "branch", summary: "INTERNAL summary" },
    ]);
    await flush();
    assert.equal(requests.length, 1);
    const { body } = requests[0];
    assert.equal(body.source, "pi");
    assert.equal(body.thread_id, `pi-${nativeId}`);
    assert.deepEqual(body.messages.map(({ role, content }) => ({ role, content })), [
        { role: "user", content: "Check this file" },
        { role: "assistant", content: "I will check it" },
        { role: "assistant", content: "The file is correct" },
    ]);
    assert.deepEqual(body.messages.map((m) => m.metadata.external_id),
        ["pi-entry-user", "pi-entry-commentary", "pi-entry-answer"]);
    assert.equal(body.messages[2].timestamp, timestamp);
    assert.equal(body.messages[2].metadata.source_app, "pi");
    assert.equal(body.messages[2].metadata.agent_id, "fixture-agent");
    assert.equal(body.space_id, "dialogue-fixture");
    assert.ok(!JSON.stringify(body).includes("INTERNAL"));
});

test("Pi preserves long text and attachment captions without synthetic placeholders", async (t) => {
    const question = "Question " + "u".repeat(21000);
    const answer = "Answer " + "a".repeat(21000);
    const { flush, requests } = capture(t, [
        message("u", "user", [{ type: "image", data: "INTERNAL" }, text(question),
            { type: "file", filename: "report.txt", content: "INTERNAL file data" }]),
        message("a", "assistant", [text(answer)]),
    ]);
    await flush();
    assert.deepEqual(requests[0].body.messages.map((m) => m.content), [question, answer]);
});

test("Pi appends new dialogue occurrences without replaying acknowledged text or noise", async (t) => {
    const entries = [message("u1", "user", "Question"), message("a1", "assistant", "Answer")];
    const { flush, requests } = capture(t, entries);
    await flush();
    await flush();
    assert.equal(requests.length, 1);
    entries.push(message("noise", "toolResult", [text("INTERNAL output")]),
        custom("context", "injected", "INTERNAL context"));
    await flush();
    assert.equal(requests.length, 1, "internal-only additions must not write");
    entries.push(message("u2", "user", "Question"), message("a2", "assistant", [text("Answer")]));
    await flush();
    assert.equal(requests.length, 2);
    assert.ok(requests[1].url.endsWith("/append"));
    assert.equal(requests[1].body.expected_message_count, 2);
    assert.deepEqual(requests[1].body.messages.map((m) => m.metadata.external_id), ["pi-entry-u2", "pi-entry-a2"]);
});

test("Pi does not create a conversation from a user and tool/thinking-only responses", async (t) => {
    const { flush, requests } = capture(t, [message("u", "user", "Question"),
        message("tool", "assistant", [{ type: "toolCall", name: "read" }]),
        message("think", "assistant", [{ type: "thinking", thinking: "INTERNAL" }]),
        message("result", "toolResult", [text("INTERNAL")])]);
    await flush();
    assert.equal(requests.length, 0);
});

test("Step Code keeps its existing capture policy", async (t) => {
    const { flush, requests } = capture(t, [message("u", "user", "Question"),
        message("a", "assistant", [text("Answer"), { type: "toolCall", name: "read" }]),
        message("result", "toolResult", [text("Tool output")])], "step-code");
    await flush();
    assert.deepEqual(requests[0].body.messages.map((m) => m.content), ["Question", "Answer\n[Tool: read]", "Tool output"]);
});

test("Cindy channel, permission, language, client and handoff wrappers leave the actual question", async (t) => {
    const question = "Check the fixture directory\n\nKeep this second paragraph.";
    const wrapped = [cindy.referenceDirectories, cindy.writable, cindy.language, cindy.client,
        cindy.handoff, cindy.channel, question].join("\n\n");
    const { flush, requests } = capture(t, [message("u", "user", [text(wrapped)]),
        message("a", "assistant", "The fixture is correct")], "pi", cindyRuntime);
    await flush();
    const body = requests[0].body;
    assert.deepEqual(body.messages.map((m) => m.content), [question, "The fixture is correct"]);
    assert.equal(body.title, question);
    assert.equal(body.messages[0].metadata.external_id, "pi-entry-u");
    assert.equal(body.messages[0].timestamp, timestamp);
    assert.deepEqual(body.messages[0].metadata.cindy_origin, { channel: "wechat", chat_kind: "direct" });
    assert.ok(!JSON.stringify(body).includes("synthetic-chat"));
    assert.ok(!JSON.stringify(body).includes("synthetic-controller"));
});

test("Cindy group attribution survives without transport identifiers", async (t) => {
    const { flush, requests } = capture(t, [message("u", "user", cindy.group + "\n\nHello"),
        message("a", "assistant", "Hello back")], "pi", cindyRuntime);
    await flush();
    const msg = requests[0].body.messages[0];
    assert.equal(msg.content, "发言人「Fixture Guest」：\nHello");
    assert.deepEqual(msg.metadata.cindy_origin, {
        channel: "wechat", chat_kind: "group", chat_name: "Fixture Group",
        sender_name: "Fixture Guest", sender_is_owner: false,
    });
    assert.ok(!JSON.stringify(msg).includes("synthetic-sender"));
    assert.ok(!JSON.stringify(msg).includes("synthetic-group"));
});

test("Cindy stripping preserves an indented code block in one or separate text parts", async (t) => {
    const code = "    const x = 1;\n    return x;";
    const { flush, requests } = capture(t, [message("u1", "user", cindy.channel + "\n\n" + code),
        message("a1", "assistant", "Answer"), message("u2", "user", [text(cindy.language), text(code)]),
        message("a2", "assistant", "Answer")], "pi", cindyRuntime);
    await flush();
    assert.deepEqual(requests[0].body.messages.map((m) => m.content), [code, "Answer", code, "Answer"]);
});

test("Cindy explicit ownership and empty channel-only messages keep correct attribution", async (t) => {
    const owner = cindy.channel.slice(0, -1) + "，发言人是主人。";
    const guest = cindy.channel.slice(0, -1) + "，发言人「Fixture Guest」(user_id: synthetic-sender)，不是主人。";
    const anonymous = cindy.channel.slice(0, -1) + "，发言人不是主人。";
    const anonymousGroup = cindy.group.replace("「Fixture Guest」", "").replace("，不是主人", "");
    const { flush, requests } = capture(t, [message("u1", "user", owner + "\n\nHello"),
        message("a1", "assistant", "Answer"), message("internal", "user", cindy.group),
        message("u2", "user", guest + "\n\nHello again"), message("a2", "assistant", "Answer"),
        message("u3", "user", anonymous + "\n\nAnonymous question"), message("a3", "assistant", "Answer"),
        message("u4", "user", anonymousGroup + "\n\nGroup question"), message("a4", "assistant", "Answer")], "pi", cindyRuntime);
    await flush();
    const rows = requests[0].body.messages;
    assert.deepEqual(rows.map((m) => m.content), ["Hello", "Answer", "发言人「Fixture Guest」：\nHello again", "Answer",
        "发言人（非主人）：\nAnonymous question", "Answer", "群聊发言人：\nGroup question", "Answer"]);
    assert.equal(rows[0].metadata.cindy_origin.sender_is_owner, true);
    assert.equal(rows[2].metadata.cindy_origin.sender_is_owner, false);
});

test("Cindy current and legacy mobile notes are removed only as complete templates", async (t) => {
    const mobile = cindy.client.replace("另一台电脑", "手机") + cindy.mobilePreference;
    const legacy = "[客户端说明] 以下为系统每轮自动追加的环境说明,不是用户发来的消息;回复时不要把它当作用户的请求,也不要引用、复述或据此臆测用户意图。本轮请求来自手机客户端(小屏、远程查看被控电脑上的文件)。" + cindy.mobilePreference;
    const unknown = cindy.client.replace("另一台电脑", "手机") + "This is an unknown trailer.";
    const { flush, requests } = capture(t, [message("u1", "user", mobile + "\n\nFirst question"),
        message("a1", "assistant", "Answer"), message("u2", "user", legacy + "\n\nSecond question"),
        message("a2", "assistant", "Answer"), message("u3", "user", unknown + "\n\nThird question"),
        message("a3", "assistant", "Answer")], "pi", cindyRuntime);
    await flush();
    assert.deepEqual(requests[0].body.messages.map((m) => m.content),
        ["First question", "Answer", "Second question", "Answer", unknown + "\n\nThird question", "Answer"]);
});

test("Cindy rebuild/fork and legacy handoff boundaries preserve new input", async (t) => {
    const variants = [cindy.rebuild, cindy.fork,
        cindy.handoff.replace("user's", "user’s"),
        cindy.handoff.replace("== End of handoff note; the user's new message follows ==",
            "== 交接说明结束,以下是用户的新消息 ==")];
    const entries = variants.flatMap((note, i) => [message(`u${i}`, "user", note + "\r\n\r\nQuestion " + i),
        message(`a${i}`, "assistant", "Answer " + i)]);
    const { flush, requests } = capture(t, entries, "pi", cindyRuntime);
    await flush();
    assert.deepEqual(requests[0].body.messages.map((m) => m.content),
        variants.flatMap((_, i) => ["Question " + i, "Answer " + i]));
});

test("Cindy internal-only user rows do not create deltas; repeated human questions retain their IDs", async (t) => {
    const entries = [message("u1", "user", cindy.channel + "\n\nQuestion"), message("a1", "assistant", "Answer")];
    const { flush, requests } = capture(t, entries, "pi", cindyRuntime);
    await flush();
    entries.push(message("internal", "user", [text(cindy.language), text(cindy.writable), text(cindy.handoff)]));
    await flush();
    assert.equal(requests.length, 1);
    entries.push(message("u2", "user", cindy.channel + "\n\nQuestion"), message("a2", "assistant", "Answer"));
    await flush();
    assert.equal(requests.length, 2);
    assert.equal(requests[1].body.expected_message_count, 2);
    assert.deepEqual(requests[1].body.messages.map((m) => [m.content, m.metadata.external_id]),
        [["Question", "pi-entry-u2"], ["Answer", "pi-entry-a2"]]);
});

test("ordinary Pi and incomplete Cindy runtime markers never strip user text", async (t) => {
    const original = cindy.channel + "\n\nQuestion";
    const { flush, requests } = capture(t, [message("u", "user", original), message("a", "assistant", "Answer")],
        "pi", { CINDY_PI_SESSION_ID: cindyRuntime.CINDY_PI_SESSION_ID });
    await flush();
    assert.equal(requests[0].body.messages[0].content, original);
    assert.equal(requests[0].body.messages[0].metadata.cindy_origin, undefined);
});

test("Cindy quotations, code blocks, assistant text and incomplete/unknown wrappers remain verbatim", async (t) => {
    const originals = [
        cindy.side.slice(0, -1) + "\nQuestion",
        cindy.side + " Unknown trailer\nQuestion",
        "```text\n" + cindy.side + "\n```",
        "> " + cindy.side,
        "Explain this note:\n" + cindy.channel,
        "```text\n" + cindy.language + "\n```",
        "> " + cindy.channel,
        "<cindy-extra-writable-directories>\nNo closing tag\nQuestion",
        "[Session handoff · internal context]\nNo terminator\nQuestion",
        "[UI language] A user-written discussion of language settings\nQuestion",
        "[渠道说明] 用户写的说明\nQuestion",
        cindy.channel.replace("微信私聊", "Unknown Channel") + "\n\nQuestion",
        "[渠道说明] 系统追加，不是用户消息。本条来自微信私聊。\n\nQuestion",
        "[客户端说明] 系统追加的环境说明，不是用户消息，不要回应或复述。本轮用户在另一台电脑 上远程操作本机。\n\nQuestion",
        "constructor",
        "__proto__",
        "toString\nThis is an ordinary question.",
    ];
    const entries = originals.flatMap((original, i) => [message(`u${i}`, "user", original),
        message(`a${i}`, "assistant", cindy.channel)]);
    const { flush, requests } = capture(t, entries, "pi", cindyRuntime);
    await flush();
    assert.deepEqual(requests[0].body.messages.map((m) => m.content), originals.flatMap((x) => [x, cindy.channel]));
});

test("Cindy handoff terminators quoted inside code are not mistaken for the wrapper boundary", async (t) => {
    const note = "[Session handoff · internal context]\n```text\n" +
        "== End of handoff note; the user's new message follows ==\n```\nSynthetic history\n" +
        "== End of handoff note; the user's new message follows ==";
    const { flush, requests } = capture(t, [message("u", "user", note + "\n\nQuestion"),
        message("a", "assistant", "Answer")], "pi", cindyRuntime);
    await flush();
    assert.equal(requests[0].body.messages[0].content, "Question");
});

test("Cindy wrappers do not truncate long captions or invent attachment placeholders", async (t) => {
    const caption = "Question " + "u".repeat(21000);
    const answer = "Answer " + "a".repeat(21000);
    const { flush, requests } = capture(t, [message("u", "user", [text(cindy.language), text(cindy.channel),
        text(caption), { type: "image", data: "fixture-only" }]), message("a", "assistant", answer)], "pi", cindyRuntime);
    await flush();
    assert.deepEqual(requests[0].body.messages.map((m) => m.content), [caption, answer]);
});

test("Step Code retains Cindy-labelled text even when launched with Cindy variables", async (t) => {
    const original = cindy.channel + "\n\nQuestion";
    const { flush, requests } = capture(t, [message("u", "user", original), message("a", "assistant", "Answer")],
        "step-code", cindyRuntime);
    await flush();
    assert.equal(requests[0].body.messages[0].content, original);
});
