/**
 * Interactive mode for the coding agent.
 * Handles TUI rendering and user interaction, delegating business logic to AgentSession.
 */
import { type ImageContent } from "@mariozechner/pi-ai";
import { type AgentSession } from "../../core/agent-session.js";
/**
 * Options for InteractiveMode initialization.
 */
export interface InteractiveModeOptions {
    /** Providers that were migrated to auth.json (shows warning) */
    migratedProviders?: string[];
    /** Warning message if session model couldn't be restored */
    modelFallbackMessage?: string;
    /** Initial message to send on startup (can include @file content) */
    initialMessage?: string;
    /** Images to attach to the initial message */
    initialImages?: ImageContent[];
    /** Additional messages to send after the initial message */
    initialMessages?: string[];
    /** Force verbose startup (overrides quietStartup setting) */
    verbose?: boolean;
}
export declare class InteractiveMode {
    private options;
    private session;
    private ui;
    private chatContainer;
    private pendingMessagesContainer;
    private statusContainer;
    private defaultEditor;
    private editor;
    private autocompleteProvider;
    private fdPath;
    private editorContainer;
    private footer;
    private footerDataProvider;
    private keybindings;
    private version;
    private isInitialized;
    private onInputCallback?;
    private loadingAnimation;
    private pendingWorkingMessage;
    private readonly defaultWorkingMessage;
    private lastSigintTime;
    private lastEscapeTime;
    private changelogMarkdown;
    private lastStatusSpacer;
    private lastStatusText;
    private streamingComponent;
    private streamingMessage;
    private pendingTools;
    private toolOutputExpanded;
    private hideThinkingBlock;
    private skillCommands;
    private unsubscribe?;
    private isBashMode;
    private bashComponent;
    private pendingBashComponents;
    private autoCompactionLoader;
    private autoCompactionEscapeHandler?;
    private retryLoader;
    private retryEscapeHandler?;
    private compactionQueuedMessages;
    private shutdownRequested;
    private extensionSelector;
    private extensionInput;
    private extensionEditor;
    private extensionTerminalInputUnsubscribers;
    private extensionWidgetsAbove;
    private extensionWidgetsBelow;
    private widgetContainerAbove;
    private widgetContainerBelow;
    private customFooter;
    private headerContainer;
    private builtInHeader;
    private customHeader;
    private get agent();
    private get sessionManager();
    private get settingsManager();
    constructor(session: AgentSession, options?: InteractiveModeOptions);
    private setupAutocomplete;
    init(): Promise<void>;
    /**
     * Update terminal title with session name and cwd.
     */
    private updateTerminalTitle;
    /**
     * Run the interactive mode. This is the main entry point.
     * Initializes the UI, shows warnings, processes initial messages, and starts the interactive loop.
     */
    run(): Promise<void>;
    private checkForNewVersion;
    /**
     * Get changelog entries to display on startup.
     * Only shows new entries since last seen version, skips for resumed sessions.
     */
    private getChangelogForDisplay;
    private getMarkdownThemeWithSettings;
    private formatDisplayPath;
    /**
     * Get a short path relative to the package root for display.
     */
    private getShortPath;
    private getDisplaySourceInfo;
    private getScopeGroup;
    private isPackageSource;
    private buildScopeGroups;
    private formatScopeGroups;
    /**
     * Find metadata for a path, checking parent directories if exact match fails.
     * Package manager stores metadata for directories, but we display file paths.
     */
    private findMetadata;
    /**
     * Format a path with its source/scope info from metadata.
     */
    private formatPathWithSource;
    /**
     * Format resource diagnostics with nice collision display using metadata.
     */
    private formatDiagnostics;
    private showLoadedResources;
    private initExtensions;
    /**
     * Get a registered tool definition by name (for custom rendering).
     */
    private getRegisteredToolDefinition;
    /**
     * Set up keyboard shortcuts registered by extensions.
     */
    private setupExtensionShortcuts;
    /**
     * Set extension status text in the footer.
     */
    private setExtensionStatus;
    /**
     * Set an extension widget (string array or custom component).
     */
    private setExtensionWidget;
    private clearExtensionWidgets;
    private resetExtensionUI;
    private static readonly MAX_WIDGET_LINES;
    /**
     * Render all extension widgets to the widget container.
     */
    private renderWidgets;
    private renderWidgetContainer;
    /**
     * Set a custom footer component, or restore the built-in footer.
     */
    private setExtensionFooter;
    /**
     * Set a custom header component, or restore the built-in header.
     */
    private setExtensionHeader;
    private addExtensionTerminalInputListener;
    private clearExtensionTerminalInputListeners;
    /**
     * Create the ExtensionUIContext for extensions.
     */
    private createExtensionUIContext;
    /**
     * Show a selector for extensions.
     */
    private showExtensionSelector;
    /**
     * Hide the extension selector.
     */
    private hideExtensionSelector;
    private showExtensionConfirm;
    /**
     * Show a text input for extensions.
     */
    private showExtensionInput;
    /**
     * Hide the extension input.
     */
    private hideExtensionInput;
    /**
     * Show a multi-line editor for extensions (with Ctrl+G support).
     */
    private showExtensionEditor;
    /**
     * Hide the extension editor.
     */
    private hideExtensionEditor;
    /**
     * Set a custom editor component from an extension.
     * Pass undefined to restore the default editor.
     */
    private setCustomEditorComponent;
    /**
     * Show a notification for extensions.
     */
    private showExtensionNotify;
    private showExtensionCustom;
    /**
     * Show an extension error in the UI.
     */
    private showExtensionError;
    private setupKeyHandlers;
    private handleClipboardImagePaste;
    private setupEditorSubmitHandler;
    private subscribeToAgent;
    private handleEvent;
    /** Extract text content from a user message */
    private getUserMessageText;
    /**
     * Show a status message in the chat.
     *
     * If multiple status messages are emitted back-to-back (without anything else being added to the chat),
     * we update the previous status line instead of appending new ones to avoid log spam.
     */
    private showStatus;
    private addMessageToChat;
    /**
     * Render session context to chat. Used for initial load and rebuild after compaction.
     * @param sessionContext Session context to render
     * @param options.updateFooter Update footer state
     * @param options.populateHistory Add user messages to editor history
     */
    private renderSessionContext;
    renderInitialMessages(): void;
    getUserInput(): Promise<string>;
    private rebuildChatFromMessages;
    private handleCtrlC;
    private handleCtrlD;
    /**
     * Gracefully shutdown the agent.
     * Emits shutdown event to extensions, then exits.
     */
    private isShuttingDown;
    private shutdown;
    private checkShutdownRequested;
    private handleCtrlZ;
    private handleFollowUp;
    private handleDequeue;
    private updateEditorBorderColor;
    private cycleThinkingLevel;
    private cycleModel;
    private toggleToolOutputExpansion;
    private setToolsExpanded;
    private toggleThinkingBlockVisibility;
    private openExternalEditor;
    clearEditor(): void;
    showError(errorMessage: string): void;
    showWarning(warningMessage: string): void;
    showNewVersionNotification(newVersion: string): void;
    /**
     * Get all queued messages (read-only).
     * Combines session queue and compaction queue.
     */
    private getAllQueuedMessages;
    /**
     * Clear all queued messages and return their contents.
     * Clears both session queue and compaction queue.
     */
    private clearAllQueues;
    private updatePendingMessagesDisplay;
    private restoreQueuedMessagesToEditor;
    private queueCompactionMessage;
    private isExtensionCommand;
    private flushCompactionQueue;
    /** Move pending bash components from pending area to chat */
    private flushPendingBashComponents;
    /**
     * Shows a selector component in place of the editor.
     * @param create Factory that receives a `done` callback and returns the component and focus target
     */
    private showSelector;
    private showSettingsSelector;
    private handleModelCommand;
    private findExactModelMatch;
    private getModelCandidates;
    private updateAvailableProviderCount;
    private showModelSelector;
    private showModelsSelector;
    private showUserMessageSelector;
    private showTreeSelector;
    private showSessionSelector;
    private handleResumeSession;
    private showOAuthSelector;
    private showLoginDialog;
    private handleReloadCommand;
    private handleExportCommand;
    private handleShareCommand;
    private handleCopyCommand;
    private handleNameCommand;
    private handleSessionCommand;
    private handleChangelogCommand;
    /**
     * Capitalize keybinding for display (e.g., "ctrl+c" -> "Ctrl+C").
     */
    private capitalizeKey;
    /**
     * Get capitalized display string for an app keybinding action.
     */
    private getAppKeyDisplay;
    /**
     * Get capitalized display string for an editor keybinding action.
     */
    private getEditorKeyDisplay;
    private handleHotkeysCommand;
    private handleClearCommand;
    private handleDebugCommand;
    private handleArminSaysHi;
    private handleDaxnuts;
    private checkDaxnutsEasterEgg;
    private handleBashCommand;
    private handleCompactCommand;
    private executeCompaction;
    stop(): void;
}
//# sourceMappingURL=interactive-mode.d.ts.map