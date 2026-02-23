/**
 * RPC Client for programmatic access to the coding agent.
 *
 * Spawns the agent in RPC mode and provides a typed API for all operations.
 */
import { spawn } from "node:child_process";
import * as readline from "node:readline";
// ============================================================================
// RPC Client
// ============================================================================
export class RpcClient {
    options;
    process = null;
    rl = null;
    eventListeners = [];
    pendingRequests = new Map();
    requestId = 0;
    stderr = "";
    constructor(options = {}) {
        this.options = options;
    }
    /**
     * Start the RPC agent process.
     */
    async start() {
        if (this.process) {
            throw new Error("Client already started");
        }
        const cliPath = this.options.cliPath ?? "dist/cli.js";
        const args = ["--mode", "rpc"];
        if (this.options.provider) {
            args.push("--provider", this.options.provider);
        }
        if (this.options.model) {
            args.push("--model", this.options.model);
        }
        if (this.options.args) {
            args.push(...this.options.args);
        }
        this.process = spawn("node", [cliPath, ...args], {
            cwd: this.options.cwd,
            env: { ...process.env, ...this.options.env },
            stdio: ["pipe", "pipe", "pipe"],
        });
        // Collect stderr for debugging
        this.process.stderr?.on("data", (data) => {
            this.stderr += data.toString();
        });
        // Set up line reader for stdout
        this.rl = readline.createInterface({
            input: this.process.stdout,
            terminal: false,
        });
        this.rl.on("line", (line) => {
            this.handleLine(line);
        });
        // Wait a moment for process to initialize
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (this.process.exitCode !== null) {
            throw new Error(`Agent process exited immediately with code ${this.process.exitCode}. Stderr: ${this.stderr}`);
        }
    }
    /**
     * Stop the RPC agent process.
     */
    async stop() {
        if (!this.process)
            return;
        this.rl?.close();
        this.process.kill("SIGTERM");
        // Wait for process to exit
        await new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this.process?.kill("SIGKILL");
                resolve();
            }, 1000);
            this.process?.on("exit", () => {
                clearTimeout(timeout);
                resolve();
            });
        });
        this.process = null;
        this.rl = null;
        this.pendingRequests.clear();
    }
    /**
     * Subscribe to agent events.
     */
    onEvent(listener) {
        this.eventListeners.push(listener);
        return () => {
            const index = this.eventListeners.indexOf(listener);
            if (index !== -1) {
                this.eventListeners.splice(index, 1);
            }
        };
    }
    /**
     * Get collected stderr output (useful for debugging).
     */
    getStderr() {
        return this.stderr;
    }
    // =========================================================================
    // Command Methods
    // =========================================================================
    /**
     * Send a prompt to the agent.
     * Returns immediately after sending; use onEvent() to receive streaming events.
     * Use waitForIdle() to wait for completion.
     */
    async prompt(message, images) {
        await this.send({ type: "prompt", message, images });
    }
    /**
     * Queue a steering message to interrupt the agent mid-run.
     */
    async steer(message, images) {
        await this.send({ type: "steer", message, images });
    }
    /**
     * Queue a follow-up message to be processed after the agent finishes.
     */
    async followUp(message, images) {
        await this.send({ type: "follow_up", message, images });
    }
    /**
     * Abort current operation.
     */
    async abort() {
        await this.send({ type: "abort" });
    }
    /**
     * Start a new session, optionally with parent tracking.
     * @param parentSession - Optional parent session path for lineage tracking
     * @returns Object with `cancelled: true` if an extension cancelled the new session
     */
    async newSession(parentSession) {
        const response = await this.send({ type: "new_session", parentSession });
        return this.getData(response);
    }
    /**
     * Get current session state.
     */
    async getState() {
        const response = await this.send({ type: "get_state" });
        return this.getData(response);
    }
    /**
     * Set model by provider and ID.
     */
    async setModel(provider, modelId) {
        const response = await this.send({ type: "set_model", provider, modelId });
        return this.getData(response);
    }
    /**
     * Cycle to next model.
     */
    async cycleModel() {
        const response = await this.send({ type: "cycle_model" });
        return this.getData(response);
    }
    /**
     * Get list of available models.
     */
    async getAvailableModels() {
        const response = await this.send({ type: "get_available_models" });
        return this.getData(response).models;
    }
    /**
     * Set thinking level.
     */
    async setThinkingLevel(level) {
        await this.send({ type: "set_thinking_level", level });
    }
    /**
     * Cycle thinking level.
     */
    async cycleThinkingLevel() {
        const response = await this.send({ type: "cycle_thinking_level" });
        return this.getData(response);
    }
    /**
     * Set steering mode.
     */
    async setSteeringMode(mode) {
        await this.send({ type: "set_steering_mode", mode });
    }
    /**
     * Set follow-up mode.
     */
    async setFollowUpMode(mode) {
        await this.send({ type: "set_follow_up_mode", mode });
    }
    /**
     * Compact session context.
     */
    async compact(customInstructions) {
        const response = await this.send({ type: "compact", customInstructions });
        return this.getData(response);
    }
    /**
     * Set auto-compaction enabled/disabled.
     */
    async setAutoCompaction(enabled) {
        await this.send({ type: "set_auto_compaction", enabled });
    }
    /**
     * Set auto-retry enabled/disabled.
     */
    async setAutoRetry(enabled) {
        await this.send({ type: "set_auto_retry", enabled });
    }
    /**
     * Abort in-progress retry.
     */
    async abortRetry() {
        await this.send({ type: "abort_retry" });
    }
    /**
     * Execute a bash command.
     */
    async bash(command) {
        const response = await this.send({ type: "bash", command });
        return this.getData(response);
    }
    /**
     * Abort running bash command.
     */
    async abortBash() {
        await this.send({ type: "abort_bash" });
    }
    /**
     * Get session statistics.
     */
    async getSessionStats() {
        const response = await this.send({ type: "get_session_stats" });
        return this.getData(response);
    }
    /**
     * Export session to HTML.
     */
    async exportHtml(outputPath) {
        const response = await this.send({ type: "export_html", outputPath });
        return this.getData(response);
    }
    /**
     * Switch to a different session file.
     * @returns Object with `cancelled: true` if an extension cancelled the switch
     */
    async switchSession(sessionPath) {
        const response = await this.send({ type: "switch_session", sessionPath });
        return this.getData(response);
    }
    /**
     * Fork from a specific message.
     * @returns Object with `text` (the message text) and `cancelled` (if extension cancelled)
     */
    async fork(entryId) {
        const response = await this.send({ type: "fork", entryId });
        return this.getData(response);
    }
    /**
     * Get messages available for forking.
     */
    async getForkMessages() {
        const response = await this.send({ type: "get_fork_messages" });
        return this.getData(response).messages;
    }
    /**
     * Get text of last assistant message.
     */
    async getLastAssistantText() {
        const response = await this.send({ type: "get_last_assistant_text" });
        return this.getData(response).text;
    }
    /**
     * Set the session display name.
     */
    async setSessionName(name) {
        await this.send({ type: "set_session_name", name });
    }
    /**
     * Get all messages in the session.
     */
    async getMessages() {
        const response = await this.send({ type: "get_messages" });
        return this.getData(response).messages;
    }
    /**
     * Get available commands (extension commands, prompt templates, skills).
     */
    async getCommands() {
        const response = await this.send({ type: "get_commands" });
        return this.getData(response).commands;
    }
    // =========================================================================
    // Helpers
    // =========================================================================
    /**
     * Wait for agent to become idle (no streaming).
     * Resolves when agent_end event is received.
     */
    waitForIdle(timeout = 60000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                unsubscribe();
                reject(new Error(`Timeout waiting for agent to become idle. Stderr: ${this.stderr}`));
            }, timeout);
            const unsubscribe = this.onEvent((event) => {
                if (event.type === "agent_end") {
                    clearTimeout(timer);
                    unsubscribe();
                    resolve();
                }
            });
        });
    }
    /**
     * Collect events until agent becomes idle.
     */
    collectEvents(timeout = 60000) {
        return new Promise((resolve, reject) => {
            const events = [];
            const timer = setTimeout(() => {
                unsubscribe();
                reject(new Error(`Timeout collecting events. Stderr: ${this.stderr}`));
            }, timeout);
            const unsubscribe = this.onEvent((event) => {
                events.push(event);
                if (event.type === "agent_end") {
                    clearTimeout(timer);
                    unsubscribe();
                    resolve(events);
                }
            });
        });
    }
    /**
     * Send prompt and wait for completion, returning all events.
     */
    async promptAndWait(message, images, timeout = 60000) {
        const eventsPromise = this.collectEvents(timeout);
        await this.prompt(message, images);
        return eventsPromise;
    }
    // =========================================================================
    // Internal
    // =========================================================================
    handleLine(line) {
        try {
            const data = JSON.parse(line);
            // Check if it's a response to a pending request
            if (data.type === "response" && data.id && this.pendingRequests.has(data.id)) {
                const pending = this.pendingRequests.get(data.id);
                this.pendingRequests.delete(data.id);
                pending.resolve(data);
                return;
            }
            // Otherwise it's an event
            for (const listener of this.eventListeners) {
                listener(data);
            }
        }
        catch {
            // Ignore non-JSON lines
        }
    }
    async send(command) {
        if (!this.process?.stdin) {
            throw new Error("Client not started");
        }
        const id = `req_${++this.requestId}`;
        const fullCommand = { ...command, id };
        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`Timeout waiting for response to ${command.type}. Stderr: ${this.stderr}`));
            }, 30000);
            this.pendingRequests.set(id, {
                resolve: (response) => {
                    clearTimeout(timeout);
                    resolve(response);
                },
                reject: (error) => {
                    clearTimeout(timeout);
                    reject(error);
                },
            });
            this.process.stdin.write(`${JSON.stringify(fullCommand)}\n`);
        });
    }
    getData(response) {
        if (!response.success) {
            const errorResponse = response;
            throw new Error(errorResponse.error);
        }
        // Type assertion: we trust response.data matches T based on the command sent.
        // This is safe because each public method specifies the correct T for its command.
        const successResponse = response;
        return successResponse.data;
    }
}
//# sourceMappingURL=rpc-client.js.map