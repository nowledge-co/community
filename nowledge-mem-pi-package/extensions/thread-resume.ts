/** Versioned, credential-free locator shared with the Mem App and nmem CLI. */
export const RESUME_PREFIX = "NMEM_THREAD_RESUME_V1:";
export const RESUME_ENTRY = "nowledge-mem-thread-resume-v1";

export interface ResumeTarget {
    thread_id: string;
    thread_storage_id: string;
    space_id: string;
    connection_id: string;
}

export interface ResumeReply {
    binding: { binding_id: string; source: string; native_session_id: string; target: ResumeTarget };
    context: { context_text: string };
}

export function parseResumePrompt(prompt: string): { locator: string; text: string } | undefined {
    if (!prompt.startsWith("NMEM_THREAD_RESUME_")) return undefined;
    if (!prompt.startsWith(RESUME_PREFIX)) throw new Error("Unsupported Thread resume protocol. Copy a new continuation from Mem.");
    const end = prompt.indexOf("\n");
    const locator = prompt.slice(RESUME_PREFIX.length, end < 0 ? undefined : end);
    if (!locator || locator.length > 16_384 || !/^[A-Za-z0-9_-]+$/.test(locator)) {
        throw new Error("Invalid Thread resume locator.");
    }
    return { locator, text: end < 0 ? "Continue the selected conversation." : prompt.slice(end + 1).trim() };
}

export function resumeBootstrapArgs(nativeId: string, locator?: string): string[] {
    if (!nativeId || nativeId === "unknown") throw new Error("Pi did not provide its exact native session ID.");
    return ["t", "resume-bootstrap", "--from", "pi", "--session-id", nativeId,
        ...(locator ? ["--locator", locator] : [])];
}

export function requireResumeReply(value: unknown, explicit: boolean): ResumeReply | undefined {
    if (!value || typeof value !== "object" || !("binding" in value)) throw new Error("Mem did not acknowledge Thread binding resolution.");
    if ("resume_error" in value) {
        const error = value.resume_error as { required?: boolean; message?: string };
        if (explicit || error?.required) throw new Error(error?.message || "Thread continuation could not be verified. Check the Mem connection and retry.");
        return undefined;
    }
    const reply = value as ResumeReply;
    if (reply.binding === null && !explicit) return undefined;
    if (!reply.binding?.binding_id || !reply.binding?.target?.connection_id || !reply.context?.context_text) {
        throw new Error("Mem did not return verified context for the selected Thread.");
    }
    return reply;
}
