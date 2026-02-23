/**
 * Extension runner - executes extensions and manages their lifecycle.
 */
import { theme } from "../../modes/interactive/theme/theme.js";
// Keybindings for these actions cannot be overridden by extensions
const RESERVED_ACTIONS_FOR_EXTENSION_CONFLICTS = [
    "interrupt",
    "clear",
    "exit",
    "suspend",
    "cycleThinkingLevel",
    "cycleModelForward",
    "cycleModelBackward",
    "selectModel",
    "expandTools",
    "toggleThinking",
    "externalEditor",
    "followUp",
    "submit",
    "selectConfirm",
    "selectCancel",
    "copy",
    "deleteToLineEnd",
];
const buildBuiltinKeybindings = (effectiveKeybindings) => {
    const builtinKeybindings = {};
    for (const [action, keys] of Object.entries(effectiveKeybindings)) {
        const keyAction = action;
        const keyList = Array.isArray(keys) ? keys : [keys];
        const restrictOverride = RESERVED_ACTIONS_FOR_EXTENSION_CONFLICTS.includes(keyAction);
        for (const key of keyList) {
            const normalizedKey = key.toLowerCase();
            builtinKeybindings[normalizedKey] = {
                action: keyAction,
                restrictOverride: restrictOverride,
            };
        }
    }
    return builtinKeybindings;
};
/**
 * Helper function to emit session_shutdown event to extensions.
 * Returns true if the event was emitted, false if there were no handlers.
 */
