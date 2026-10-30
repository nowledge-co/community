import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import extension from "../extensions/nowledge-mem.ts";

const timestamp = "2026-10-29T00:00:00.000Z";
let session = 0;
const text = (value) => ({ type: "text", text: value });
const message = (id, role, content, extra = {}) => ({
    type: "message", id, timestamp, message: { role, content, ...extra },
});
const custom = (id, customType, content, extra = {}) => ({
    type: "custom_message", id, timestamp, customType, content, ...extra,
});

function capture(t, entries, source = "pi") {
    const root = mkdtempSync(join(tmpdir(), "nmem-pi-dialogue-"));
    const overrides = {
        NMEM_PLUGIN_SOURCE_APP: source, NMEM_PLUGIN_HOST_LABEL: source === "pi" ? "Pi" : "Step Code",
        NMEM_API_URL: "http://127.0.0.1:14242", NMEM_API_KEY: "fixture-only",
        NMEM_SPACE: "dialogue-fixture", NMEM_SPACE_ID: "dialogue-fixture",
        NMEM_CLI_CONFIG_DIR: root, NMEM_CLI_PATH: join(root, "missing-nmem"),
        NMEM_AGENT_ID: "fixture-agent", NMEM_HOST_AGENT_ID: "fixture-host",
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
