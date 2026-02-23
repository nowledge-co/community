/**
 * Extension loader - loads TypeScript extension modules using jiti.
 *
 * Uses @mariozechner/jiti fork with virtualModules support for compiled Bun binaries.
 */
import { type EventBus } from "../event-bus.js";
import type { Extension, ExtensionFactory, ExtensionRuntime, LoadExtensionsResult } from "./types.js";
/**
 * Create a runtime with throwing stubs for action methods.
 * Runner.bindCore() replaces these with real implementations.
 */
export declare function createExtensionRuntime(): ExtensionRuntime;
/**
 * Create an Extension from an inline factory function.
 */
export declare function loadExtensionFromFactory(factory: ExtensionFactory, cwd: string, eventBus: EventBus, runtime: ExtensionRuntime, extensionPath?: string): Promise<Extension>;
/**
 * Load extensions from paths.
 */
export declare function loadExtensions(paths: string[], cwd: string, eventBus?: EventBus): Promise<LoadExtensionsResult>;
/**
 * Discover and load extensions from standard locations.
 */
export declare function discoverAndLoadExtensions(configuredPaths: string[], cwd: string, agentDir?: string, eventBus?: EventBus): Promise<LoadExtensionsResult>;
//# sourceMappingURL=loader.d.ts.map