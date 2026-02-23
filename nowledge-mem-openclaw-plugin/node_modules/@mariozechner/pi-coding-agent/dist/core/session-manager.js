import { randomUUID } from "crypto";
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, statSync, writeFileSync, } from "fs";
import { readdir, readFile, stat } from "fs/promises";
import { join, resolve } from "path";
import { getAgentDir as getDefaultAgentDir, getSessionsDir } from "../config.js";
import { createBranchSummaryMessage, createCompactionSummaryMessage, createCustomMessage, } from "./messages.js";
export const CURRENT_SESSION_VERSION = 3;
/** Generate a unique short ID (8 hex chars, collision-checked) */
function generateId(byId) {
    for (let i = 0; i < 100; i++) {
        const id = randomUUID().slice(0, 8);
        if (!byId.has(id))
            return id;
    }
    // Fallback to full UUID if somehow we have collisions
    return randomUUID();
}
/** Migrate v1 → v2: add id/parentId tree structure. Mutates in place. */
function migrateV1ToV2(entries) {
    const ids = new Set();
    let prevId = null;
    for (const entry of entries) {
        if (entry.type === "session") {
            entry.version = 2;
            continue;
        }
        entry.id = generateId(ids);
        entry.parentId = prevId;
        prevId = entry.id;
        // Convert firstKeptEntryIndex to firstKeptEntryId for compaction
        if (entry.type === "compaction") {
            const comp = entry;
            if (typeof comp.firstKeptEntryIndex === "number") {
                const targetEntry = entries[comp.firstKeptEntryIndex];
                if (targetEntry && targetEntry.type !== "session") {
                    comp.firstKeptEntryId = targetEntry.id;
                }
                delete comp.firstKeptEntryIndex;
            }
        }
    }
}
/** Migrate v2 → v3: rename hookMessage role to custom. Mutates in place. */
function migrateV2ToV3(entries) {
    for (const entry of entries) {
        if (entry.type === "session") {
            entry.version = 3;
            continue;
        }
        // Update message entries with hookMessage role
        if (entry.type === "message") {
            const msgEntry = entry;
            if (msgEntry.message && msgEntry.message.role === "hookMessage") {
                msgEntry.message.role = "custom";
            }
        }
    }
}
/**
 * Run all necessary migrations to bring entries to current version.
 * Mutates entries in place. Returns true if any migration was applied.
 */
function migrateToCurrentVersion(entries) {
    const header = entries.find((e) => e.type === "session");
    const version = header?.version ?? 1;
    if (version >= CURRENT_SESSION_VERSION)
        return false;
    if (version < 2)
        migrateV1ToV2(entries);
    if (version < 3)
        migrateV2ToV3(entries);
    return true;
}
/** Exported for testing */
export function migrateSessionEntries(entries) {
    migrateToCurrentVersion(entries);
}
/** Exported for compaction.test.ts */
export function parseSessionEntries(content) {
    const entries = [];
    const lines = content.trim().split("\n");
    for (const line of lines) {
        if (!line.trim())
            continue;
        try {
            const entry = JSON.parse(line);
            entries.push(entry);
        }
        catch {
            // Skip malformed lines
        }
    }
    return entries;
}
export function getLatestCompactionEntry(entries) {
    for (let i = entries.length - 1; i >= 0; i--) {
        if (entries[i].type === "compaction") {
            return entries[i];
        }
    }
    return null;
}
/**
 * Build the session context from entries using tree traversal.
 * If leafId is provided, walks from that entry to root.
 * Handles compaction and branch summaries along the path.
 */