export async function emitSessionShutdownEvent(extensionRunner) {
    if (extensionRunner?.hasHandlers("session_shutdown")) {
        await extensionRunner.emit({
            type: "session_shutdown",
        });
        return true;
    }
    return false;
}
const noOpUIContext = {
    select: async () => undefined,
    confirm: async () => false,
    input: async () => undefined,
    notify: () => { },
    onTerminalInput: () => () => { },
    setStatus: () => { },
    setWorkingMessage: () => { },
    setWidget: () => { },
    setFooter: () => { },
    setHeader: () => { },
    setTitle: () => { },
    custom: async () => undefined,
    pasteToEditor: () => { },
    setEditorText: () => { },
    getEditorText: () => "",
    editor: async () => undefined,
    setEditorComponent: () => { },
    get theme() {
        return theme;
    },
    getAllThemes: () => [],
    getTheme: () => undefined,
    setTheme: (_theme) => ({ success: false, error: "UI not available" }),
    getToolsExpanded: () => false,
    setToolsExpanded: () => { },
};
export class ExtensionRunner {
    extensions;
    runtime;
    uiContext;
    cwd;
    sessionManager;
    modelRegistry;
    errorListeners = new Set();
    getModel = () => undefined;
    isIdleFn = () => true;
    waitForIdleFn = async () => { };
    abortFn = () => { };
    hasPendingMessagesFn = () => false;
    getContextUsageFn = () => undefined;
    compactFn = () => { };
    getSystemPromptFn = () => "";
    newSessionHandler = async () => ({ cancelled: false });
    forkHandler = async () => ({ cancelled: false });
    navigateTreeHandler = async () => ({ cancelled: false });
    switchSessionHandler = async () => ({ cancelled: false });
    reloadHandler = async () => { };
    shutdownHandler = () => { };
    shortcutDiagnostics = [];
    commandDiagnostics = [];
    constructor(extensions, runtime, cwd, sessionManager, modelRegistry) {
        this.extensions = extensions;
        this.runtime = runtime;
        this.uiContext = noOpUIContext;
        this.cwd = cwd;
        this.sessionManager = sessionManager;
        this.modelRegistry = modelRegistry;
    }
    bindCore(actions, contextActions) {
        // Copy actions into the shared runtime (all extension APIs reference this)
        this.runtime.sendMessage = actions.sendMessage;
        this.runtime.sendUserMessage = actions.sendUserMessage;
        this.runtime.appendEntry = actions.appendEntry;
        this.runtime.setSessionName = actions.setSessionName;
        this.runtime.getSessionName = actions.getSessionName;
        this.runtime.setLabel = actions.setLabel;
        this.runtime.getActiveTools = actions.getActiveTools;
        this.runtime.getAllTools = actions.getAllTools;
        this.runtime.setActiveTools = actions.setActiveTools;
        this.runtime.getCommands = actions.getCommands;
        this.runtime.setModel = actions.setModel;
        this.runtime.getThinkingLevel = actions.getThinkingLevel;
        this.runtime.setThinkingLevel = actions.setThinkingLevel;
        // Context actions (required)
        this.getModel = contextActions.getModel;
        this.isIdleFn = contextActions.isIdle;
        this.abortFn = contextActions.abort;
        this.hasPendingMessagesFn = contextActions.hasPendingMessages;
        this.shutdownHandler = contextActions.shutdown;
        this.getContextUsageFn = contextActions.getContextUsage;
        this.compactFn = contextActions.compact;
        this.getSystemPromptFn = contextActions.getSystemPrompt;
        // Process provider registrations queued during extension loading
        for (const { name, config } of this.runtime.pendingProviderRegistrations) {
            this.modelRegistry.registerProvider(name, config);
        }
        this.runtime.pendingProviderRegistrations = [];
    }
    bindCommandContext(actions) {
        if (actions) {
            this.waitForIdleFn = actions.waitForIdle;
            this.newSessionHandler = actions.newSession;
            this.forkHandler = actions.fork;
            this.navigateTreeHandler = actions.navigateTree;
            this.switchSessionHandler = actions.switchSession;
            this.reloadHandler = actions.reload;
            return;
        }
        this.waitForIdleFn = async () => { };
        this.newSessionHandler = async () => ({ cancelled: false });
        this.forkHandler = async () => ({ cancelled: false });
        this.navigateTreeHandler = async () => ({ cancelled: false });
        this.switchSessionHandler = async () => ({ cancelled: false });
        this.reloadHandler = async () => { };
    }
    setUIContext(uiContext) {
        this.uiContext = uiContext ?? noOpUIContext;
    }
    getUIContext() {
        return this.uiContext;
    }
    hasUI() {
        return this.uiContext !== noOpUIContext;
    }
    getExtensionPaths() {
        return this.extensions.map((e) => e.path);
    }
    /** Get all registered tools from all extensions. */
    getAllRegisteredTools() {
        const tools = [];
        for (const ext of this.extensions) {
            for (const tool of ext.tools.values()) {
                tools.push(tool);
            }
        }
        return tools;
    }
    /** Get a tool definition by name. Returns undefined if not found. */
    getToolDefinition(toolName) {
        for (const ext of this.extensions) {
            const tool = ext.tools.get(toolName);
            if (tool) {
                return tool.definition;
            }
        }
        return undefined;
    }
    getFlags() {
        const allFlags = new Map();
        for (const ext of this.extensions) {
            for (const [name, flag] of ext.flags) {
                allFlags.set(name, flag);
            }
        }
        return allFlags;
    }
    setFlagValue(name, value) {
        this.runtime.flagValues.set(name, value);
    }
    getFlagValues() {
        return new Map(this.runtime.flagValues);
    }
    getShortcuts(effectiveKeybindings) {
        this.shortcutDiagnostics = [];
        const builtinKeybindings = buildBuiltinKeybindings(effectiveKeybindings);
        const extensionShortcuts = new Map();
        const addDiagnostic = (message, extensionPath) => {
            this.shortcutDiagnostics.push({ type: "warning", message, path: extensionPath });
            if (!this.hasUI()) {
                console.warn(message);
            }
        };
        for (const ext of this.extensions) {
            for (const [key, shortcut] of ext.shortcuts) {
                const normalizedKey = key.toLowerCase();
                const builtInKeybinding = builtinKeybindings[normalizedKey];
                if (builtInKeybinding?.restrictOverride === true) {
                    addDiagnostic(`Extension shortcut '${key}' from ${shortcut.extensionPath} conflicts with built-in shortcut. Skipping.`, shortcut.extensionPath);
                    continue;
                }
                if (builtInKeybinding?.restrictOverride === false) {
                    addDiagnostic(`Extension shortcut conflict: '${key}' is built-in shortcut for ${builtInKeybinding.action} and ${shortcut.extensionPath}. Using ${shortcut.extensionPath}.`, shortcut.extensionPath);
                }
                const existingExtensionShortcut = extensionShortcuts.get(normalizedKey);
                if (existingExtensionShortcut) {
                    addDiagnostic(`Extension shortcut conflict: '${key}' registered by both ${existingExtensionShortcut.extensionPath} and ${shortcut.extensionPath}. Using ${shortcut.extensionPath}.`, shortcut.extensionPath);
                }
                extensionShortcuts.set(normalizedKey, shortcut);
            }
        }
        return extensionShortcuts;
    }
    getShortcutDiagnostics() {
        return this.shortcutDiagnostics;
    }
    onError(listener) {
        this.errorListeners.add(listener);
        return () => this.errorListeners.delete(listener);
    }
    emitError(error) {
        for (const listener of this.errorListeners) {
            listener(error);
        }
    }
    hasHandlers(eventType) {
        for (const ext of this.extensions) {
            const handlers = ext.handlers.get(eventType);
            if (handlers && handlers.length > 0) {
                return true;
            }
        }
        return false;
    }
    getMessageRenderer(customType) {
        for (const ext of this.extensions) {
            const renderer = ext.messageRenderers.get(customType);
            if (renderer) {
                return renderer;
            }
        }
        return undefined;
    }
    getRegisteredCommands(reserved) {
        this.commandDiagnostics = [];
        const commands = [];
        for (const ext of this.extensions) {
            for (const command of ext.commands.values()) {
                if (reserved?.has(command.name)) {
                    const message = `Extension command '${command.name}' from ${ext.path} conflicts with built-in commands. Skipping.`;
                    this.commandDiagnostics.push({ type: "warning", message, path: ext.path });
                    if (!this.hasUI()) {
                        console.warn(message);
                    }
                    continue;
                }
                commands.push(command);
            }
        }
        return commands;
    }
    getCommandDiagnostics() {
        return this.commandDiagnostics;
    }
    getRegisteredCommandsWithPaths() {
        const result = [];
        for (const ext of this.extensions) {
            for (const command of ext.commands.values()) {
                result.push({ command, extensionPath: ext.path });
            }
        }
        return result;
    }
    getCommand(name) {
        for (const ext of this.extensions) {
            const command = ext.commands.get(name);
            if (command) {
                return command;
            }
        }
        return undefined;
    }
    /**
     * Request a graceful shutdown. Called by extension tools and event handlers.
     * The actual shutdown behavior is provided by the mode via bindExtensions().
     */
    shutdown() {
        this.shutdownHandler();
    }
    /**
     * Create an ExtensionContext for use in event handlers and tool execution.
     * Context values are resolved at call time, so changes via bindCore/bindUI are reflected.
     */
    createContext() {
        const getModel = this.getModel;
        return {
            ui: this.uiContext,
            hasUI: this.hasUI(),
            cwd: this.cwd,
            sessionManager: this.sessionManager,
            modelRegistry: this.modelRegistry,
            get model() {
                return getModel();
            },
            isIdle: () => this.isIdleFn(),
            abort: () => this.abortFn(),
            hasPendingMessages: () => this.hasPendingMessagesFn(),
            shutdown: () => this.shutdownHandler(),
            getContextUsage: () => this.getContextUsageFn(),
            compact: (options) => this.compactFn(options),
            getSystemPrompt: () => this.getSystemPromptFn(),
        };
    }
    createCommandContext() {
        return {
            ...this.createContext(),
            waitForIdle: () => this.waitForIdleFn(),
            newSession: (options) => this.newSessionHandler(options),
            fork: (entryId) => this.forkHandler(entryId),
            navigateTree: (targetId, options) => this.navigateTreeHandler(targetId, options),
            switchSession: (sessionPath) => this.switchSessionHandler(sessionPath),
            reload: () => this.reloadHandler(),
        };
    }
    isSessionBeforeEvent(event) {
        return (event.type === "session_before_switch" ||
            event.type === "session_before_fork" ||
            event.type === "session_before_compact" ||
            event.type === "session_before_tree");
    }
    async emit(event) {
        const ctx = this.createContext();
        let result;
        for (const ext of this.extensions) {
            const handlers = ext.handlers.get(event.type);
            if (!handlers || handlers.length === 0)
                continue;
            for (const handler of handlers) {
                try {
                    const handlerResult = await handler(event, ctx);
                    if (this.isSessionBeforeEvent(event) && handlerResult) {
                        result = handlerResult;
                        if (result.cancel) {
                            return result;
                        }
                    }
                }
                catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    const stack = err instanceof Error ? err.stack : undefined;
                    this.emitError({
                        extensionPath: ext.path,
                        event: event.type,
                        error: message,
                        stack,
                    });
                }
            }
        }
        return result;
    }
    async emitToolResult(event) {
        const ctx = this.createContext();
        const currentEvent = { ...event };
        let modified = false;
        for (const ext of this.extensions) {
            const handlers = ext.handlers.get("tool_result");
            if (!handlers || handlers.length === 0)
                continue;
            for (const handler of handlers) {
                try {
                    const handlerResult = (await handler(currentEvent, ctx));
                    if (!handlerResult)
                        continue;
                    if (handlerResult.content !== undefined) {
                        currentEvent.content = handlerResult.content;
                        modified = true;
                    }
                    if (handlerResult.details !== undefined) {
                        currentEvent.details = handlerResult.details;
                        modified = true;
                    }
                    if (handlerResult.isError !== undefined) {
                        currentEvent.isError = handlerResult.isError;
                        modified = true;
                    }
                }
                catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    const stack = err instanceof Error ? err.stack : undefined;
                    this.emitError({
                        extensionPath: ext.path,
                        event: "tool_result",
                        error: message,
                        stack,
                    });
                }
            }
        }
        if (!modified) {
            return undefined;
        }
        return {
            content: currentEvent.content,
            details: currentEvent.details,
            isError: currentEvent.isError,
        };
    }
    async emitToolCall(event) {
        const ctx = this.createContext();
        let result;
        for (const ext of this.extensions) {
            const handlers = ext.handlers.get("tool_call");
            if (!handlers || handlers.length === 0)
                continue;
            for (const handler of handlers) {
                const handlerResult = await handler(event, ctx);
                if (handlerResult) {
                    result = handlerResult;
                    if (result.block) {
                        return result;
                    }
                }
            }
        }
        return result;
    }
    async emitUserBash(event) {
        const ctx = this.createContext();
        for (const ext of this.extensions) {
            const handlers = ext.handlers.get("user_bash");
            if (!handlers || handlers.length === 0)
                continue;
            for (const handler of handlers) {
                try {
                    const handlerResult = await handler(event, ctx);
                    if (handlerResult) {
                        return handlerResult;
                    }
                }
                catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    const stack = err instanceof Error ? err.stack : undefined;
                    this.emitError({
                        extensionPath: ext.path,
                        event: "user_bash",
                        error: message,
                        stack,
                    });
                }
            }
        }
        return undefined;
    }
    async emitContext(messages) {
        const ctx = this.createContext();
        let currentMessages = structuredClone(messages);
        for (const ext of this.extensions) {
            const handlers = ext.handlers.get("context");
            if (!handlers || handlers.length === 0)
                continue;
            for (const handler of handlers) {
                try {
                    const event = { type: "context", messages: currentMessages };
                    const handlerResult = await handler(event, ctx);
                    if (handlerResult && handlerResult.messages) {
                        currentMessages = handlerResult.messages;
                    }
                }
                catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    const stack = err instanceof Error ? err.stack : undefined;
                    this.emitError({
                        extensionPath: ext.path,
                        event: "context",
                        error: message,
                        stack,
                    });
                }
            }
        }
        return currentMessages;
    }
    async emitBeforeAgentStart(prompt, images, systemPrompt) {
        const ctx = this.createContext();
        const messages = [];
        let currentSystemPrompt = systemPrompt;
        let systemPromptModified = false;
        for (const ext of this.extensions) {
            const handlers = ext.handlers.get("before_agent_start");
            if (!handlers || handlers.length === 0)
                continue;
            for (const handler of handlers) {
                try {
                    const event = {
                        type: "before_agent_start",
                        prompt,
                        images,
                        systemPrompt: currentSystemPrompt,
                    };
                    const handlerResult = await handler(event, ctx);
                    if (handlerResult) {
                        const result = handlerResult;
                        if (result.message) {
                            messages.push(result.message);
                        }
                        if (result.systemPrompt !== undefined) {
                            currentSystemPrompt = result.systemPrompt;
                            systemPromptModified = true;
                        }
                    }
                }
                catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    const stack = err instanceof Error ? err.stack : undefined;
                    this.emitError({
                        extensionPath: ext.path,
                        event: "before_agent_start",
                        error: message,
                        stack,
                    });
                }
            }
        }
        if (messages.length > 0 || systemPromptModified) {
            return {
                messages: messages.length > 0 ? messages : undefined,
                systemPrompt: systemPromptModified ? currentSystemPrompt : undefined,
            };
        }
        return undefined;
    }
    async emitResourcesDiscover(cwd, reason) {
        const ctx = this.createContext();
        const skillPaths = [];
        const promptPaths = [];
        const themePaths = [];
        for (const ext of this.extensions) {
            const handlers = ext.handlers.get("resources_discover");
            if (!handlers || handlers.length === 0)
                continue;
            for (const handler of handlers) {
                try {
                    const event = { type: "resources_discover", cwd, reason };
                    const handlerResult = await handler(event, ctx);
                    const result = handlerResult;
                    if (result?.skillPaths?.length) {
                        skillPaths.push(...result.skillPaths.map((path) => ({ path, extensionPath: ext.path })));
                    }
                    if (result?.promptPaths?.length) {
                        promptPaths.push(...result.promptPaths.map((path) => ({ path, extensionPath: ext.path })));
                    }
                    if (result?.themePaths?.length) {
                        themePaths.push(...result.themePaths.map((path) => ({ path, extensionPath: ext.path })));
                    }
                }
                catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    const stack = err instanceof Error ? err.stack : undefined;
                    this.emitError({
                        extensionPath: ext.path,
                        event: "resources_discover",
                        error: message,
                        stack,
                    });
                }
            }
        }
        return { skillPaths, promptPaths, themePaths };
    }
    /** Emit input event. Transforms chain, "handled" short-circuits. */
    async emitInput(text, images, source) {
        const ctx = this.createContext();
        let currentText = text;
        let currentImages = images;
        for (const ext of this.extensions) {
            for (const handler of ext.handlers.get("input") ?? []) {
                try {
                    const event = { type: "input", text: currentText, images: currentImages, source };
                    const result = (await handler(event, ctx));
                    if (result?.action === "handled")
                        return result;
                    if (result?.action === "transform") {
                        currentText = result.text;
                        currentImages = result.images ?? currentImages;
                    }
                }
                catch (err) {
                    this.emitError({
                        extensionPath: ext.path,
                        event: "input",
                        error: err instanceof Error ? err.message : String(err),
                        stack: err instanceof Error ? err.stack : undefined,
                    });
                }
            }
        }
        return currentText !== text || currentImages !== images
            ? { action: "transform", text: currentText, images: currentImages }
            : { action: "continue" };
    }
}
//# sourceMappingURL=runner.js.map