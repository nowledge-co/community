import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import extension from "../extensions/nowledge-mem.ts";

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

function capture(t, entries, source = "pi", runtime = {}) {
    const root = mkdtempSync(join(tmpdir(), "nmem-pi-dialogue-"));
    const overrides = {
        NMEM_PLUGIN_SOURCE_APP: source, NMEM_PLUGIN_HOST_LABEL: source === "pi" ? "Pi" : "Step Code",
        NMEM_API_URL: "http://127.0.0.1:14242", NMEM_API_KEY: "fixture-only",
        NMEM_SPACE: "dialogue-fixture", NMEM_SPACE_ID: "dialogue-fixture",
        NMEM_CLI_CONFIG_DIR: root, NMEM_CLI_PATH: join(root, "missing-nmem"),
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
    const nativeId = `dialogue-fixture-${++session}`;
    const ctx = {
        sessionManager: {
            getSessionId: () => nativeId, getBranch: () => entries, getEntries: () => entries,
            getCwd: () => root,
        },
        hasUI: false,
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
    return { requests, nativeId, flush: async () => {
        await handlers.get("input")({ text: "Fixture input" }, ctx);
        await handlers.get("session_before_compact")({}, ctx);
    } };
}

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