export function buildSessionContext(entries, leafId, byId) {
    // Build uuid index if not available
    if (!byId) {
        byId = new Map();
        for (const entry of entries) {
            byId.set(entry.id, entry);
        }
    }
    // Find leaf
    let leaf;
    if (leafId === null) {
        // Explicitly null - return no messages (navigated to before first entry)
        return { messages: [], thinkingLevel: "off", model: null };
    }
    if (leafId) {
        leaf = byId.get(leafId);
    }
    if (!leaf) {
        // Fallback to last entry (when leafId is undefined)
        leaf = entries[entries.length - 1];
    }
    if (!leaf) {
        return { messages: [], thinkingLevel: "off", model: null };
    }
    // Walk from leaf to root, collecting path
    const path = [];
    let current = leaf;
    while (current) {
        path.unshift(current);
        current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    // Extract settings and find compaction
    let thinkingLevel = "off";
    let model = null;
    let compaction = null;
    for (const entry of path) {
        if (entry.type === "thinking_level_change") {
            thinkingLevel = entry.thinkingLevel;
        }
        else if (entry.type === "model_change") {
            model = { provider: entry.provider, modelId: entry.modelId };
        }
        else if (entry.type === "message" && entry.message.role === "assistant") {
            model = { provider: entry.message.provider, modelId: entry.message.model };
        }
        else if (entry.type === "compaction") {
            compaction = entry;
        }
    }
    // Build messages and collect corresponding entries
    // When there's a compaction, we need to:
    // 1. Emit summary first (entry = compaction)
    // 2. Emit kept messages (from firstKeptEntryId up to compaction)
    // 3. Emit messages after compaction
    const messages = [];
    const appendMessage = (entry) => {
        if (entry.type === "message") {
            messages.push(entry.message);
        }
        else if (entry.type === "custom_message") {
            messages.push(createCustomMessage(entry.customType, entry.content, entry.display, entry.details, entry.timestamp));
        }
        else if (entry.type === "branch_summary" && entry.summary) {
            messages.push(createBranchSummaryMessage(entry.summary, entry.fromId, entry.timestamp));
        }
    };
    if (compaction) {
        // Emit summary first
        messages.push(createCompactionSummaryMessage(compaction.summary, compaction.tokensBefore, compaction.timestamp));
        // Find compaction index in path
        const compactionIdx = path.findIndex((e) => e.type === "compaction" && e.id === compaction.id);
        // Emit kept messages (before compaction, starting from firstKeptEntryId)
        let foundFirstKept = false;
        for (let i = 0; i < compactionIdx; i++) {
            const entry = path[i];
            if (entry.id === compaction.firstKeptEntryId) {
                foundFirstKept = true;
            }
            if (foundFirstKept) {
                appendMessage(entry);
            }
        }
        // Emit messages after compaction
        for (let i = compactionIdx + 1; i < path.length; i++) {
            const entry = path[i];
            appendMessage(entry);
        }
    }
    else {
        // No compaction - emit all messages, handle branch summaries and custom messages
        for (const entry of path) {
            appendMessage(entry);
        }
    }
    return { messages, thinkingLevel, model };
}
/**
 * Compute the default session directory for a cwd.
 * Encodes cwd into a safe directory name under ~/.pi/agent/sessions/.
 */
function getDefaultSessionDir(cwd) {
    const safePath = `--${cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
    const sessionDir = join(getDefaultAgentDir(), "sessions", safePath);
    if (!existsSync(sessionDir)) {
        mkdirSync(sessionDir, { recursive: true });
    }
    return sessionDir;
}
/** Exported for testing */
export function loadEntriesFromFile(filePath) {
    if (!existsSync(filePath))
        return [];
    const content = readFileSync(filePath, "utf8");
    const entries = [];
    const lines = content.trim().split("\n");
    for (const line of lines) {
        if (!line.trim())
            continue;
        try {
            const entry = JSON.parse(line);
            entries.push(entry);
        }
        catch {
            // Skip malformed lines
        }
    }
    // Validate session header
    if (entries.length === 0)
        return entries;
    const header = entries[0];
    if (header.type !== "session" || typeof header.id !== "string") {
        return [];
    }
    return entries;
}
function isValidSessionFile(filePath) {
    try {
        const fd = openSync(filePath, "r");
        const buffer = Buffer.alloc(512);
        const bytesRead = readSync(fd, buffer, 0, 512, 0);
        closeSync(fd);
        const firstLine = buffer.toString("utf8", 0, bytesRead).split("\n")[0];
        if (!firstLine)
            return false;
        const header = JSON.parse(firstLine);
        return header.type === "session" && typeof header.id === "string";
    }
    catch {
        return false;
    }
}
/** Exported for testing */
export function findMostRecentSession(sessionDir) {
    try {
        const files = readdirSync(sessionDir)
            .filter((f) => f.endsWith(".jsonl"))
            .map((f) => join(sessionDir, f))
            .filter(isValidSessionFile)
            .map((path) => ({ path, mtime: statSync(path).mtime }))
            .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
        return files[0]?.path || null;
    }
    catch {
        return null;
    }
}
function isMessageWithContent(message) {
    return typeof message.role === "string" && "content" in message;
}
function extractTextContent(message) {
    const content = message.content;
    if (typeof content === "string") {
        return content;
    }
    return content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join(" ");
}
function getLastActivityTime(entries) {
    let lastActivityTime;
    for (const entry of entries) {
        if (entry.type !== "message")
            continue;
        const message = entry.message;
        if (!isMessageWithContent(message))
            continue;
        if (message.role !== "user" && message.role !== "assistant")
            continue;
        const msgTimestamp = message.timestamp;
        if (typeof msgTimestamp === "number") {
            lastActivityTime = Math.max(lastActivityTime ?? 0, msgTimestamp);
            continue;
        }
        const entryTimestamp = entry.timestamp;
        if (typeof entryTimestamp === "string") {
            const t = new Date(entryTimestamp).getTime();
            if (!Number.isNaN(t)) {
                lastActivityTime = Math.max(lastActivityTime ?? 0, t);
            }
        }
    }
    return lastActivityTime;
}
function getSessionModifiedDate(entries, header, statsMtime) {
    const lastActivityTime = getLastActivityTime(entries);
    if (typeof lastActivityTime === "number" && lastActivityTime > 0) {
        return new Date(lastActivityTime);
    }
    const headerTime = typeof header.timestamp === "string" ? new Date(header.timestamp).getTime() : NaN;
    return !Number.isNaN(headerTime) ? new Date(headerTime) : statsMtime;
}
async function buildSessionInfo(filePath) {
    try {
        const content = await readFile(filePath, "utf8");
        const entries = [];
        const lines = content.trim().split("\n");
        for (const line of lines) {
            if (!line.trim())
                continue;
            try {
                entries.push(JSON.parse(line));
            }
            catch {
                // Skip malformed lines
            }
        }
        if (entries.length === 0)
            return null;
        const header = entries[0];
        if (header.type !== "session")
            return null;
        const stats = await stat(filePath);
        let messageCount = 0;
        let firstMessage = "";
        const allMessages = [];
        let name;
        for (const entry of entries) {
            // Extract session name (use latest)
            if (entry.type === "session_info") {
                const infoEntry = entry;
                if (infoEntry.name) {
                    name = infoEntry.name.trim();
                }
            }
            if (entry.type !== "message")
                continue;
            messageCount++;
            const message = entry.message;
            if (!isMessageWithContent(message))
                continue;
            if (message.role !== "user" && message.role !== "assistant")
                continue;
            const textContent = extractTextContent(message);
            if (!textContent)
                continue;
            allMessages.push(textContent);
            if (!firstMessage && message.role === "user") {
                firstMessage = textContent;
            }
        }
        const cwd = typeof header.cwd === "string" ? header.cwd : "";
        const parentSessionPath = header.parentSession;
        const modified = getSessionModifiedDate(entries, header, stats.mtime);
        return {
            path: filePath,
            id: header.id,
            cwd,
            name,
            parentSessionPath,
            created: new Date(header.timestamp),
            modified,
            messageCount,
            firstMessage: firstMessage || "(no messages)",
            allMessagesText: allMessages.join(" "),
        };
    }
    catch {
        return null;
    }
}
async function listSessionsFromDir(dir, onProgress, progressOffset = 0, progressTotal) {
    const sessions = [];
    if (!existsSync(dir)) {
        return sessions;
    }
    try {
        const dirEntries = await readdir(dir);
        const files = dirEntries.filter((f) => f.endsWith(".jsonl")).map((f) => join(dir, f));
        const total = progressTotal ?? files.length;
        let loaded = 0;
        const results = await Promise.all(files.map(async (file) => {
            const info = await buildSessionInfo(file);
            loaded++;
            onProgress?.(progressOffset + loaded, total);
            return info;
        }));
        for (const info of results) {
            if (info) {
                sessions.push(info);
            }
        }
    }
    catch {
        // Return empty list on error
    }
    return sessions;
}
/**
 * Manages conversation sessions as append-only trees stored in JSONL files.
 *
 * Each session entry has an id and parentId forming a tree structure. The "leaf"
 * pointer tracks the current position. Appending creates a child of the current leaf.
 * Branching moves the leaf to an earlier entry, allowing new branches without
 * modifying history.
 *
 * Use buildSessionContext() to get the resolved message list for the LLM, which
 * handles compaction summaries and follows the path from root to current leaf.
 */
export class SessionManager {
    sessionId = "";
    sessionFile;
    sessionDir;
    cwd;
    persist;
    flushed = false;
    fileEntries = [];
    byId = new Map();
    labelsById = new Map();
    leafId = null;
    constructor(cwd, sessionDir, sessionFile, persist) {
        this.cwd = cwd;
        this.sessionDir = sessionDir;
        this.persist = persist;
        if (persist && sessionDir && !existsSync(sessionDir)) {
            mkdirSync(sessionDir, { recursive: true });
        }
        if (sessionFile) {
            this.setSessionFile(sessionFile);
        }
        else {
            this.newSession();
        }
    }
    /** Switch to a different session file (used for resume and branching) */
    setSessionFile(sessionFile) {
        this.sessionFile = resolve(sessionFile);
        if (existsSync(this.sessionFile)) {
            this.fileEntries = loadEntriesFromFile(this.sessionFile);
            // If file was empty or corrupted (no valid header), truncate and start fresh
            // to avoid appending messages without a session header (which breaks the session)
            if (this.fileEntries.length === 0) {
                const explicitPath = this.sessionFile;
                this.newSession();
                this.sessionFile = explicitPath;
                this._rewriteFile();
                this.flushed = true;
                return;
            }
            const header = this.fileEntries.find((e) => e.type === "session");
            this.sessionId = header?.id ?? randomUUID();
            if (migrateToCurrentVersion(this.fileEntries)) {
                this._rewriteFile();
            }
            this._buildIndex();
            this.flushed = true;
        }
        else {
            const explicitPath = this.sessionFile;
            this.newSession();
            this.sessionFile = explicitPath; // preserve explicit path from --session flag
        }
    }
    newSession(options) {
        this.sessionId = randomUUID();
        const timestamp = new Date().toISOString();
        const header = {
            type: "session",
            version: CURRENT_SESSION_VERSION,
            id: this.sessionId,
            timestamp,
            cwd: this.cwd,
            parentSession: options?.parentSession,
        };
        this.fileEntries = [header];
        this.byId.clear();
        this.labelsById.clear();
        this.leafId = null;
        this.flushed = false;
        if (this.persist) {
            const fileTimestamp = timestamp.replace(/[:.]/g, "-");
            this.sessionFile = join(this.getSessionDir(), `${fileTimestamp}_${this.sessionId}.jsonl`);
        }
        return this.sessionFile;
    }
    _buildIndex() {
        this.byId.clear();
        this.labelsById.clear();
        this.leafId = null;
        for (const entry of this.fileEntries) {
            if (entry.type === "session")
                continue;
            this.byId.set(entry.id, entry);
            this.leafId = entry.id;
            if (entry.type === "label") {
                if (entry.label) {
                    this.labelsById.set(entry.targetId, entry.label);
                }
                else {
                    this.labelsById.delete(entry.targetId);
                }
            }
        }
    }
    _rewriteFile() {
        if (!this.persist || !this.sessionFile)
            return;
        const content = `${this.fileEntries.map((e) => JSON.stringify(e)).join("\n")}\n`;
        writeFileSync(this.sessionFile, content);
    }
    isPersisted() {
        return this.persist;
    }
    getCwd() {
        return this.cwd;
    }
    getSessionDir() {
        return this.sessionDir;
    }
    getSessionId() {
        return this.sessionId;
    }
    getSessionFile() {
        return this.sessionFile;
    }
    _persist(entry) {
        if (!this.persist || !this.sessionFile)
            return;
        const hasAssistant = this.fileEntries.some((e) => e.type === "message" && e.message.role === "assistant");
        if (!hasAssistant) {
            // Mark as not flushed so when assistant arrives, all entries get written
            this.flushed = false;
            return;
        }
        if (!this.flushed) {
            for (const e of this.fileEntries) {
                appendFileSync(this.sessionFile, `${JSON.stringify(e)}\n`);
            }
            this.flushed = true;
        }
        else {
            appendFileSync(this.sessionFile, `${JSON.stringify(entry)}\n`);
        }
    }
    _appendEntry(entry) {
        this.fileEntries.push(entry);
        this.byId.set(entry.id, entry);
        this.leafId = entry.id;
        this._persist(entry);
    }
    /** Append a message as child of current leaf, then advance leaf. Returns entry id.
     * Does not allow writing CompactionSummaryMessage and BranchSummaryMessage directly.
     * Reason: we want these to be top-level entries in the session, not message session entries,
     * so it is easier to find them.
     * These need to be appended via appendCompaction() and appendBranchSummary() methods.
     */
    appendMessage(message) {
        const entry = {
            type: "message",
            id: generateId(this.byId),
            parentId: this.leafId,
            timestamp: new Date().toISOString(),
            message,
        };
        this._appendEntry(entry);
        return entry.id;
    }
    /** Append a thinking level change as child of current leaf, then advance leaf. Returns entry id. */
    appendThinkingLevelChange(thinkingLevel) {
        const entry = {
            type: "thinking_level_change",
            id: generateId(this.byId),
            parentId: this.leafId,
            timestamp: new Date().toISOString(),
            thinkingLevel,
        };
        this._appendEntry(entry);
        return entry.id;
    }
    /** Append a model change as child of current leaf, then advance leaf. Returns entry id. */
    appendModelChange(provider, modelId) {
        const entry = {
            type: "model_change",
            id: generateId(this.byId),
            parentId: this.leafId,
            timestamp: new Date().toISOString(),
            provider,
            modelId,
        };
        this._appendEntry(entry);
        return entry.id;
    }
    /** Append a compaction summary as child of current leaf, then advance leaf. Returns entry id. */
    appendCompaction(summary, firstKeptEntryId, tokensBefore, details, fromHook) {
        const entry = {
            type: "compaction",
            id: generateId(this.byId),
            parentId: this.leafId,
            timestamp: new Date().toISOString(),
            summary,
            firstKeptEntryId,
            tokensBefore,
            details,
            fromHook,
        };
        this._appendEntry(entry);
        return entry.id;
    }
    /** Append a custom entry (for extensions) as child of current leaf, then advance leaf. Returns entry id. */
    appendCustomEntry(customType, data) {
        const entry = {
            type: "custom",
            customType,
            data,
            id: generateId(this.byId),
            parentId: this.leafId,
            timestamp: new Date().toISOString(),
        };
        this._appendEntry(entry);
        return entry.id;
    }
    /** Append a session info entry (e.g., display name). Returns entry id. */
    appendSessionInfo(name) {
        const entry = {
            type: "session_info",
            id: generateId(this.byId),
            parentId: this.leafId,
            timestamp: new Date().toISOString(),
            name: name.trim(),
        };
        this._appendEntry(entry);
        return entry.id;
    }
    /** Get the current session name from the latest session_info entry, if any. */
    getSessionName() {
        // Walk entries in reverse to find the latest session_info with a name
        const entries = this.getEntries();
        for (let i = entries.length - 1; i >= 0; i--) {
            const entry = entries[i];
            if (entry.type === "session_info" && entry.name) {
                return entry.name;
            }
        }
        return undefined;
    }
    /**
     * Append a custom message entry (for extensions) that participates in LLM context.
     * @param customType Extension identifier for filtering on reload
     * @param content Message content (string or TextContent/ImageContent array)
     * @param display Whether to show in TUI (true = styled display, false = hidden)
     * @param details Optional extension-specific metadata (not sent to LLM)
     * @returns Entry id
     */
    appendCustomMessageEntry(customType, content, display, details) {
        const entry = {
            type: "custom_message",
            customType,
            content,
            display,
            details,
            id: generateId(this.byId),
            parentId: this.leafId,
            timestamp: new Date().toISOString(),
        };
        this._appendEntry(entry);
        return entry.id;
    }
    // =========================================================================
    // Tree Traversal
    // =========================================================================
    getLeafId() {
        return this.leafId;
    }
    getLeafEntry() {
        return this.leafId ? this.byId.get(this.leafId) : undefined;
    }
    getEntry(id) {
        return this.byId.get(id);
    }
    /**
     * Get all direct children of an entry.
     */
    getChildren(parentId) {
        const children = [];
        for (const entry of this.byId.values()) {
            if (entry.parentId === parentId) {
                children.push(entry);
            }
        }
        return children;
    }
    /**
     * Get the label for an entry, if any.
     */
    getLabel(id) {
        return this.labelsById.get(id);
    }
    /**
     * Set or clear a label on an entry.
     * Labels are user-defined markers for bookmarking/navigation.
     * Pass undefined or empty string to clear the label.
     */
    appendLabelChange(targetId, label) {
        if (!this.byId.has(targetId)) {
            throw new Error(`Entry ${targetId} not found`);
        }
        const entry = {
            type: "label",
            id: generateId(this.byId),
            parentId: this.leafId,
            timestamp: new Date().toISOString(),
            targetId,
            label,
        };
        this._appendEntry(entry);
        if (label) {
            this.labelsById.set(targetId, label);
        }
        else {
            this.labelsById.delete(targetId);
        }
        return entry.id;
    }
    /**
     * Walk from entry to root, returning all entries in path order.
     * Includes all entry types (messages, compaction, model changes, etc.).
     * Use buildSessionContext() to get the resolved messages for the LLM.
     */
    getBranch(fromId) {
        const path = [];
        const startId = fromId ?? this.leafId;
        let current = startId ? this.byId.get(startId) : undefined;
        while (current) {
            path.unshift(current);
            current = current.parentId ? this.byId.get(current.parentId) : undefined;
        }
        return path;
    }
    /**
     * Build the session context (what gets sent to the LLM).
     * Uses tree traversal from current leaf.
     */
    buildSessionContext() {
        return buildSessionContext(this.getEntries(), this.leafId, this.byId);
    }
    /**
     * Get session header.
     */
    getHeader() {
        const h = this.fileEntries.find((e) => e.type === "session");
        return h ? h : null;
    }
    /**
     * Get all session entries (excludes header). Returns a shallow copy.
     * The session is append-only: use appendXXX() to add entries, branch() to
     * change the leaf pointer. Entries cannot be modified or deleted.
     */
    getEntries() {
        return this.fileEntries.filter((e) => e.type !== "session");
    }
    /**
     * Get the session as a tree structure. Returns a shallow defensive copy of all entries.
     * A well-formed session has exactly one root (first entry with parentId === null).
     * Orphaned entries (broken parent chain) are also returned as roots.
     */
    getTree() {
        const entries = this.getEntries();
        const nodeMap = new Map();
        const roots = [];
        // Create nodes with resolved labels
        for (const entry of entries) {
            const label = this.labelsById.get(entry.id);
            nodeMap.set(entry.id, { entry, children: [], label });
        }
        // Build tree
        for (const entry of entries) {
            const node = nodeMap.get(entry.id);
            if (entry.parentId === null || entry.parentId === entry.id) {
                roots.push(node);
            }
            else {
                const parent = nodeMap.get(entry.parentId);
                if (parent) {
                    parent.children.push(node);
                }
                else {
                    // Orphan - treat as root
                    roots.push(node);
                }
            }
        }
        // Sort children by timestamp (oldest first, newest at bottom)
        // Use iterative approach to avoid stack overflow on deep trees
        const stack = [...roots];
        while (stack.length > 0) {
            const node = stack.pop();
            node.children.sort((a, b) => new Date(a.entry.timestamp).getTime() - new Date(b.entry.timestamp).getTime());
            stack.push(...node.children);
        }
        return roots;
    }
    // =========================================================================
    // Branching
    // =========================================================================
    /**
     * Start a new branch from an earlier entry.
     * Moves the leaf pointer to the specified entry. The next appendXXX() call
     * will create a child of that entry, forming a new branch. Existing entries
     * are not modified or deleted.
     */
    branch(branchFromId) {
        if (!this.byId.has(branchFromId)) {
            throw new Error(`Entry ${branchFromId} not found`);
        }
        this.leafId = branchFromId;
    }
    /**
     * Reset the leaf pointer to null (before any entries).
     * The next appendXXX() call will create a new root entry (parentId = null).
     * Use this when navigating to re-edit the first user message.
     */
    resetLeaf() {
        this.leafId = null;
    }
    /**
     * Start a new branch with a summary of the abandoned path.
     * Same as branch(), but also appends a branch_summary entry that captures
     * context from the abandoned conversation path.
     */
    branchWithSummary(branchFromId, summary, details, fromHook) {
        if (branchFromId !== null && !this.byId.has(branchFromId)) {
            throw new Error(`Entry ${branchFromId} not found`);
        }
        this.leafId = branchFromId;
        const entry = {
            type: "branch_summary",
            id: generateId(this.byId),
            parentId: branchFromId,
            timestamp: new Date().toISOString(),
            fromId: branchFromId ?? "root",
            summary,
            details,
            fromHook,
        };
        this._appendEntry(entry);
        return entry.id;
    }
    /**
     * Create a new session file containing only the path from root to the specified leaf.
     * Useful for extracting a single conversation path from a branched session.
     * Returns the new session file path, or undefined if not persisting.
     */
    createBranchedSession(leafId) {
        const previousSessionFile = this.sessionFile;
        const path = this.getBranch(leafId);
        if (path.length === 0) {
            throw new Error(`Entry ${leafId} not found`);
        }
        // Filter out LabelEntry from path - we'll recreate them from the resolved map
        const pathWithoutLabels = path.filter((e) => e.type !== "label");
        const newSessionId = randomUUID();
        const timestamp = new Date().toISOString();
        const fileTimestamp = timestamp.replace(/[:.]/g, "-");
        const newSessionFile = join(this.getSessionDir(), `${fileTimestamp}_${newSessionId}.jsonl`);
        const header = {
            type: "session",
            version: CURRENT_SESSION_VERSION,
            id: newSessionId,
            timestamp,
            cwd: this.cwd,
            parentSession: this.persist ? previousSessionFile : undefined,
        };
        // Collect labels for entries in the path
        const pathEntryIds = new Set(pathWithoutLabels.map((e) => e.id));
        const labelsToWrite = [];
        for (const [targetId, label] of this.labelsById) {
            if (pathEntryIds.has(targetId)) {
                labelsToWrite.push({ targetId, label });
            }
        }
        if (this.persist) {
            appendFileSync(newSessionFile, `${JSON.stringify(header)}\n`);
            for (const entry of pathWithoutLabels) {
                appendFileSync(newSessionFile, `${JSON.stringify(entry)}\n`);
            }
            // Write fresh label entries at the end
            const lastEntryId = pathWithoutLabels[pathWithoutLabels.length - 1]?.id || null;
            let parentId = lastEntryId;
            const labelEntries = [];
            for (const { targetId, label } of labelsToWrite) {
                const labelEntry = {
                    type: "label",
                    id: generateId(new Set(pathEntryIds)),
                    parentId,
                    timestamp: new Date().toISOString(),
                    targetId,
                    label,
                };
                appendFileSync(newSessionFile, `${JSON.stringify(labelEntry)}\n`);
                pathEntryIds.add(labelEntry.id);
                labelEntries.push(labelEntry);
                parentId = labelEntry.id;
            }
            this.fileEntries = [header, ...pathWithoutLabels, ...labelEntries];
            this.sessionId = newSessionId;
            this.sessionFile = newSessionFile;
            this.flushed = true;
            this._buildIndex();
            return newSessionFile;
        }
        // In-memory mode: replace current session with the path + labels
        const labelEntries = [];
        let parentId = pathWithoutLabels[pathWithoutLabels.length - 1]?.id || null;
        for (const { targetId, label } of labelsToWrite) {
            const labelEntry = {
                type: "label",
                id: generateId(new Set([...pathEntryIds, ...labelEntries.map((e) => e.id)])),
                parentId,
                timestamp: new Date().toISOString(),
                targetId,
                label,
            };
            labelEntries.push(labelEntry);
            parentId = labelEntry.id;
        }
        this.fileEntries = [header, ...pathWithoutLabels, ...labelEntries];
        this.sessionId = newSessionId;
        this._buildIndex();
        return undefined;
    }
    /**
     * Create a new session.
     * @param cwd Working directory (stored in session header)
     * @param sessionDir Optional session directory. If omitted, uses default (~/.pi/agent/sessions/<encoded-cwd>/).
     */
    static create(cwd, sessionDir) {
        const dir = sessionDir ?? getDefaultSessionDir(cwd);
        return new SessionManager(cwd, dir, undefined, true);
    }
    /**
     * Open a specific session file.
     * @param path Path to session file
     * @param sessionDir Optional session directory for /new or /branch. If omitted, derives from file's parent.
     */
    static open(path, sessionDir) {
        // Extract cwd from session header if possible, otherwise use process.cwd()
        const entries = loadEntriesFromFile(path);
        const header = entries.find((e) => e.type === "session");
        const cwd = header?.cwd ?? process.cwd();
        // If no sessionDir provided, derive from file's parent directory
        const dir = sessionDir ?? resolve(path, "..");
        return new SessionManager(cwd, dir, path, true);
    }
    /**
     * Continue the most recent session, or create new if none.
     * @param cwd Working directory
     * @param sessionDir Optional session directory. If omitted, uses default (~/.pi/agent/sessions/<encoded-cwd>/).
     */
    static continueRecent(cwd, sessionDir) {
        const dir = sessionDir ?? getDefaultSessionDir(cwd);
        const mostRecent = findMostRecentSession(dir);
        if (mostRecent) {
            return new SessionManager(cwd, dir, mostRecent, true);
        }
        return new SessionManager(cwd, dir, undefined, true);
    }
    /** Create an in-memory session (no file persistence) */
    static inMemory(cwd = process.cwd()) {
        return new SessionManager(cwd, "", undefined, false);
    }
    /**
     * Fork a session from another project directory into the current project.
     * Creates a new session in the target cwd with the full history from the source session.
     * @param sourcePath Path to the source session file
     * @param targetCwd Target working directory (where the new session will be stored)
     * @param sessionDir Optional session directory. If omitted, uses default for targetCwd.
     */
    static forkFrom(sourcePath, targetCwd, sessionDir) {
        const sourceEntries = loadEntriesFromFile(sourcePath);
        if (sourceEntries.length === 0) {
            throw new Error(`Cannot fork: source session file is empty or invalid: ${sourcePath}`);
        }
        const sourceHeader = sourceEntries.find((e) => e.type === "session");
        if (!sourceHeader) {
            throw new Error(`Cannot fork: source session has no header: ${sourcePath}`);
        }
        const dir = sessionDir ?? getDefaultSessionDir(targetCwd);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
        // Create new session file with new ID but forked content
        const newSessionId = randomUUID();
        const timestamp = new Date().toISOString();
        const fileTimestamp = timestamp.replace(/[:.]/g, "-");
        const newSessionFile = join(dir, `${fileTimestamp}_${newSessionId}.jsonl`);
        // Write new header pointing to source as parent, with updated cwd
        const newHeader = {
            type: "session",
            version: CURRENT_SESSION_VERSION,
            id: newSessionId,
            timestamp,
            cwd: targetCwd,
            parentSession: sourcePath,
        };
        appendFileSync(newSessionFile, `${JSON.stringify(newHeader)}\n`);
        // Copy all non-header entries from source
        for (const entry of sourceEntries) {
            if (entry.type !== "session") {
                appendFileSync(newSessionFile, `${JSON.stringify(entry)}\n`);
            }
        }
        return new SessionManager(targetCwd, dir, newSessionFile, true);
    }
    /**
     * List all sessions for a directory.
     * @param cwd Working directory (used to compute default session directory)
     * @param sessionDir Optional session directory. If omitted, uses default (~/.pi/agent/sessions/<encoded-cwd>/).
     * @param onProgress Optional callback for progress updates (loaded, total)
     */
    static async list(cwd, sessionDir, onProgress) {
        const dir = sessionDir ?? getDefaultSessionDir(cwd);
        const sessions = await listSessionsFromDir(dir, onProgress);
        sessions.sort((a, b) => b.modified.getTime() - a.modified.getTime());
        return sessions;
    }
    /**
     * List all sessions across all project directories.
     * @param onProgress Optional callback for progress updates (loaded, total)
     */
    static async listAll(onProgress) {
        const sessionsDir = getSessionsDir();
        try {
            if (!existsSync(sessionsDir)) {
                return [];
            }
            const entries = await readdir(sessionsDir, { withFileTypes: true });
            const dirs = entries.filter((e) => e.isDirectory()).map((e) => join(sessionsDir, e.name));
            // Count total files first for accurate progress
            let totalFiles = 0;
            const dirFiles = [];
            for (const dir of dirs) {
                try {
                    const files = (await readdir(dir)).filter((f) => f.endsWith(".jsonl"));
                    dirFiles.push(files.map((f) => join(dir, f)));
                    totalFiles += files.length;
                }
                catch {
                    dirFiles.push([]);
                }
            }
            // Process all files with progress tracking
            let loaded = 0;
            const sessions = [];
            const allFiles = dirFiles.flat();
            const results = await Promise.all(allFiles.map(async (file) => {
                const info = await buildSessionInfo(file);
                loaded++;
                onProgress?.(loaded, totalFiles);
                return info;
            }));
            for (const info of results) {
                if (info) {
                    sessions.push(info);
                }
            }
            sessions.sort((a, b) => b.modified.getTime() - a.modified.getTime());
            return sessions;
        }
        catch {
            return [];
        }
    }
}
//# sourceMappingURL=session-manager.js.map