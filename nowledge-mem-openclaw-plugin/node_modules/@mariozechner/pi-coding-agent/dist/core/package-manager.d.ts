import type { SettingsManager } from "./settings-manager.js";
export interface PathMetadata {
    source: string;
    scope: SourceScope;
    origin: "package" | "top-level";
    baseDir?: string;
}
export interface ResolvedResource {
    path: string;
    enabled: boolean;
    metadata: PathMetadata;
}
export interface ResolvedPaths {
    extensions: ResolvedResource[];
    skills: ResolvedResource[];
    prompts: ResolvedResource[];
    themes: ResolvedResource[];
}
export type MissingSourceAction = "install" | "skip" | "error";
export interface ProgressEvent {
    type: "start" | "progress" | "complete" | "error";
    action: "install" | "remove" | "update" | "clone" | "pull";
    source: string;
    message?: string;
}
export type ProgressCallback = (event: ProgressEvent) => void;
export interface PackageManager {
    resolve(onMissing?: (source: string) => Promise<MissingSourceAction>): Promise<ResolvedPaths>;
    install(source: string, options?: {
        local?: boolean;
    }): Promise<void>;
    remove(source: string, options?: {
        local?: boolean;
    }): Promise<void>;
    update(source?: string): Promise<void>;
    resolveExtensionSources(sources: string[], options?: {
        local?: boolean;
        temporary?: boolean;
    }): Promise<ResolvedPaths>;
    addSourceToSettings(source: string, options?: {
        local?: boolean;
    }): boolean;
    removeSourceFromSettings(source: string, options?: {
        local?: boolean;
    }): boolean;
    setProgressCallback(callback: ProgressCallback | undefined): void;
    getInstalledPath(source: string, scope: "user" | "project"): string | undefined;
}
interface PackageManagerOptions {
    cwd: string;
    agentDir: string;
    settingsManager: SettingsManager;
}
type SourceScope = "user" | "project" | "temporary";
export declare class DefaultPackageManager implements PackageManager {
    private cwd;
    private agentDir;
    private settingsManager;
    private globalNpmRoot;
    private progressCallback;
    constructor(options: PackageManagerOptions);
    setProgressCallback(callback: ProgressCallback | undefined): void;
    addSourceToSettings(source: string, options?: {
        local?: boolean;
    }): boolean;
    removeSourceFromSettings(source: string, options?: {
        local?: boolean;
    }): boolean;
    getInstalledPath(source: string, scope: "user" | "project"): string | undefined;
    private emitProgress;
    private withProgress;
    resolve(onMissing?: (source: string) => Promise<MissingSourceAction>): Promise<ResolvedPaths>;
    resolveExtensionSources(sources: string[], options?: {
        local?: boolean;
        temporary?: boolean;
    }): Promise<ResolvedPaths>;
    install(source: string, options?: {
        local?: boolean;
    }): Promise<void>;
    remove(source: string, options?: {
        local?: boolean;
    }): Promise<void>;
    update(source?: string): Promise<void>;
    private updateSourceForScope;
    private resolvePackageSources;
    private resolveLocalExtensionSource;
    private installParsedSource;
    private getPackageSourceString;
    private getSourceMatchKeyForInput;
    private getSourceMatchKeyForSettings;
    private packageSourcesMatch;
    private normalizePackageSourceForSettings;
    private parseSource;
    private npmNeedsUpdate;
    private getInstalledNpmVersion;
    private getLatestNpmVersion;
    /**
     * Get a unique identity for a package, ignoring version/ref.
     * Used to detect when the same package is in both global and project settings.
     * For git packages, uses normalized host/path to ensure SSH and HTTPS URLs
     * for the same repository are treated as identical.
     */
    private getPackageIdentity;
    /**
     * Dedupe packages: if same package identity appears in both global and project,
     * keep only the project one (project wins).
     */
    private dedupePackages;
    private parseNpmSpec;
    private installNpm;
    private uninstallNpm;
    private installGit;
    private updateGit;
    private refreshTemporaryGitSource;
    private removeGit;
    private pruneEmptyGitParents;
    private ensureNpmProject;
    private ensureGitIgnore;
    private getNpmInstallRoot;
    private getGlobalNpmRoot;
    private getNpmInstallPath;
    private getGitInstallPath;
    private getGitInstallRoot;
    private getTemporaryDir;
    private getBaseDirForScope;
    private resolvePath;
    private resolvePathFromBase;
    private collectPackageResources;
    private collectDefaultResources;
    private applyPackageFilter;
    /**
     * Collect all files from a package for a resource type, applying manifest patterns.
     * Returns { allFiles, enabledByManifest } where enabledByManifest is the set of files
     * that pass the manifest's own patterns.
     */
    private collectManifestFiles;
    private readPiManifest;
    private addManifestEntries;
    private collectFilesFromManifestEntries;
    private resolveLocalEntries;
    private addAutoDiscoveredResources;
    private collectFilesFromPaths;
    private getTargetMap;
    private addResource;
    private createAccumulator;
    private toResolvedPaths;
    private runCommand;
    private runCommandSync;
}
export {};
//# sourceMappingURL=package-manager.d.ts.map