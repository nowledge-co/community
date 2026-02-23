import { type Theme } from "../modes/interactive/theme/theme.js";
import type { ResourceDiagnostic } from "./diagnostics.js";
export type { ResourceCollision, ResourceDiagnostic } from "./diagnostics.js";
import { type EventBus } from "./event-bus.js";
import type { ExtensionFactory, LoadExtensionsResult } from "./extensions/types.js";
import { type PathMetadata } from "./package-manager.js";
import type { PromptTemplate } from "./prompt-templates.js";
import { SettingsManager } from "./settings-manager.js";
import type { Skill } from "./skills.js";
export interface ResourceExtensionPaths {
    skillPaths?: Array<{
        path: string;
        metadata: PathMetadata;
    }>;
    promptPaths?: Array<{
        path: string;
        metadata: PathMetadata;
    }>;
    themePaths?: Array<{
        path: string;
        metadata: PathMetadata;
    }>;
}
export interface ResourceLoader {
    getExtensions(): LoadExtensionsResult;
    getSkills(): {
        skills: Skill[];
        diagnostics: ResourceDiagnostic[];
    };
    getPrompts(): {
        prompts: PromptTemplate[];
        diagnostics: ResourceDiagnostic[];
    };
    getThemes(): {
        themes: Theme[];
        diagnostics: ResourceDiagnostic[];
    };
    getAgentsFiles(): {
        agentsFiles: Array<{
            path: string;
            content: string;
        }>;
    };
    getSystemPrompt(): string | undefined;
    getAppendSystemPrompt(): string[];
    getPathMetadata(): Map<string, PathMetadata>;
    extendResources(paths: ResourceExtensionPaths): void;
    reload(): Promise<void>;
}
export interface DefaultResourceLoaderOptions {
    cwd?: string;
    agentDir?: string;
    settingsManager?: SettingsManager;
    eventBus?: EventBus;
    additionalExtensionPaths?: string[];
    additionalSkillPaths?: string[];
    additionalPromptTemplatePaths?: string[];
    additionalThemePaths?: string[];
    extensionFactories?: ExtensionFactory[];
    noExtensions?: boolean;
    noSkills?: boolean;
    noPromptTemplates?: boolean;
    noThemes?: boolean;
    systemPrompt?: string;
    appendSystemPrompt?: string;
    extensionsOverride?: (base: LoadExtensionsResult) => LoadExtensionsResult;
    skillsOverride?: (base: {
        skills: Skill[];
        diagnostics: ResourceDiagnostic[];
    }) => {
        skills: Skill[];
        diagnostics: ResourceDiagnostic[];
    };
    promptsOverride?: (base: {
        prompts: PromptTemplate[];
        diagnostics: ResourceDiagnostic[];
    }) => {
        prompts: PromptTemplate[];
        diagnostics: ResourceDiagnostic[];
    };
    themesOverride?: (base: {
        themes: Theme[];
        diagnostics: ResourceDiagnostic[];
    }) => {
        themes: Theme[];
        diagnostics: ResourceDiagnostic[];
    };
    agentsFilesOverride?: (base: {
        agentsFiles: Array<{
            path: string;
            content: string;
        }>;
    }) => {
        agentsFiles: Array<{
            path: string;
            content: string;
        }>;
    };
    systemPromptOverride?: (base: string | undefined) => string | undefined;
    appendSystemPromptOverride?: (base: string[]) => string[];
}
export declare class DefaultResourceLoader implements ResourceLoader {
    private cwd;
    private agentDir;
    private settingsManager;
    private eventBus;
    private packageManager;
    private additionalExtensionPaths;
    private additionalSkillPaths;
    private additionalPromptTemplatePaths;
    private additionalThemePaths;
    private extensionFactories;
    private noExtensions;
    private noSkills;
    private noPromptTemplates;
    private noThemes;
    private systemPromptSource?;
    private appendSystemPromptSource?;
    private extensionsOverride?;
    private skillsOverride?;
    private promptsOverride?;
    private themesOverride?;
    private agentsFilesOverride?;
    private systemPromptOverride?;
    private appendSystemPromptOverride?;
    private extensionsResult;
    private skills;
    private skillDiagnostics;
    private prompts;
    private promptDiagnostics;
    private themes;
    private themeDiagnostics;
    private agentsFiles;
    private systemPrompt?;
    private appendSystemPrompt;
    private pathMetadata;
    private lastSkillPaths;
    private lastPromptPaths;
    private lastThemePaths;
    constructor(options: DefaultResourceLoaderOptions);
    getExtensions(): LoadExtensionsResult;
    getSkills(): {
        skills: Skill[];
        diagnostics: ResourceDiagnostic[];
    };
    getPrompts(): {
        prompts: PromptTemplate[];
        diagnostics: ResourceDiagnostic[];
    };
    getThemes(): {
        themes: Theme[];
        diagnostics: ResourceDiagnostic[];
    };
    getAgentsFiles(): {
        agentsFiles: Array<{
            path: string;
            content: string;
        }>;
    };
    getSystemPrompt(): string | undefined;
    getAppendSystemPrompt(): string[];
    getPathMetadata(): Map<string, PathMetadata>;
    extendResources(paths: ResourceExtensionPaths): void;
    reload(): Promise<void>;
    private normalizeExtensionPaths;
    private updateSkillsFromPaths;
    private updatePromptsFromPaths;
    private updateThemesFromPaths;
    private applyExtensionMetadata;
    private mergePaths;
    private resolveResourcePath;
    private loadThemes;
    private loadThemesFromDir;
    private loadThemeFromFile;
    private loadExtensionFactories;
    private dedupePrompts;
    private dedupeThemes;
    private discoverSystemPromptFile;
    private discoverAppendSystemPromptFile;
    private addDefaultMetadataForPath;
    private isUnderPath;
    private detectExtensionConflicts;
}
//# sourceMappingURL=resource-loader.d.ts.map