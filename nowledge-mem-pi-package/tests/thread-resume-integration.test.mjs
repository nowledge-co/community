import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import test from "node:test";
import extension from "../extensions/nowledge-mem.ts";

test("Pi boots exact context, appends only native turns, and never recreates deleted target", async () => {
    const root = mkdtempSync(join(tmpdir(), "nmem-pi-resume-"));
    const priorPath = process.env.PATH;
    const priorCliPath = process.env.NMEM_CLI_PATH;
    const priorFetch = globalThis.fetch;
    const target = { thread_id: "selected-thread", thread_storage_id: "storage-1", space_id: "", connection_id: "connection-1" };
    const binding = { binding_id: "binding-1", source: "pi", native_session_id: "pi-native", target };
    const token = Buffer.from(JSON.stringify(target)).toString("base64url");
    const executable = join(root, process.platform === "win32" ? "nmem.cmd" : "nmem");
    const script = join(root,"nmem.cjs");
    const replyPath = join(root, "reply.json");
    writeFileSync(replyPath, JSON.stringify({ binding: null }));
    const body = `const fs=require('node:fs');\nconst args=process.argv;\nconsole.log(args.includes('resume-bootstrap')?fs.readFileSync(${JSON.stringify(replyPath)},'utf8'):JSON.stringify({content:'Working context'}));\n`;
    if (process.platform === "win32") {
        writeFileSync(script,body);
        writeFileSync(executable,`@"${process.execPath}" "${script}" %*\r\n`);
    } else {
        writeFileSync(executable, `#!${process.execPath}\n${body}`);
    }
    chmodSync(executable, 0o700);
    process.env.PATH = `${root}${delimiter}${priorPath}`;
    process.env.NMEM_CLI_PATH = executable;
    const handlers = new Map();
    const entries = [];
    const notices = [];
    const ctx = {
        sessionManager: {
            getSessionId: () => "pi-native", getEntries: () => entries,
            getBranch: () => entries, getCwd: () => root,
        },
        ui: { notify: (message) => notices.push(message) },
    };
    extension({ on: (name, handler) => handlers.set(name, handler), appendEntry: (customType, data) => entries.push({ type: "custom", customType, data }) });
    const requests = [];
    let deleted = false;
    globalThis.fetch = async (url, request) => {
        requests.push({ url, body: JSON.parse(request.body) });
        return new Response(JSON.stringify(deleted ? { error_code: "thread_not_found" } : { success: true, messages_added: 2, total_messages: 5 }), {
            status: deleted ? 404 : 200, headers: { "content-type": "application/json" },
        });
    };
    try {
        await handlers.get("session_start")({}, ctx);
        writeFileSync(replyPath, JSON.stringify({ binding, context: { context_text: "<nmem-thread-resume-context-v1>Verified selected history</nmem-thread-resume-context-v1>" } }));
        const input = await handlers.get("input")({ text: `NMEM_THREAD_RESUME_V1:${token}\n\nContinue the next step.` }, ctx);
        assert.equal(input.action, "transform");
        assert.equal(input.text, "Continue the next step.");
        const bootstrap = await handlers.get("before_agent_start")({ systemPrompt: "System" }, ctx);
        assert.match(bootstrap.systemPrompt, /Verified selected history/);
        entries.push(
            { type: "message", id: "user-1", message: { role: "user", content: [{ type: "text", text: input.text }] } },
            { type: "message", id: "assistant-1", message: { role: "assistant", content: [{ type: "text", text: "Next step completed" }] } },
        );
        await handlers.get("session_before_compact")({}, ctx);
        assert.equal(requests.length, 1);
        assert.ok(requests[0].url.endsWith("/threads/resume/append"));
        assert.equal(requests[0].body.binding_id, "binding-1");
        assert.equal(requests[0].body.messages.length, 2);
        assert.equal(requests[0].body.messages[0].external_id, "pi-entry-user-1");
        assert.ok(!JSON.stringify(requests[0].body).includes("Verified selected history"));
        await handlers.get("session_before_compact")({}, ctx);
        assert.equal(requests.length, 1, "acknowledged native suffix must not replay");
        deleted = true;
        entries.push({ type: "message", id: "user-2", message: { role: "user", content: [{ type: "text", text: "One more step" }] } });
        await handlers.get("session_before_compact")({}, ctx);
        assert.equal(requests.length, 2);
        assert.ok(requests.every((request) => request.url.endsWith("/threads/resume/append")));
        writeFileSync(replyPath, '{}');
        const failed = await handlers.get("input")({ text: "Continue after deletion" }, ctx);
        assert.equal(failed.action, "handled");
        assert.ok(notices.length > 0);
    } finally {
        globalThis.fetch = priorFetch;
        process.env.PATH = priorPath;
        if (priorCliPath === undefined) delete process.env.NMEM_CLI_PATH;
        else process.env.NMEM_CLI_PATH = priorCliPath;
        rmSync(root, { recursive: true, force: true });
    }
});

test("a durable native binding blocks when nmem is unavailable before Pi metadata is saved", async () => {
    const root = mkdtempSync(join(tmpdir(), "nmem-pi-binding-"));
    const previousCli = process.env.NMEM_CLI_PATH;
    const previousConfig = process.env.NMEM_CLI_CONFIG_DIR;
    const nativeId = "pi-bound-before-metadata";
    const nativeKey = createHash("sha256").update(JSON.stringify(["pi", nativeId])).digest("hex");
    mkdirSync(join(root, "thread-resume"));
    writeFileSync(join(root, "thread-resume", `${nativeKey}.json`), "{}");
    process.env.NMEM_CLI_CONFIG_DIR = root;
    process.env.NMEM_CLI_PATH = join(root, "missing-nmem");
    const handlers = new Map();
    const notices = [];
    const ctx = {
        sessionManager: { getSessionId: () => nativeId, getEntries: () => [] },
        ui: { notify: (message) => notices.push(message) },
    };
    extension({ on: (name, handler) => handlers.set(name, handler) });
    try {
        const result = await handlers.get("input")({ text: "Continue" }, ctx);
        assert.equal(result.action, "handled");
        assert.equal(notices.length, 1);
    } finally {
        if (previousCli === undefined) delete process.env.NMEM_CLI_PATH;
        else process.env.NMEM_CLI_PATH = previousCli;
        if (previousConfig === undefined) delete process.env.NMEM_CLI_CONFIG_DIR;
        else process.env.NMEM_CLI_CONFIG_DIR = previousConfig;
        rmSync(root, { recursive: true, force: true });
    }
});
