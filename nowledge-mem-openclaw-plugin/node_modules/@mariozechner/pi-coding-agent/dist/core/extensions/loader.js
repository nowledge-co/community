/**
 * Extension loader - loads TypeScript extension modules using jiti.
 *
 * Uses @mariozechner/jiti fork with virtualModules support for compiled Bun binaries.
 */
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "@mariozechner/jiti";
import * as _bundledPiAgentCore from "@mariozechner/pi-agent-core";
import * as _bundledPiAi from "@mariozechner/pi-ai";
import * as _bundledPiTui from "@mariozechner/pi-tui";
// Static imports of packages that extensions may use.
// These MUST be static so Bun bundles them into the compiled binary.
// The virtualModules option then makes them available to extensions.
import * as _bundledTypebox from "@sinclair/typebox";
import { getAgentDir, isBunBinary } from "../../config.js";
// NOTE: This import works because loader.ts exports are NOT re-exported from index.ts,
// avoiding a circular dependency. Extensions can import from @mariozechner/pi-coding-agent.
import * as _bundledPiCodingAgent from "../../index.js";
import { createEventBus } from "../event-bus.js";
import { execCommand } from "../exec.js";
/** Modules available to extensions via virtualModules (for compiled Bun binary) */
const VIRTUAL_MODULES = {
    "@sinclair/typebox": _bundledTypebox,
    "@mariozechner/pi-agent-core": _bundledPiAgentCore,
    "@mariozechner/pi-tui": _bundledPiTui,
    "@mariozechner/pi-ai": _bundledPiAi,
    "@mariozechner/pi-coding-agent": _bundledPiCodingAgent,
};
const require = createRequire(import.meta.url);
/**
 * Get aliases for jiti (used in Node.js/development mode).
 * In Bun binary mode, virtualModules is used instead.
 */
let _aliases = null;
function getAliases() {
    if (_aliases)
        return _aliases;
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const packageIndex = path.resolve(__dirname, "../..", "index.js");
    const typeboxEntry = require.resolve("@sinclair/typebox");
    const typeboxRoot = typeboxEntry.replace(/\/build\/cjs\/index\.js$/, "");
    _aliases = {
        "@mariozechner/pi-coding-agent": packageIndex,
        "@mariozechner/pi-agent-core": require.resolve("@mariozechner/pi-agent-core"),
        "@mariozechner/pi-tui": require.resolve("@mariozechner/pi-tui"),
        "@mariozechner/pi-ai": require.resolve("@mariozechner/pi-ai"),
        "@sinclair/typebox": typeboxRoot,
    };
    return _aliases;
}
const UNICODE_SPACES = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;
function normalizeUnicodeSpaces(str) {
    return str.replace(UNICODE_SPACES, " ");
}
function expandPath(p) {
    const normalized = normalizeUnicodeSpaces(p);
    if (normalized.startsWith("~/")) {
        return path.join(os.homedir(), normalized.slice(2));
    }
    if (normalized.startsWith("~")) {
        return path.join(os.homedir(), normalized.slice(1));
    }
    return normalized;
}
function resolvePath(extPath, cwd) {
    const expanded = expandPath(extPath);
    if (path.isAbsolute(expanded)) {
        return expanded;
    }
    return path.resolve(cwd, expanded);
}
/**
 * Create a runtime with throwing stubs for action methods.
 * Runner.bindCore() replaces these with real implementations.
 */
export function createExtensionRuntime() {
    const notInitialized = () => {
        throw new Error("Extension runtime not initialized. Action methods cannot be called during extension loading.");
    };
    return {
        sendMessage: notInitialized,
        sendUserMessage: notInitialized,
        appendEntry: notInitialized,
        setSessionName: notInitialized,
        getSessionName: notInitialized,
        setLabel: notInitialized,
        getActiveTools: notInitialized,
        getAllTools: notInitialized,
        setActiveTools: notInitialized,
        getCommands: notInitialized,
        setModel: () => Promise.reject(new Error("Extension runtime not initialized")),
        getThinkingLevel: notInitialized,
        setThinkingLevel: notInitialized,
        flagValues: new Map(),
        pendingProviderRegistrations: [],
    };
}
/**
 * Create the ExtensionAPI for an extension.
 * Registration methods write to the extension object.
 * Action methods delegate to the shared runtime.
 */
