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

function capture(t, entries, source = "omp") {
    const root = mkdtempSync(join(tmpdir(), "nmem-omp-dialogue-"));
    const overrides = {
        NMEM_PLUGIN_SOURCE_APP: source, NMEM_PLUGIN_HOST_LABEL: source === "omp" ? "OMP" : "Step Code",
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
    return { requests, nativeId, flush: () => handlers.get("session_before_compact")({}, ctx) };
}

test("OMP captures human dialogue, not tool activity, injected context, reasoning or summaries", async (t) => {
    const entries = [
        custom("mount", "xdev-mount-notice", "INTERNAL mount context", { attribution: "agent", display: false }),
        custom("advisor", "advisor", "INTERNAL advice", { attribution: "agent", display: true }),
        custom("legacy-context", "plan-mode-context", "INTERNAL legacy context", { display: true }),
        message("injection", "user", [text("INTERNAL continuation")], { attribution: "agent" }),
        message("system", "system", [text("INTERNAL system prompt")]),
        message("developer", "developer", [text("INTERNAL developer prompt")]),
        message("question", "user", [text("Please check the change")], { attribution: "user" }),
        message("tool-call", "assistant", [{ type: "toolCall", name: "read", arguments: { path: "SKILL.md" } }]),
        message("tool-result", "toolResult", [text("INTERNAL tool output / skill body")]),
        message("thinking", "assistant", [{ type: "thinking", thinking: "INTERNAL reasoning" }]),
        message("answer", "assistant", [
            { type: "thinking", text: "INTERNAL reasoning text" },
            text("The change is correct"),
            { type: "toolCall", name: "bash", arguments: { command: "INTERNAL command" } },
            { type: "unknown", text: "INTERNAL future content" },
        ]),
        message("shell", "bashExecution", [], { command: "read-secret", output: "INTERNAL shell output" }),
        message("compacted-message", "compactionSummary", [], { summary: "INTERNAL summary" }),
        { type: "compaction", id: "compaction", summary: "INTERNAL summary" },
        { type: "branch_summary", id: "branch", summary: "INTERNAL summary" },
    ];
    const { flush, requests, nativeId } = capture(t, entries);
    await flush();
    assert.equal(requests.length, 1);
    const { body } = requests[0];
    assert.equal(body.source, "omp");
    assert.equal(body.thread_id, `omp-${nativeId}`);
    assert.equal(body.title, "Please check the change");
    assert.deepEqual(body.messages.map(({ role, content }) => ({ role, content })), [
        { role: "user", content: "Please check the change" },
        { role: "assistant", content: "The change is correct" },
    ]);
    assert.deepEqual(body.messages.map((item) => item.metadata.external_id), ["omp-entry-question", "omp-entry-answer"]);
    assert.equal(body.messages[1].timestamp, timestamp);
    assert.equal(body.messages[1].metadata.source_app, "omp");
    assert.ok(!JSON.stringify(body).includes("INTERNAL"));
});

test("OMP preserves user skill invocations and attachment captions without expanded bodies or placeholders", async (t) => {
    const entries = [
        custom("skill", "skill-prompt", "INTERNAL expanded SKILL.md", {
            attribution: "user", display: true,
            details: { name: "review", args: "this diff", prompt: "Please /skill:review this diff", path: "/skills/review/SKILL.md" },
        }),
        custom("old-skill", "skill-prompt", "INTERNAL legacy skill body", {
            attribution: "user", details: { name: "review", args: "the old draft" },
        }),
        custom("auto-skill", "skill-prompt", "INTERNAL automatic skill", {
            attribution: "agent", details: { name: "review", prompt: "/skill:review auto" },
        }),
        custom("image", "image-attachment", "INTERNAL attachment wrapper", { attribution: "user", display: false }),
        custom("peer", "collab-user-prompt", "A user-authored follow-up", { attribution: "user", display: true }),
        message("nested-skill", "custom", "INTERNAL nested skill body", {
            customType: "skill-prompt", attribution: "user", details: { name: "status" },
        }),
        message("attachments", "user", [text("Look at these"), { type: "image", data: "INTERNAL base64" },
            { type: "file", filename: "report.txt", content: "INTERNAL expanded file" }]),
        message("reply", "assistant", "I reviewed the attachments"),
    ];
    const { flush, requests } = capture(t, entries);
    await flush();
    const messages = requests[0].body.messages;
    assert.deepEqual(messages.map((item) => item.content), [
        "Please /skill:review this diff", "/skill:review the old draft",
        "A user-authored follow-up", "/skill:status", "Look at these",
        "I reviewed the attachments",
    ]);
    assert.ok(messages.slice(0, -1).every((item) => item.role === "user"));
    assert.equal(messages[0].metadata.external_id, "omp-entry-skill");
    assert.equal(messages[0].metadata.pi_custom_type, "skill-prompt");
    assert.ok(!JSON.stringify(messages).includes("INTERNAL"));
});

test("OMP matches the default Codex import's human text projection", async (t) => {
    const reference = JSON.parse(readFileSync(new URL("./fixtures/codex-default-dialogue.json", import.meta.url), "utf8"));
    const { flush, requests } = capture(t, [
        custom("context", "plan-mode-context", "INTERNAL context", { attribution: "agent" }),
        message("user", "user", "Synthetic human question", { attribution: "user" }),
        message("commentary", "assistant", [text("I will check the change")]),
        message("call", "assistant", [{ type: "toolCall", name: "read" }]),
        message("result", "toolResult", [text("INTERNAL tool output")]),
        message("reasoning", "assistant", [{ type: "thinking", thinking: "INTERNAL reasoning" }]),
        message("final", "assistant", [text("Synthetic assistant answer")]),
        custom("skill", "skill-prompt", "INTERNAL expanded skill", {
            attribution: "user", details: { name: "review", prompt: "/skill:review fixture" },
        }),
        custom("image", "image-attachment", "INTERNAL attachment wrapper", { attribution: "user" }),
        message("caption", "user", [text("Look at these"), { type: "image", data: "INTERNAL image" },
            { type: "file", filename: "report.txt", content: "INTERNAL file data" }]),
        message("reply", "assistant", [text("I reviewed the attachments")]),
    ]);
    await flush();
    assert.deepEqual(requests[0].body.messages.map(({ role, content }) => ({ role, content })), reference.messages);
});

test("OMP preserves complete long human text like the default Codex import", async (t) => {
    const question = "Synthetic long user " + "u".repeat(21000);
    const answer = "Synthetic long answer " + "a".repeat(21000);
    const { flush, requests } = capture(t, [message("long-user", "user", question), message("long-answer", "assistant", [text(answer)])]);
    await flush();
    assert.deepEqual(requests[0].body.messages.map((item) => item.content), [question, answer]);
});

test("OMP only appends new dialogue occurrences after an acknowledgement", async (t) => {
    const entries = [message("u1", "user", "First question"), message("a1", "assistant", [text("First answer")])];
    const { flush, requests } = capture(t, entries);
    await flush();
    await flush();
    assert.equal(requests.length, 1, "unchanged dialogue must not replay");
    entries.push(message("noise", "toolResult", [text("INTERNAL late output")]),
        custom("nudge", "mid-run-todo-nudge", "INTERNAL nudge", { attribution: "agent" }));
    await flush();
    assert.equal(requests.length, 1, "new internal events must not trigger a write");
    entries.push(message("u2", "user", [text("First question")], { attribution: "user" }),
        message("a2", "assistant", [text("First answer"), { type: "toolCall", name: "read" }]));
    await flush();
    assert.equal(requests.length, 2);
    assert.ok(requests[1].url.endsWith("/append"));
    assert.equal(requests[1].body.expected_message_count, 2);
    assert.deepEqual(requests[1].body.messages.map((item) => item.metadata.external_id), ["omp-entry-u2", "omp-entry-a2"]);
    assert.deepEqual(requests[1].body.messages.map((item) => item.content), ["First question", "First answer"]);
});

test("an OMP branch containing only injected users and tool activity is not a conversation", async (t) => {
    const { flush, requests } = capture(t, [
        message("fake-user", "user", [text("INTERNAL injected prompt")], { attribution: "agent" }),
        message("tool-call", "assistant", [{ type: "toolCall", name: "read" }]),
        message("result", "toolResult", [text("INTERNAL output")]),
    ]);
    await flush();
    assert.equal(requests.length, 0);
});

test("Step Code keeps its existing capture policy", async (t) => {
    const { flush, requests } = capture(t, [
        message("u", "user", "Question"), message("a", "assistant", [text("Answer"), { type: "toolCall", name: "read" }]),
        message("result", "toolResult", [text("Tool output")]),
    ], "step-code");
    await flush();
    assert.deepEqual(requests[0].body.messages.map((item) => item.content), ["Question", "Answer\n[Tool: read]", "Tool output"]);
});
