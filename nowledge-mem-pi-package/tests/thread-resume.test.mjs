import assert from "node:assert/strict";
import test from "node:test";
import { parseResumePrompt, resumeBootstrapArgs, requireResumeReply } from "../extensions/thread-resume.ts";

const target = { thread_id: "精确 ' $(false)", thread_storage_id: "storage", space_id: " Team ", connection_id: "connection" };
const token = Buffer.from(JSON.stringify(target)).toString("base64url");

test("passes the exact target as a locator and keeps actual user instructions", () => {
    assert.deepEqual(parseResumePrompt(`NMEM_THREAD_RESUME_V1:${token}\n\nContinue here.`), {
        locator: token, text: "Continue here.",
    });
    assert.deepEqual(resumeBootstrapArgs("native-1", token), [
        "t", "resume-bootstrap", "--from", "pi", "--session-id", "native-1", "--locator", token,
    ]);
});

test("rejects unsupported protocol versions and missing exact native identity", () => {
    assert.throws(() => parseResumePrompt("NMEM_THREAD_RESUME_V2:abc"));
    assert.throws(() => resumeBootstrapArgs("unknown", token));
    assert.throws(() => resumeBootstrapArgs("", token));
    assert.equal(parseResumePrompt("Independent new task"), undefined);
});

test("a binding without acknowledged bootstrap context cannot start the model", () => {
    assert.throws(() => requireResumeReply({ binding: { binding_id: "binding", target } }, true));
    assert.throws(() => requireResumeReply({ binding: null }, true));
    assert.equal(requireResumeReply({ binding: null }, false), undefined);
    const reply = { binding: { binding_id: "binding", source: "pi", native_session_id: "native-1", target }, context: { context_text: "Verified history" } };
    assert.deepEqual(requireResumeReply(reply, true), reply);
});

test("optional context failure preserves independent work but known binding failures stop", () => {
    assert.equal(requireResumeReply({ binding: null, resume_error: { required: false } }, false), undefined);
    assert.throws(() => requireResumeReply({ binding: null, resume_error: { required: true } }, false));
    assert.throws(() => requireResumeReply({ binding: null, resume_error: { required: false } }, true));
});