function createExtensionAPI(extension, runtime, cwd, eventBus) {
    const api = {
        // Registration methods - write to extension
        on(event, handler) {
            const list = extension.handlers.get(event) ?? [];
            list.push(handler);
            extension.handlers.set(event, list);
        },
        registerTool(tool) {
            extension.tools.set(tool.name, {
                definition: tool,
                extensionPath: extension.path,
            });
        },
        registerCommand(name, options) {
            extension.commands.set(name, { name, ...options });
        },
        registerShortcut(shortcut, options) {
            extension.shortcuts.set(shortcut, { shortcut, extensionPath: extension.path, ...options });
        },
        registerFlag(name, options) {
            extension.flags.set(name, { name, extensionPath: extension.path, ...options });
            if (options.default !== undefined) {
                runtime.flagValues.set(name, options.default);
            }
        },
        registerMessageRenderer(customType, renderer) {
            extension.messageRenderers.set(customType, renderer);
        },
        // Flag access - checks extension registered it, reads from runtime
        getFlag(name) {
            if (!extension.flags.has(name))
                return undefined;
            return runtime.flagValues.get(name);
        },
        // Action methods - delegate to shared runtime
        sendMessage(message, options) {
            runtime.sendMessage(message, options);
        },
        sendUserMessage(content, options) {
            runtime.sendUserMessage(content, options);
        },
        appendEntry(customType, data) {
            runtime.appendEntry(customType, data);
        },
        setSessionName(name) {
            runtime.setSessionName(name);
        },
        getSessionName() {
            return runtime.getSessionName();
        },
        setLabel(entryId, label) {
            runtime.setLabel(entryId, label);
        },
        exec(command, args, options) {
            return execCommand(command, args, options?.cwd ?? cwd, options);
        },
        getActiveTools() {
            return runtime.getActiveTools();
        },
        getAllTools() {
            return runtime.getAllTools();
        },
        setActiveTools(toolNames) {
            runtime.setActiveTools(toolNames);
        },
        getCommands() {
            return runtime.getCommands();
        },
        setModel(model) {
            return runtime.setModel(model);
        },
        getThinkingLevel() {
            return runtime.getThinkingLevel();
        },
        setThinkingLevel(level) {
            runtime.setThinkingLevel(level);
        },
        registerProvider(name, config) {
            runtime.pendingProviderRegistrations.push({ name, config });
        },
        events: eventBus,
    };
    return api;
}
async function loadExtensionModule(extensionPath) {
    const jiti = createJiti(import.meta.url, {
        moduleCache: false,
        // In Bun binary: use virtualModules for bundled packages (no filesystem resolution)
        // Also disable tryNative so jiti handles ALL imports (not just the entry point)
        // In Node.js/dev: use aliases to resolve to node_modules paths
        ...(isBunBinary ? { virtualModules: VIRTUAL_MODULES, tryNative: false } : { alias: getAliases() }),
    });
    const module = await jiti.import(extensionPath, { default: true });
    const factory = module;
    return typeof factory !== "function" ? undefined : factory;
}
/**
 * Create an Extension object with empty collections.
 */
function createExtension(extensionPath, resolvedPath) {
    return {
        path: extensionPath,
        resolvedPath,
        handlers: new Map(),
        tools: new Map(),
        messageRenderers: new Map(),
        commands: new Map(),
        flags: new Map(),
        shortcuts: new Map(),
    };
}
async function loadExtension(extensionPath, cwd, eventBus, runtime) {
    const resolvedPath = resolvePath(extensionPath, cwd);
    try {
        const factory = await loadExtensionModule(resolvedPath);
        if (!factory) {
            return { extension: null, error: `Extension does not export a valid factory function: ${extensionPath}` };
        }
        const extension = createExtension(extensionPath, resolvedPath);
        const api = createExtensionAPI(extension, runtime, cwd, eventBus);
        await factory(api);
        return { extension, error: null };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { extension: null, error: `Failed to load extension: ${message}` };
    }
}
/**
 * Create an Extension from an inline factory function.
 */
export async function loadExtensionFromFactory(factory, cwd, eventBus, runtime, extensionPath = "<inline>") {
    const extension = createExtension(extensionPath, extensionPath);
    const api = createExtensionAPI(extension, runtime, cwd, eventBus);
    await factory(api);
    return extension;
}
/**
 * Load extensions from paths.
 */
