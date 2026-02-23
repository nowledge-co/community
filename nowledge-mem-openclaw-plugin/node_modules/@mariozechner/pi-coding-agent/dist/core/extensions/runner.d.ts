/**
 * Extension runner - executes extensions and manages their lifecycle.
 */
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ImageContent } from "@mariozechner/pi-ai";
import type { KeyId } from "@mariozechner/pi-tui";
import type { ResourceDiagnostic } from "../diagnostics.js";
import type { KeybindingsConfig } from "../keybindings.js";
import type { ModelRegistry } from "../model-registry.js";
import type { SessionManager } from "../session-manager.js";
import type { BeforeAgentStartEvent, BeforeAgentStartEventResult, ContextEvent, Extension, ExtensionActions, ExtensionCommandContext, ExtensionCommandContextActions, ExtensionContext, ExtensionContextActions, ExtensionError, ExtensionEvent, ExtensionFlag, ExtensionRuntime, ExtensionShortcut, ExtensionUIContext, InputEvent, InputEventResult, InputSource, MessageRenderer, RegisteredCommand, RegisteredTool, ResourcesDiscoverEvent, SessionBeforeCompactResult, SessionBeforeForkResult, SessionBeforeSwitchResult, SessionBeforeTreeResult, ToolCallEvent, ToolCallEventResult, ToolResultEvent, ToolResultEventResult, UserBashEvent, UserBashEventResult } from "./types.js";
/** Combined result from all before_agent_start handlers */
interface BeforeAgentStartCombinedResult {
    messages?: NonNullable<BeforeAgentStartEventResult["message"]>[];
    systemPrompt?: string;
}
/**
 * Events handled by the generic emit() method.
 * Events with dedicated emitXxx() methods are excluded for stronger type safety.
 */
type RunnerEmitEvent = Exclude<ExtensionEvent, ToolCallEvent | ToolResultEvent | UserBashEvent | ContextEvent | BeforeAgentStartEvent | ResourcesDiscoverEvent | InputEvent>;
type RunnerEmitResult<TEvent extends RunnerEmitEvent> = TEvent extends {
    type: "session_before_switch";
} ? SessionBeforeSwitchResult | undefined : TEvent extends {
    type: "session_before_fork";
} ? SessionBeforeForkResult | undefined : TEvent extends {
    type: "session_before_compact";
} ? SessionBeforeCompactResult | undefined : TEvent extends {
    type: "session_before_tree";
} ? SessionBeforeTreeResult | undefined : undefined;
export type ExtensionErrorListener = (error: ExtensionError) => void;
export type NewSessionHandler = (options?: {
    parentSession?: string;
    setup?: (sessionManager: SessionManager) => Promise<void>;
}) => Promise<{
    cancelled: boolean;
}>;
export type ForkHandler = (entryId: string) => Promise<{
    cancelled: boolean;
}>;
export type NavigateTreeHandler = (targetId: string, options?: {
    summarize?: boolean;
    customInstructions?: string;
    replaceInstructions?: boolean;
    label?: string;
}) => Promise<{
    cancelled: boolean;
}>;
export type SwitchSessionHandler = (sessionPath: string) => Promise<{
    cancelled: boolean;
}>;
export type ReloadHandler = () => Promise<void>;
export type ShutdownHandler = () => void;
/**
 * Helper function to emit session_shutdown event to extensions.
 * Returns true if the event was emitted, false if there were no handlers.
 */
export declare function emitSessionShutdownEvent(extensionRunner: ExtensionRunner | undefined): Promise<boolean>;
export declare class ExtensionRunner {
    private extensions;
    private runtime;
    private uiContext;
    private cwd;
    private sessionManager;
    private modelRegistry;
    private errorListeners;
    private getModel;
    private isIdleFn;
    private waitForIdleFn;
    private abortFn;
    private hasPendingMessagesFn;
    private getContextUsageFn;
    private compactFn;
    private getSystemPromptFn;
    private newSessionHandler;
    private forkHandler;
    private navigateTreeHandler;
    private switchSessionHandler;
    private reloadHandler;
    private shutdownHandler;
    private shortcutDiagnostics;
    private commandDiagnostics;
    constructor(extensions: Extension[], runtime: ExtensionRuntime, cwd: string, sessionManager: SessionManager, modelRegistry: ModelRegistry);
    bindCore(actions: ExtensionActions, contextActions: ExtensionContextActions): void;
    bindCommandContext(actions?: ExtensionCommandContextActions): void;
    setUIContext(uiContext?: ExtensionUIContext): void;
    getUIContext(): ExtensionUIContext;
    hasUI(): boolean;
    getExtensionPaths(): string[];
    /** Get all registered tools from all extensions. */
    getAllRegisteredTools(): RegisteredTool[];
    /** Get a tool definition by name. Returns undefined if not found. */
    getToolDefinition(toolName: string): RegisteredTool["definition"] | undefined;
    getFlags(): Map<string, ExtensionFlag>;
    setFlagValue(name: string, value: boolean | string): void;
    getFlagValues(): Map<string, boolean | string>;
    getShortcuts(effectiveKeybindings: Required<KeybindingsConfig>): Map<KeyId, ExtensionShortcut>;
    getShortcutDiagnostics(): ResourceDiagnostic[];
    onError(listener: ExtensionErrorListener): () => void;
    emitError(error: ExtensionError): void;
    hasHandlers(eventType: string): boolean;
    getMessageRenderer(customType: string): MessageRenderer | undefined;
    getRegisteredCommands(reserved?: Set<string>): RegisteredCommand[];
    getCommandDiagnostics(): ResourceDiagnostic[];
    getRegisteredCommandsWithPaths(): Array<{
        command: RegisteredCommand;
        extensionPath: string;
    }>;
    getCommand(name: string): RegisteredCommand | undefined;
    /**
     * Request a graceful shutdown. Called by extension tools and event handlers.
     * The actual shutdown behavior is provided by the mode via bindExtensions().
     */
    shutdown(): void;
    /**
     * Create an ExtensionContext for use in event handlers and tool execution.
     * Context values are resolved at call time, so changes via bindCore/bindUI are reflected.
     */
    createContext(): ExtensionContext;
    createCommandContext(): ExtensionCommandContext;
    private isSessionBeforeEvent;
    emit<TEvent extends RunnerEmitEvent>(event: TEvent): Promise<RunnerEmitResult<TEvent>>;
    emitToolResult(event: ToolResultEvent): Promise<ToolResultEventResult | undefined>;
    emitToolCall(event: ToolCallEvent): Promise<ToolCallEventResult | undefined>;
    emitUserBash(event: UserBashEvent): Promise<UserBashEventResult | undefined>;
    emitContext(messages: AgentMessage[]): Promise<AgentMessage[]>;
    emitBeforeAgentStart(prompt: string, images: ImageContent[] | undefined, systemPrompt: string): Promise<BeforeAgentStartCombinedResult | undefined>;
    emitResourcesDiscover(cwd: string, reason: ResourcesDiscoverEvent["reason"]): Promise<{
        skillPaths: Array<{
            path: string;
            extensionPath: string;
        }>;
        promptPaths: Array<{
            path: string;
            extensionPath: string;
        }>;
        themePaths: Array<{
            path: string;
            extensionPath: string;
        }>;
    }>;
    /** Emit input event. Transforms chain, "handled" short-circuits. */
    emitInput(text: string, images: ImageContent[] | undefined, source: InputSource): Promise<InputEventResult>;
}
export {};
//# sourceMappingURL=runner.d.ts.map