export async function loadExtensions(paths, cwd, eventBus) {
    const extensions = [];
    const errors = [];
    const resolvedEventBus = eventBus ?? createEventBus();
    const runtime = createExtensionRuntime();
    for (const extPath of paths) {
        const { extension, error } = await loadExtension(extPath, cwd, resolvedEventBus, runtime);
        if (error) {
            errors.push({ path: extPath, error });
            continue;
        }
        if (extension) {
            extensions.push(extension);
        }
    }
    return {
        extensions,
        errors,
        runtime,
    };
}
function readPiManifest(packageJsonPath) {
    try {
        const content = fs.readFileSync(packageJsonPath, "utf-8");
        const pkg = JSON.parse(content);
        if (pkg.pi && typeof pkg.pi === "object") {
            return pkg.pi;
        }
        return null;
    }
    catch {
        return null;
    }
}
function isExtensionFile(name) {
    return name.endsWith(".ts") || name.endsWith(".js");
}
/**
 * Resolve extension entry points from a directory.
 *
 * Checks for:
 * 1. package.json with "pi.extensions" field -> returns declared paths
 * 2. index.ts or index.js -> returns the index file
 *
 * Returns resolved paths or null if no entry points found.
 */
function resolveExtensionEntries(dir) {
    // Check for package.json with "pi" field first
    const packageJsonPath = path.join(dir, "package.json");
    if (fs.existsSync(packageJsonPath)) {
        const manifest = readPiManifest(packageJsonPath);
        if (manifest?.extensions?.length) {
            const entries = [];
            for (const extPath of manifest.extensions) {
                const resolvedExtPath = path.resolve(dir, extPath);
                if (fs.existsSync(resolvedExtPath)) {
                    entries.push(resolvedExtPath);
                }
            }
            if (entries.length > 0) {
                return entries;
            }
        }
    }
    // Check for index.ts or index.js
    const indexTs = path.join(dir, "index.ts");
    const indexJs = path.join(dir, "index.js");
    if (fs.existsSync(indexTs)) {
        return [indexTs];
    }
    if (fs.existsSync(indexJs)) {
        return [indexJs];
    }
    return null;
}
/**
 * Discover extensions in a directory.
 *
 * Discovery rules:
 * 1. Direct files: `extensions/*.ts` or `*.js` → load
 * 2. Subdirectory with index: `extensions/* /index.ts` or `index.js` → load
 * 3. Subdirectory with package.json: `extensions/* /package.json` with "pi" field → load what it declares
 *
 * No recursion beyond one level. Complex packages must use package.json manifest.
 */
function discoverExtensionsInDir(dir) {
    if (!fs.existsSync(dir)) {
        return [];
    }
    const discovered = [];
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const entryPath = path.join(dir, entry.name);
            // 1. Direct files: *.ts or *.js
            if ((entry.isFile() || entry.isSymbolicLink()) && isExtensionFile(entry.name)) {
                discovered.push(entryPath);
                continue;
            }
            // 2 & 3. Subdirectories
            if (entry.isDirectory() || entry.isSymbolicLink()) {
                const entries = resolveExtensionEntries(entryPath);
                if (entries) {
                    discovered.push(...entries);
                }
            }
        }
    }
    catch {
        return [];
    }
    return discovered;
}
/**
 * Discover and load extensions from standard locations.
 */
export async function discoverAndLoadExtensions(configuredPaths, cwd, agentDir = getAgentDir(), eventBus) {
    const allPaths = [];
    const seen = new Set();
    const addPaths = (paths) => {
        for (const p of paths) {
            const resolved = path.resolve(p);
            if (!seen.has(resolved)) {
                seen.add(resolved);
                allPaths.push(p);
            }
        }
    };
    // 1. Global extensions: agentDir/extensions/
    const globalExtDir = path.join(agentDir, "extensions");
    addPaths(discoverExtensionsInDir(globalExtDir));
    // 2. Project-local extensions: cwd/.pi/extensions/
    const localExtDir = path.join(cwd, ".pi", "extensions");
    addPaths(discoverExtensionsInDir(localExtDir));
    // 3. Explicitly configured paths
    for (const p of configuredPaths) {
        const resolved = resolvePath(p, cwd);
        if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
            // Check for package.json with pi manifest or index.ts
            const entries = resolveExtensionEntries(resolved);
            if (entries) {
                addPaths(entries);
                continue;
            }
            // No explicit entries - discover individual files in directory
            addPaths(discoverExtensionsInDir(resolved));
            continue;
        }
        addPaths([resolved]);
    }
    return loadExtensions(allPaths, cwd, eventBus);
}
//# sourceMappingURL=loader.js.map