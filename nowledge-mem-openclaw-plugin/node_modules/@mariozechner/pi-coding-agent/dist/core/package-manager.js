import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import ignore from "ignore";
import { minimatch } from "minimatch";
import { CONFIG_DIR_NAME } from "../config.js";
import { parseGitUrl } from "../utils/git.js";
const RESOURCE_TYPES = ["extensions", "skills", "prompts", "themes"];
const FILE_PATTERNS = {
    extensions: /\.(ts|js)$/,
    skills: /\.md$/,
    prompts: /\.md$/,
    themes: /\.json$/,
};
const IGNORE_FILE_NAMES = [".gitignore", ".ignore", ".fdignore"];
function toPosixPath(p) {
    return p.split(sep).join("/");
}
function prefixIgnorePattern(line, prefix) {
    const trimmed = line.trim();
    if (!trimmed)
        return null;
    if (trimmed.startsWith("#") && !trimmed.startsWith("\\#"))
        return null;
    let pattern = line;
    let negated = false;
    if (pattern.startsWith("!")) {
        negated = true;
        pattern = pattern.slice(1);
    }
    else if (pattern.startsWith("\\!")) {
        pattern = pattern.slice(1);
    }
    if (pattern.startsWith("/")) {
        pattern = pattern.slice(1);
    }
    const prefixed = prefix ? `${prefix}${pattern}` : pattern;
    return negated ? `!${prefixed}` : prefixed;
}
function addIgnoreRules(ig, dir, rootDir) {
    const relativeDir = relative(rootDir, dir);
    const prefix = relativeDir ? `${toPosixPath(relativeDir)}/` : "";
    for (const filename of IGNORE_FILE_NAMES) {
        const ignorePath = join(dir, filename);
        if (!existsSync(ignorePath))
            continue;
        try {
            const content = readFileSync(ignorePath, "utf-8");
            const patterns = content
                .split(/\r?\n/)
                .map((line) => prefixIgnorePattern(line, prefix))
                .filter((line) => Boolean(line));
            if (patterns.length > 0) {
                ig.add(patterns);
            }
        }
        catch { }
    }
}
function isPattern(s) {
    return s.startsWith("!") || s.startsWith("+") || s.startsWith("-") || s.includes("*") || s.includes("?");
}
function splitPatterns(entries) {
    const plain = [];
    const patterns = [];
    for (const entry of entries) {
        if (isPattern(entry)) {
            patterns.push(entry);
        }
        else {
            plain.push(entry);
        }
    }
    return { plain, patterns };
}
function collectFiles(dir, filePattern, skipNodeModules = true, ignoreMatcher, rootDir) {
    const files = [];
    if (!existsSync(dir))
        return files;
    const root = rootDir ?? dir;
    const ig = ignoreMatcher ?? ignore();
    addIgnoreRules(ig, dir, root);
    try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name.startsWith("."))
                continue;
            if (skipNodeModules && entry.name === "node_modules")
                continue;
            const fullPath = join(dir, entry.name);
            let isDir = entry.isDirectory();
            let isFile = entry.isFile();
            if (entry.isSymbolicLink()) {
                try {
                    const stats = statSync(fullPath);
                    isDir = stats.isDirectory();
                    isFile = stats.isFile();
                }
                catch {
                    continue;
                }
            }
            const relPath = toPosixPath(relative(root, fullPath));
            const ignorePath = isDir ? `${relPath}/` : relPath;
            if (ig.ignores(ignorePath))
                continue;
            if (isDir) {
                files.push(...collectFiles(fullPath, filePattern, skipNodeModules, ig, root));
            }
            else if (isFile && filePattern.test(entry.name)) {
                files.push(fullPath);
            }
        }
    }
    catch {
        // Ignore errors
    }
    return files;
}
function collectSkillEntries(dir, includeRootFiles = true, ignoreMatcher, rootDir) {
    const entries = [];
    if (!existsSync(dir))
        return entries;
    const root = rootDir ?? dir;
    const ig = ignoreMatcher ?? ignore();
    addIgnoreRules(ig, dir, root);
    try {
        const dirEntries = readdirSync(dir, { withFileTypes: true });
        for (const entry of dirEntries) {
            if (entry.name.startsWith("."))
                continue;
            if (entry.name === "node_modules")
                continue;
            const fullPath = join(dir, entry.name);
            let isDir = entry.isDirectory();
            let isFile = entry.isFile();
            if (entry.isSymbolicLink()) {
                try {
                    const stats = statSync(fullPath);
                    isDir = stats.isDirectory();
                    isFile = stats.isFile();
                }
                catch {
                    continue;
                }
            }
            const relPath = toPosixPath(relative(root, fullPath));
            const ignorePath = isDir ? `${relPath}/` : relPath;
            if (ig.ignores(ignorePath))
                continue;
            if (isDir) {
                entries.push(...collectSkillEntries(fullPath, false, ig, root));
            }
            else if (isFile) {
                const isRootMd = includeRootFiles && entry.name.endsWith(".md");
                const isSkillMd = !includeRootFiles && entry.name === "SKILL.md";
                if (isRootMd || isSkillMd) {
                    entries.push(fullPath);
                }
            }
        }
    }
    catch {
        // Ignore errors
    }
    return entries;
}
function collectAutoSkillEntries(dir, includeRootFiles = true) {
    return collectSkillEntries(dir, includeRootFiles);
}
function findGitRepoRoot(startDir) {
    let dir = resolve(startDir);
    while (true) {
        if (existsSync(join(dir, ".git"))) {
            return dir;
        }
        const parent = dirname(dir);
        if (parent === dir) {
            return null;
        }
        dir = parent;
    }
}
function collectAncestorAgentsSkillDirs(startDir) {
    const skillDirs = [];
    const resolvedStartDir = resolve(startDir);
    const gitRepoRoot = findGitRepoRoot(resolvedStartDir);
    let dir = resolvedStartDir;
    while (true) {
        skillDirs.push(join(dir, ".agents", "skills"));
        if (gitRepoRoot && dir === gitRepoRoot) {
            break;
        }
        const parent = dirname(dir);
        if (parent === dir) {
            break;
        }
        dir = parent;
    }
    return skillDirs;
}
function collectAutoPromptEntries(dir) {
    const entries = [];
    if (!existsSync(dir))
        return entries;
    const ig = ignore();
    addIgnoreRules(ig, dir, dir);
    try {
        const dirEntries = readdirSync(dir, { withFileTypes: true });
        for (const entry of dirEntries) {
            if (entry.name.startsWith("."))
                continue;
            if (entry.name === "node_modules")
                continue;
            const fullPath = join(dir, entry.name);
            let isFile = entry.isFile();
            if (entry.isSymbolicLink()) {
                try {
                    isFile = statSync(fullPath).isFile();
                }
                catch {
                    continue;
                }
            }
            const relPath = toPosixPath(relative(dir, fullPath));
            if (ig.ignores(relPath))
                continue;
            if (isFile && entry.name.endsWith(".md")) {
                entries.push(fullPath);
            }
        }
    }
    catch {
        // Ignore errors
    }
    return entries;
}
function collectAutoThemeEntries(dir) {
    const entries = [];
    if (!existsSync(dir))
        return entries;
    const ig = ignore();
    addIgnoreRules(ig, dir, dir);
    try {
        const dirEntries = readdirSync(dir, { withFileTypes: true });
        for (const entry of dirEntries) {
            if (entry.name.startsWith("."))
                continue;
            if (entry.name === "node_modules")
                continue;
            const fullPath = join(dir, entry.name);
            let isFile = entry.isFile();
            if (entry.isSymbolicLink()) {
                try {
                    isFile = statSync(fullPath).isFile();
                }
                catch {
                    continue;
                }
            }
            const relPath = toPosixPath(relative(dir, fullPath));
            if (ig.ignores(relPath))
                continue;
            if (isFile && entry.name.endsWith(".json")) {
                entries.push(fullPath);
            }
        }
    }
    catch {
        // Ignore errors
    }
    return entries;
}
function readPiManifestFile(packageJsonPath) {
    try {
        const content = readFileSync(packageJsonPath, "utf-8");
        const pkg = JSON.parse(content);
        return pkg.pi ?? null;
    }
    catch {
        return null;
    }
}
function resolveExtensionEntries(dir) {
    const packageJsonPath = join(dir, "package.json");
    if (existsSync(packageJsonPath)) {
        const manifest = readPiManifestFile(packageJsonPath);
        if (manifest?.extensions?.length) {
            const entries = [];
            for (const extPath of manifest.extensions) {
                const resolvedExtPath = resolve(dir, extPath);
                if (existsSync(resolvedExtPath)) {
                    entries.push(resolvedExtPath);
                }
            }
            if (entries.length > 0) {
                return entries;
            }
        }
    }
    const indexTs = join(dir, "index.ts");
    const indexJs = join(dir, "index.js");
    if (existsSync(indexTs)) {
        return [indexTs];
    }
    if (existsSync(indexJs)) {
        return [indexJs];
    }
    return null;
}
function collectAutoExtensionEntries(dir) {
    const entries = [];
    if (!existsSync(dir))
        return entries;
    // First check if this directory itself has explicit extension entries (package.json or index)
    const rootEntries = resolveExtensionEntries(dir);
    if (rootEntries) {
        return rootEntries;
    }
    // Otherwise, discover extensions from directory contents
    const ig = ignore();
    addIgnoreRules(ig, dir, dir);
    try {
        const dirEntries = readdirSync(dir, { withFileTypes: true });
        for (const entry of dirEntries) {
            if (entry.name.startsWith("."))
                continue;
            if (entry.name === "node_modules")
                continue;
            const fullPath = join(dir, entry.name);
            let isDir = entry.isDirectory();
            let isFile = entry.isFile();
            if (entry.isSymbolicLink()) {
                try {
                    const stats = statSync(fullPath);
                    isDir = stats.isDirectory();
                    isFile = stats.isFile();
                }
                catch {
                    continue;
                }
            }
            const relPath = toPosixPath(relative(dir, fullPath));
            const ignorePath = isDir ? `${relPath}/` : relPath;
            if (ig.ignores(ignorePath))
                continue;
            if (isFile && (entry.name.endsWith(".ts") || entry.name.endsWith(".js"))) {
                entries.push(fullPath);
            }
            else if (isDir) {
                const resolvedEntries = resolveExtensionEntries(fullPath);
                if (resolvedEntries) {
                    entries.push(...resolvedEntries);
                }
            }
        }
    }
    catch {
        // Ignore errors
    }
    return entries;
}
/**
 * Collect resource files from a directory based on resource type.
 * Extensions use smart discovery (index.ts in subdirs), others use recursive collection.
 */
function collectResourceFiles(dir, resourceType) {
    if (resourceType === "skills") {
        return collectSkillEntries(dir);
    }
    if (resourceType === "extensions") {
        return collectAutoExtensionEntries(dir);
    }
    return collectFiles(dir, FILE_PATTERNS[resourceType]);
}
function matchesAnyPattern(filePath, patterns, baseDir) {
    const rel = relative(baseDir, filePath);
    const name = basename(filePath);
    const isSkillFile = name === "SKILL.md";
    const parentDir = isSkillFile ? dirname(filePath) : undefined;
    const parentRel = isSkillFile ? relative(baseDir, parentDir) : undefined;
    const parentName = isSkillFile ? basename(parentDir) : undefined;
    return patterns.some((pattern) => {
        if (minimatch(rel, pattern) || minimatch(name, pattern) || minimatch(filePath, pattern)) {
            return true;
        }
        if (!isSkillFile)
            return false;
        return minimatch(parentRel, pattern) || minimatch(parentName, pattern) || minimatch(parentDir, pattern);
    });
}
function normalizeExactPattern(pattern) {
    if (pattern.startsWith("./") || pattern.startsWith(".\\")) {
        return pattern.slice(2);
    }
    return pattern;
}
function matchesAnyExactPattern(filePath, patterns, baseDir) {
    if (patterns.length === 0)
        return false;
    const rel = relative(baseDir, filePath);
    const name = basename(filePath);
    const isSkillFile = name === "SKILL.md";
    const parentDir = isSkillFile ? dirname(filePath) : undefined;
    const parentRel = isSkillFile ? relative(baseDir, parentDir) : undefined;
    return patterns.some((pattern) => {
        const normalized = normalizeExactPattern(pattern);
        if (normalized === rel || normalized === filePath) {
            return true;
        }
        if (!isSkillFile)
            return false;
        return normalized === parentRel || normalized === parentDir;
    });
}
function getOverridePatterns(entries) {
    return entries.filter((pattern) => pattern.startsWith("!") || pattern.startsWith("+") || pattern.startsWith("-"));
}
function isEnabledByOverrides(filePath, patterns, baseDir) {
    const overrides = getOverridePatterns(patterns);
    const excludes = overrides.filter((pattern) => pattern.startsWith("!")).map((pattern) => pattern.slice(1));
    const forceIncludes = overrides.filter((pattern) => pattern.startsWith("+")).map((pattern) => pattern.slice(1));
    const forceExcludes = overrides.filter((pattern) => pattern.startsWith("-")).map((pattern) => pattern.slice(1));
    let enabled = true;
    if (excludes.length > 0 && matchesAnyPattern(filePath, excludes, baseDir)) {
        enabled = false;
    }
    if (forceIncludes.length > 0 && matchesAnyExactPattern(filePath, forceIncludes, baseDir)) {
        enabled = true;
    }
    if (forceExcludes.length > 0 && matchesAnyExactPattern(filePath, forceExcludes, baseDir)) {
        enabled = false;
    }
    return enabled;
}
/**
 * Apply patterns to paths and return a Set of enabled paths.
 * Pattern types:
 * - Plain patterns: include matching paths
 * - `!pattern`: exclude matching paths
 * - `+path`: force-include exact path (overrides exclusions)
 * - `-path`: force-exclude exact path (overrides force-includes)
 */
function applyPatterns(allPaths, patterns, baseDir) {
    const includes = [];
    const excludes = [];
    const forceIncludes = [];
    const forceExcludes = [];
    for (const p of patterns) {
        if (p.startsWith("+")) {
            forceIncludes.push(p.slice(1));
        }
        else if (p.startsWith("-")) {
            forceExcludes.push(p.slice(1));
        }
        else if (p.startsWith("!")) {
            excludes.push(p.slice(1));
        }
        else {
            includes.push(p);
        }
    }
    // Step 1: Apply includes (or all if no includes)
    let result;
    if (includes.length === 0) {
        result = [...allPaths];
    }
    else {
        result = allPaths.filter((filePath) => matchesAnyPattern(filePath, includes, baseDir));
    }
    // Step 2: Apply excludes
    if (excludes.length > 0) {
        result = result.filter((filePath) => !matchesAnyPattern(filePath, excludes, baseDir));
    }
    // Step 3: Force-include (add back from allPaths, overriding exclusions)
    if (forceIncludes.length > 0) {
        for (const filePath of allPaths) {
            if (!result.includes(filePath) && matchesAnyExactPattern(filePath, forceIncludes, baseDir)) {
                result.push(filePath);
            }
        }
    }
    // Step 4: Force-exclude (remove even if included or force-included)
    if (forceExcludes.length > 0) {
        result = result.filter((filePath) => !matchesAnyExactPattern(filePath, forceExcludes, baseDir));
    }
    return new Set(result);
}
export class DefaultPackageManager {
    cwd;
    agentDir;
    settingsManager;
    globalNpmRoot;
    progressCallback;
    constructor(options) {
        this.cwd = options.cwd;
        this.agentDir = options.agentDir;
        this.settingsManager = options.settingsManager;
    }
    setProgressCallback(callback) {
        this.progressCallback = callback;
    }
    addSourceToSettings(source, options) {
        const scope = options?.local ? "project" : "user";
        const currentSettings = scope === "project" ? this.settingsManager.getProjectSettings() : this.settingsManager.getGlobalSettings();
        const currentPackages = currentSettings.packages ?? [];
        const normalizedSource = this.normalizePackageSourceForSettings(source, scope);
        const exists = currentPackages.some((existing) => this.packageSourcesMatch(existing, source, scope));
        if (exists) {
            return false;
        }
        const nextPackages = [...currentPackages, normalizedSource];
        if (scope === "project") {
            this.settingsManager.setProjectPackages(nextPackages);
        }
        else {
            this.settingsManager.setPackages(nextPackages);
        }
        return true;
    }
    removeSourceFromSettings(source, options) {
        const scope = options?.local ? "project" : "user";
        const currentSettings = scope === "project" ? this.settingsManager.getProjectSettings() : this.settingsManager.getGlobalSettings();
        const currentPackages = currentSettings.packages ?? [];
        const nextPackages = currentPackages.filter((existing) => !this.packageSourcesMatch(existing, source, scope));
        const changed = nextPackages.length !== currentPackages.length;
        if (!changed) {
            return false;
        }
        if (scope === "project") {
            this.settingsManager.setProjectPackages(nextPackages);
        }
        else {
            this.settingsManager.setPackages(nextPackages);
        }
        return true;
    }
    getInstalledPath(source, scope) {
        const parsed = this.parseSource(source);
        if (parsed.type === "npm") {
            const path = this.getNpmInstallPath(parsed, scope);
            return existsSync(path) ? path : undefined;
        }
        if (parsed.type === "git") {
            const path = this.getGitInstallPath(parsed, scope);
            return existsSync(path) ? path : undefined;
        }
        if (parsed.type === "local") {
            const baseDir = this.getBaseDirForScope(scope);
            const path = this.resolvePathFromBase(parsed.path, baseDir);
            return existsSync(path) ? path : undefined;
        }
        return undefined;
    }
    emitProgress(event) {
        this.progressCallback?.(event);
    }
    async withProgress(action, source, message, operation) {
        this.emitProgress({ type: "start", action, source, message });
        try {
            await operation();
            this.emitProgress({ type: "complete", action, source });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.emitProgress({ type: "error", action, source, message: errorMessage });
            throw error;
        }
    }
    async resolve(onMissing) {
        const accumulator = this.createAccumulator();
        const globalSettings = this.settingsManager.getGlobalSettings();
        const projectSettings = this.settingsManager.getProjectSettings();
        // Collect all packages with scope
        const allPackages = [];
        for (const pkg of globalSettings.packages ?? []) {
            allPackages.push({ pkg, scope: "user" });
        }
        for (const pkg of projectSettings.packages ?? []) {
            allPackages.push({ pkg, scope: "project" });
        }
        // Dedupe: project scope wins over global for same package identity
        const packageSources = this.dedupePackages(allPackages);
        await this.resolvePackageSources(packageSources, accumulator, onMissing);
        const globalBaseDir = this.agentDir;
        const projectBaseDir = join(this.cwd, CONFIG_DIR_NAME);
        for (const resourceType of RESOURCE_TYPES) {
            const target = this.getTargetMap(accumulator, resourceType);
            const globalEntries = (globalSettings[resourceType] ?? []);
            const projectEntries = (projectSettings[resourceType] ?? []);
            this.resolveLocalEntries(globalEntries, resourceType, target, {
                source: "local",
                scope: "user",
                origin: "top-level",
            }, globalBaseDir);
            this.resolveLocalEntries(projectEntries, resourceType, target, {
                source: "local",
                scope: "project",
                origin: "top-level",
            }, projectBaseDir);
        }
        this.addAutoDiscoveredResources(accumulator, globalSettings, projectSettings, globalBaseDir, projectBaseDir);
        return this.toResolvedPaths(accumulator);
    }
    async resolveExtensionSources(sources, options) {
        const accumulator = this.createAccumulator();
        const scope = options?.temporary ? "temporary" : options?.local ? "project" : "user";
        const packageSources = sources.map((source) => ({ pkg: source, scope }));
        await this.resolvePackageSources(packageSources, accumulator);
        return this.toResolvedPaths(accumulator);
    }
    async install(source, options) {
        const parsed = this.parseSource(source);
        const scope = options?.local ? "project" : "user";
        await this.withProgress("install", source, `Installing ${source}...`, async () => {
            if (parsed.type === "npm") {
                await this.installNpm(parsed, scope, false);
                return;
            }
            if (parsed.type === "git") {
                await this.installGit(parsed, scope);
                return;
            }
            if (parsed.type === "local") {
                const resolved = this.resolvePath(parsed.path);
                if (!existsSync(resolved)) {
                    throw new Error(`Path does not exist: ${resolved}`);
                }
                return;
            }
            throw new Error(`Unsupported install source: ${source}`);
        });
    }
    async remove(source, options) {
        const parsed = this.parseSource(source);
        const scope = options?.local ? "project" : "user";
        await this.withProgress("remove", source, `Removing ${source}...`, async () => {
            if (parsed.type === "npm") {
                await this.uninstallNpm(parsed, scope);
                return;
            }
            if (parsed.type === "git") {
                await this.removeGit(parsed, scope);
                return;
            }
            if (parsed.type === "local") {
                return;
            }
            throw new Error(`Unsupported remove source: ${source}`);
        });
    }
    async update(source) {
        const globalSettings = this.settingsManager.getGlobalSettings();
        const projectSettings = this.settingsManager.getProjectSettings();
        const identity = source ? this.getPackageIdentity(source) : undefined;
        for (const pkg of globalSettings.packages ?? []) {
            const sourceStr = typeof pkg === "string" ? pkg : pkg.source;
            if (identity && this.getPackageIdentity(sourceStr, "user") !== identity)
                continue;
            await this.updateSourceForScope(sourceStr, "user");
        }
        for (const pkg of projectSettings.packages ?? []) {
            const sourceStr = typeof pkg === "string" ? pkg : pkg.source;
            if (identity && this.getPackageIdentity(sourceStr, "project") !== identity)
                continue;
            await this.updateSourceForScope(sourceStr, "project");
        }
    }
    async updateSourceForScope(source, scope) {
        const parsed = this.parseSource(source);
        if (parsed.type === "npm") {
            if (parsed.pinned)
                return;
            await this.withProgress("update", source, `Updating ${source}...`, async () => {
                await this.installNpm(parsed, scope, false);
            });
            return;
        }
        if (parsed.type === "git") {
            if (parsed.pinned)
                return;
            await this.withProgress("update", source, `Updating ${source}...`, async () => {
                await this.updateGit(parsed, scope);
            });
            return;
        }
    }
    async resolvePackageSources(sources, accumulator, onMissing) {
        for (const { pkg, scope } of sources) {
            const sourceStr = typeof pkg === "string" ? pkg : pkg.source;
            const filter = typeof pkg === "object" ? pkg : undefined;
            const parsed = this.parseSource(sourceStr);
            const metadata = { source: sourceStr, scope, origin: "package" };
            if (parsed.type === "local") {
                const baseDir = this.getBaseDirForScope(scope);
                this.resolveLocalExtensionSource(parsed, accumulator, filter, metadata, baseDir);
                continue;
            }
            const installMissing = async () => {
                if (!onMissing) {
                    await this.installParsedSource(parsed, scope);
                    return true;
                }
                const action = await onMissing(sourceStr);
                if (action === "skip")
                    return false;
                if (action === "error")
                    throw new Error(`Missing source: ${sourceStr}`);
                await this.installParsedSource(parsed, scope);
                return true;
            };
            if (parsed.type === "npm") {
                const installedPath = this.getNpmInstallPath(parsed, scope);
                const needsInstall = !existsSync(installedPath) || (await this.npmNeedsUpdate(parsed, installedPath));
                if (needsInstall) {
                    const installed = await installMissing();
                    if (!installed)
                        continue;
                }
                metadata.baseDir = installedPath;
                this.collectPackageResources(installedPath, accumulator, filter, metadata);
                continue;
            }
            if (parsed.type === "git") {
                const installedPath = this.getGitInstallPath(parsed, scope);
                if (!existsSync(installedPath)) {
                    const installed = await installMissing();
                    if (!installed)
                        continue;
                }
                else if (scope === "temporary" && !parsed.pinned) {
                    await this.refreshTemporaryGitSource(parsed, sourceStr);
                }
                metadata.baseDir = installedPath;
                this.collectPackageResources(installedPath, accumulator, filter, metadata);
            }
        }
    }
    resolveLocalExtensionSource(source, accumulator, filter, metadata, baseDir) {
        const resolved = this.resolvePathFromBase(source.path, baseDir);
        if (!existsSync(resolved)) {
            return;
        }
        try {
            const stats = statSync(resolved);
            if (stats.isFile()) {
                metadata.baseDir = dirname(resolved);
                this.addResource(accumulator.extensions, resolved, metadata, true);
                return;
            }
            if (stats.isDirectory()) {
                metadata.baseDir = resolved;
                const resources = this.collectPackageResources(resolved, accumulator, filter, metadata);
                if (!resources) {
                    this.addResource(accumulator.extensions, resolved, metadata, true);
                }
            }
        }
        catch {
            return;
        }
    }
    async installParsedSource(parsed, scope) {
        if (parsed.type === "npm") {
            await this.installNpm(parsed, scope, scope === "temporary");
            return;
        }
        if (parsed.type === "git") {
            await this.installGit(parsed, scope);
            return;
        }
    }
    getPackageSourceString(pkg) {
        return typeof pkg === "string" ? pkg : pkg.source;
    }
    getSourceMatchKeyForInput(source) {
        const parsed = this.parseSource(source);
        if (parsed.type === "npm") {
            return `npm:${parsed.name}`;
        }
        if (parsed.type === "git") {
            return `git:${parsed.host}/${parsed.path}`;
        }
        return `local:${this.resolvePath(parsed.path)}`;
    }
    getSourceMatchKeyForSettings(source, scope) {
        const parsed = this.parseSource(source);
        if (parsed.type === "npm") {
            return `npm:${parsed.name}`;
        }
        if (parsed.type === "git") {
            return `git:${parsed.host}/${parsed.path}`;
        }
        const baseDir = this.getBaseDirForScope(scope);
        return `local:${this.resolvePathFromBase(parsed.path, baseDir)}`;
    }
    packageSourcesMatch(existing, inputSource, scope) {
        const left = this.getSourceMatchKeyForSettings(this.getPackageSourceString(existing), scope);
        const right = this.getSourceMatchKeyForInput(inputSource);
        return left === right;
    }
    normalizePackageSourceForSettings(source, scope) {
        const parsed = this.parseSource(source);
        if (parsed.type !== "local") {
            return source;
        }
        const baseDir = this.getBaseDirForScope(scope);
        const resolved = this.resolvePath(parsed.path);
        const rel = relative(baseDir, resolved);
        return rel || ".";
    }
    parseSource(source) {
        if (source.startsWith("npm:")) {
            const spec = source.slice("npm:".length).trim();
            const { name, version } = this.parseNpmSpec(spec);
            return {
                type: "npm",
                spec,
                name,
                pinned: Boolean(version),
            };
        }
        const trimmed = source.trim();
        const isWindowsAbsolutePath = /^[A-Za-z]:[\\/]|^\\\\/.test(trimmed);
        const isLocalPathLike = trimmed.startsWith(".") ||
            trimmed.startsWith("/") ||
            trimmed === "~" ||
            trimmed.startsWith("~/") ||
            isWindowsAbsolutePath;
        if (isLocalPathLike) {
            return { type: "local", path: source };
        }
        // Try parsing as git URL
        const gitParsed = parseGitUrl(source);
        if (gitParsed) {
            return gitParsed;
        }
        return { type: "local", path: source };
    }
    /**
     * Check if an npm package needs to be updated.
     * - For unpinned packages: check if registry has a newer version
     * - For pinned packages: check if installed version matches the pinned version
     */
    async npmNeedsUpdate(source, installedPath) {
        const installedVersion = this.getInstalledNpmVersion(installedPath);
        if (!installedVersion)
            return true;
        const { version: pinnedVersion } = this.parseNpmSpec(source.spec);
        if (pinnedVersion) {
            // Pinned: check if installed matches pinned (exact match for now)
            return installedVersion !== pinnedVersion;
        }
        // Unpinned: check registry for latest version
        try {
            const latestVersion = await this.getLatestNpmVersion(source.name);
            return latestVersion !== installedVersion;
        }
        catch {
            // If we can't check registry, assume it's fine
            return false;
        }
    }
    getInstalledNpmVersion(installedPath) {
        const packageJsonPath = join(installedPath, "package.json");
        if (!existsSync(packageJsonPath))
            return undefined;
        try {
            const content = readFileSync(packageJsonPath, "utf-8");
            const pkg = JSON.parse(content);
            return pkg.version;
        }
        catch {
            return undefined;
        }
    }
    async getLatestNpmVersion(packageName) {
        const response = await fetch(`https://registry.npmjs.org/${packageName}/latest`);
        if (!response.ok)
            throw new Error(`Failed to fetch npm registry: ${response.status}`);
        const data = (await response.json());
        return data.version;
    }
    /**
     * Get a unique identity for a package, ignoring version/ref.
     * Used to detect when the same package is in both global and project settings.
     * For git packages, uses normalized host/path to ensure SSH and HTTPS URLs
     * for the same repository are treated as identical.
     */
    getPackageIdentity(source, scope) {
        const parsed = this.parseSource(source);
        if (parsed.type === "npm") {
            return `npm:${parsed.name}`;
        }
        if (parsed.type === "git") {
            // Use host/path for identity to normalize SSH and HTTPS
            return `git:${parsed.host}/${parsed.path}`;
        }
        if (scope) {
            const baseDir = this.getBaseDirForScope(scope);
            return `local:${this.resolvePathFromBase(parsed.path, baseDir)}`;
        }
        return `local:${this.resolvePath(parsed.path)}`;
    }
    /**
     * Dedupe packages: if same package identity appears in both global and project,
     * keep only the project one (project wins).
     */
    dedupePackages(packages) {
        const seen = new Map();
        for (const entry of packages) {
            const sourceStr = typeof entry.pkg === "string" ? entry.pkg : entry.pkg.source;
            const identity = this.getPackageIdentity(sourceStr, entry.scope);
            const existing = seen.get(identity);
            if (!existing) {
                seen.set(identity, entry);
            }
            else if (entry.scope === "project" && existing.scope === "user") {
                // Project wins over user
                seen.set(identity, entry);
            }
            // If existing is project and new is global, keep existing (project)
            // If both are same scope, keep first one
        }
        return Array.from(seen.values());
    }
    parseNpmSpec(spec) {
        const match = spec.match(/^(@?[^@]+(?:\/[^@]+)?)(?:@(.+))?$/);
        if (!match) {
            return { name: spec };
        }
        const name = match[1] ?? spec;
        const version = match[2];
        return { name, version };
    }
    async installNpm(source, scope, temporary) {
        if (scope === "user" && !temporary) {
            await this.runCommand("npm", ["install", "-g", source.spec]);
            return;
        }
        const installRoot = this.getNpmInstallRoot(scope, temporary);
        this.ensureNpmProject(installRoot);
        await this.runCommand("npm", ["install", source.spec, "--prefix", installRoot]);
    }
    async uninstallNpm(source, scope) {
        if (scope === "user") {
            await this.runCommand("npm", ["uninstall", "-g", source.name]);
            return;
        }
        const installRoot = this.getNpmInstallRoot(scope, false);
        if (!existsSync(installRoot)) {
            return;
        }
        await this.runCommand("npm", ["uninstall", source.name, "--prefix", installRoot]);
    }
    async installGit(source, scope) {
        const targetDir = this.getGitInstallPath(source, scope);
        if (existsSync(targetDir)) {
            return;
        }
        const gitRoot = this.getGitInstallRoot(scope);
        if (gitRoot) {
            this.ensureGitIgnore(gitRoot);
        }
        mkdirSync(dirname(targetDir), { recursive: true });
        await this.runCommand("git", ["clone", source.repo, targetDir]);
        if (source.ref) {
            await this.runCommand("git", ["checkout", source.ref], { cwd: targetDir });
        }
        const packageJsonPath = join(targetDir, "package.json");
        if (existsSync(packageJsonPath)) {
            await this.runCommand("npm", ["install"], { cwd: targetDir });
        }
    }
    async updateGit(source, scope) {
        const targetDir = this.getGitInstallPath(source, scope);
        if (!existsSync(targetDir)) {
            await this.installGit(source, scope);
            return;
        }
        // Fetch latest from remote (handles force-push by getting new history)
        await this.runCommand("git", ["fetch", "--prune", "origin"], { cwd: targetDir });
        // Reset to tracking branch. Fall back to origin/HEAD when no upstream is configured.
        try {
            await this.runCommand("git", ["reset", "--hard", "@{upstream}"], { cwd: targetDir });
        }
        catch {
            await this.runCommand("git", ["remote", "set-head", "origin", "-a"], { cwd: targetDir }).catch(() => { });
            await this.runCommand("git", ["reset", "--hard", "origin/HEAD"], { cwd: targetDir });
        }
        // Clean untracked files (extensions should be pristine)
        await this.runCommand("git", ["clean", "-fdx"], { cwd: targetDir });
        const packageJsonPath = join(targetDir, "package.json");
        if (existsSync(packageJsonPath)) {
            await this.runCommand("npm", ["install"], { cwd: targetDir });
        }
    }
    async refreshTemporaryGitSource(source, sourceStr) {
        try {
            await this.withProgress("pull", sourceStr, `Refreshing ${sourceStr}...`, async () => {
                await this.updateGit(source, "temporary");
            });
        }
        catch {
            // Keep cached temporary checkout if refresh fails.
        }
    }
    async removeGit(source, scope) {
        const targetDir = this.getGitInstallPath(source, scope);
        if (!existsSync(targetDir))
            return;
        rmSync(targetDir, { recursive: true, force: true });
        this.pruneEmptyGitParents(targetDir, this.getGitInstallRoot(scope));
    }
    pruneEmptyGitParents(targetDir, installRoot) {
        if (!installRoot)
            return;
        const resolvedRoot = resolve(installRoot);
        let current = dirname(targetDir);
        while (current.startsWith(resolvedRoot) && current !== resolvedRoot) {
            if (!existsSync(current)) {
                current = dirname(current);
                continue;
            }
            const entries = readdirSync(current);
            if (entries.length > 0) {
                break;
            }
            try {
                rmSync(current, { recursive: true, force: true });
            }
            catch {
                break;
            }
            current = dirname(current);
        }
    }
    ensureNpmProject(installRoot) {
        if (!existsSync(installRoot)) {
            mkdirSync(installRoot, { recursive: true });
        }
        this.ensureGitIgnore(installRoot);
        const packageJsonPath = join(installRoot, "package.json");
        if (!existsSync(packageJsonPath)) {
            const pkgJson = { name: "pi-extensions", private: true };
            writeFileSync(packageJsonPath, JSON.stringify(pkgJson, null, 2), "utf-8");
        }
    }
    ensureGitIgnore(dir) {
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
        const ignorePath = join(dir, ".gitignore");
        if (!existsSync(ignorePath)) {
            writeFileSync(ignorePath, "*\n!.gitignore\n", "utf-8");
        }
    }
    getNpmInstallRoot(scope, temporary) {
        if (temporary) {
            return this.getTemporaryDir("npm");
        }
        if (scope === "project") {
            return join(this.cwd, CONFIG_DIR_NAME, "npm");
        }
        return join(this.getGlobalNpmRoot(), "..");
    }
    getGlobalNpmRoot() {
        if (this.globalNpmRoot) {
            return this.globalNpmRoot;
        }
        const result = this.runCommandSync("npm", ["root", "-g"]);
        this.globalNpmRoot = result.trim();
        return this.globalNpmRoot;
    }
    getNpmInstallPath(source, scope) {
        if (scope === "temporary") {
            return join(this.getTemporaryDir("npm"), "node_modules", source.name);
        }
        if (scope === "project") {
            return join(this.cwd, CONFIG_DIR_NAME, "npm", "node_modules", source.name);
        }
        return join(this.getGlobalNpmRoot(), source.name);
    }
    getGitInstallPath(source, scope) {
        if (scope === "temporary") {
            return this.getTemporaryDir(`git-${source.host}`, source.path);
        }
        if (scope === "project") {
            return join(this.cwd, CONFIG_DIR_NAME, "git", source.host, source.path);
        }
        return join(this.agentDir, "git", source.host, source.path);
    }
    getGitInstallRoot(scope) {
        if (scope === "temporary") {
            return undefined;
        }
        if (scope === "project") {
            return join(this.cwd, CONFIG_DIR_NAME, "git");
        }
        return join(this.agentDir, "git");
    }
    getTemporaryDir(prefix, suffix) {
        const hash = createHash("sha256")
            .update(`${prefix}-${suffix ?? ""}`)
            .digest("hex")
            .slice(0, 8);
        return join(tmpdir(), "pi-extensions", prefix, hash, suffix ?? "");
    }
    getBaseDirForScope(scope) {
        if (scope === "project") {
            return join(this.cwd, CONFIG_DIR_NAME);
        }
        if (scope === "user") {
            return this.agentDir;
        }
        return this.cwd;
    }
    resolvePath(input) {
        const trimmed = input.trim();
        if (trimmed === "~")
            return homedir();
        if (trimmed.startsWith("~/"))
            return join(homedir(), trimmed.slice(2));
        if (trimmed.startsWith("~"))
            return join(homedir(), trimmed.slice(1));
        return resolve(this.cwd, trimmed);
    }
    resolvePathFromBase(input, baseDir) {
        const trimmed = input.trim();
        if (trimmed === "~")
            return homedir();
        if (trimmed.startsWith("~/"))
            return join(homedir(), trimmed.slice(2));
        if (trimmed.startsWith("~"))
            return join(homedir(), trimmed.slice(1));
        return resolve(baseDir, trimmed);
    }
    collectPackageResources(packageRoot, accumulator, filter, metadata) {
        if (filter) {
            for (const resourceType of RESOURCE_TYPES) {
                const patterns = filter[resourceType];
                const target = this.getTargetMap(accumulator, resourceType);
                if (patterns !== undefined) {
                    this.applyPackageFilter(packageRoot, patterns, resourceType, target, metadata);
                }
                else {
                    this.collectDefaultResources(packageRoot, resourceType, target, metadata);
                }
            }
            return true;
        }
        const manifest = this.readPiManifest(packageRoot);
        if (manifest) {
            for (const resourceType of RESOURCE_TYPES) {
                const entries = manifest[resourceType];
                this.addManifestEntries(entries, packageRoot, resourceType, this.getTargetMap(accumulator, resourceType), metadata);
            }
            return true;
        }
        let hasAnyDir = false;
        for (const resourceType of RESOURCE_TYPES) {
            const dir = join(packageRoot, resourceType);
            if (existsSync(dir)) {
                // Collect all files from the directory (all enabled by default)
                const files = collectResourceFiles(dir, resourceType);
                for (const f of files) {
                    this.addResource(this.getTargetMap(accumulator, resourceType), f, metadata, true);
                }
                hasAnyDir = true;
            }
        }
        return hasAnyDir;
    }
    collectDefaultResources(packageRoot, resourceType, target, metadata) {
        const manifest = this.readPiManifest(packageRoot);
        const entries = manifest?.[resourceType];
        if (entries) {
            this.addManifestEntries(entries, packageRoot, resourceType, target, metadata);
            return;
        }
        const dir = join(packageRoot, resourceType);
        if (existsSync(dir)) {
            // Collect all files from the directory (all enabled by default)
            const files = collectResourceFiles(dir, resourceType);
            for (const f of files) {
                this.addResource(target, f, metadata, true);
            }
        }
    }
    applyPackageFilter(packageRoot, userPatterns, resourceType, target, metadata) {
        const { allFiles } = this.collectManifestFiles(packageRoot, resourceType);
        if (userPatterns.length === 0) {
            // Empty array explicitly disables all resources of this type
            for (const f of allFiles) {
                this.addResource(target, f, metadata, false);
            }
            return;
        }
        // Apply user patterns
        const enabledByUser = applyPatterns(allFiles, userPatterns, packageRoot);
        for (const f of allFiles) {
            const enabled = enabledByUser.has(f);
            this.addResource(target, f, metadata, enabled);
        }
    }
    /**
     * Collect all files from a package for a resource type, applying manifest patterns.
     * Returns { allFiles, enabledByManifest } where enabledByManifest is the set of files
     * that pass the manifest's own patterns.
     */
    collectManifestFiles(packageRoot, resourceType) {
        const manifest = this.readPiManifest(packageRoot);
        const entries = manifest?.[resourceType];
        if (entries && entries.length > 0) {
            const allFiles = this.collectFilesFromManifestEntries(entries, packageRoot, resourceType);
            const manifestPatterns = entries.filter(isPattern);
            const enabledByManifest = manifestPatterns.length > 0 ? applyPatterns(allFiles, manifestPatterns, packageRoot) : new Set(allFiles);
            return { allFiles: Array.from(enabledByManifest), enabledByManifest };
        }
        const conventionDir = join(packageRoot, resourceType);
        if (!existsSync(conventionDir)) {
            return { allFiles: [], enabledByManifest: new Set() };
        }
        const allFiles = collectResourceFiles(conventionDir, resourceType);
        return { allFiles, enabledByManifest: new Set(allFiles) };
    }
    readPiManifest(packageRoot) {
        const packageJsonPath = join(packageRoot, "package.json");
        if (!existsSync(packageJsonPath)) {
            return null;
        }
        try {
            const content = readFileSync(packageJsonPath, "utf-8");
            const pkg = JSON.parse(content);
            return pkg.pi ?? null;
        }
        catch {
            return null;
        }
    }
    addManifestEntries(entries, root, resourceType, target, metadata) {
        if (!entries)
            return;
        const allFiles = this.collectFilesFromManifestEntries(entries, root, resourceType);
        const patterns = entries.filter(isPattern);
        const enabledPaths = applyPatterns(allFiles, patterns, root);
        for (const f of allFiles) {
            if (enabledPaths.has(f)) {
                this.addResource(target, f, metadata, true);
            }
        }
    }
    collectFilesFromManifestEntries(entries, root, resourceType) {
        const plain = entries.filter((entry) => !isPattern(entry));
        const resolved = plain.map((entry) => resolve(root, entry));
        return this.collectFilesFromPaths(resolved, resourceType);
    }
    resolveLocalEntries(entries, resourceType, target, metadata, baseDir) {
        if (entries.length === 0)
            return;
        // Collect all files from plain entries (non-pattern entries)
        const { plain, patterns } = splitPatterns(entries);
        const resolvedPlain = plain.map((p) => this.resolvePathFromBase(p, baseDir));
        const allFiles = this.collectFilesFromPaths(resolvedPlain, resourceType);
        // Determine which files are enabled based on patterns
        const enabledPaths = applyPatterns(allFiles, patterns, baseDir);
        // Add all files with their enabled state
        for (const f of allFiles) {
            this.addResource(target, f, metadata, enabledPaths.has(f));
        }
    }
    addAutoDiscoveredResources(accumulator, globalSettings, projectSettings, globalBaseDir, projectBaseDir) {
        const userMetadata = {
            source: "auto",
            scope: "user",
            origin: "top-level",
            baseDir: globalBaseDir,
        };
        const projectMetadata = {
            source: "auto",
            scope: "project",
            origin: "top-level",
            baseDir: projectBaseDir,
        };
        const userOverrides = {
            extensions: (globalSettings.extensions ?? []),
            skills: (globalSettings.skills ?? []),
            prompts: (globalSettings.prompts ?? []),
            themes: (globalSettings.themes ?? []),
        };
        const projectOverrides = {
            extensions: (projectSettings.extensions ?? []),
            skills: (projectSettings.skills ?? []),
            prompts: (projectSettings.prompts ?? []),
            themes: (projectSettings.themes ?? []),
        };
        const userDirs = {
            extensions: join(globalBaseDir, "extensions"),
            skills: join(globalBaseDir, "skills"),
            prompts: join(globalBaseDir, "prompts"),
            themes: join(globalBaseDir, "themes"),
        };
        const projectDirs = {
            extensions: join(projectBaseDir, "extensions"),
            skills: join(projectBaseDir, "skills"),
            prompts: join(projectBaseDir, "prompts"),
            themes: join(projectBaseDir, "themes"),
        };
        const userAgentsSkillsDir = join(homedir(), ".agents", "skills");
        const projectAgentsSkillDirs = collectAncestorAgentsSkillDirs(this.cwd);
        const addResources = (resourceType, paths, metadata, overrides, baseDir) => {
            const target = this.getTargetMap(accumulator, resourceType);
            for (const path of paths) {
                const enabled = isEnabledByOverrides(path, overrides, baseDir);
                this.addResource(target, path, metadata, enabled);
            }
        };
        addResources("extensions", collectAutoExtensionEntries(userDirs.extensions), userMetadata, userOverrides.extensions, globalBaseDir);
        addResources("skills", [...collectAutoSkillEntries(userDirs.skills), ...collectAutoSkillEntries(userAgentsSkillsDir)], userMetadata, userOverrides.skills, globalBaseDir);
        addResources("prompts", collectAutoPromptEntries(userDirs.prompts), userMetadata, userOverrides.prompts, globalBaseDir);
        addResources("themes", collectAutoThemeEntries(userDirs.themes), userMetadata, userOverrides.themes, globalBaseDir);
        addResources("extensions", collectAutoExtensionEntries(projectDirs.extensions), projectMetadata, projectOverrides.extensions, projectBaseDir);
        addResources("skills", [
            ...collectAutoSkillEntries(projectDirs.skills),
            ...projectAgentsSkillDirs.flatMap((dir) => collectAutoSkillEntries(dir)),
        ], projectMetadata, projectOverrides.skills, projectBaseDir);
        addResources("prompts", collectAutoPromptEntries(projectDirs.prompts), projectMetadata, projectOverrides.prompts, projectBaseDir);
        addResources("themes", collectAutoThemeEntries(projectDirs.themes), projectMetadata, projectOverrides.themes, projectBaseDir);
    }
    collectFilesFromPaths(paths, resourceType) {
        const files = [];
        for (const p of paths) {
            if (!existsSync(p))
                continue;
            try {
                const stats = statSync(p);
                if (stats.isFile()) {
                    files.push(p);
                }
                else if (stats.isDirectory()) {
                    files.push(...collectResourceFiles(p, resourceType));
                }
            }
            catch {
                // Ignore errors
            }
        }
        return files;
    }
    getTargetMap(accumulator, resourceType) {
        switch (resourceType) {
            case "extensions":
                return accumulator.extensions;
            case "skills":
                return accumulator.skills;
            case "prompts":
                return accumulator.prompts;
            case "themes":
                return accumulator.themes;
            default:
                throw new Error(`Unknown resource type: ${resourceType}`);
        }
    }
    addResource(map, path, metadata, enabled) {
        if (!path)
            return;
        if (!map.has(path)) {
            map.set(path, { metadata, enabled });
        }
    }
    createAccumulator() {
        return {
            extensions: new Map(),
            skills: new Map(),
            prompts: new Map(),
            themes: new Map(),
        };
    }
    toResolvedPaths(accumulator) {
        const toResolved = (entries) => {
            return Array.from(entries.entries()).map(([path, { metadata, enabled }]) => ({
                path,
                enabled,
                metadata,
            }));
        };
        return {
            extensions: toResolved(accumulator.extensions),
            skills: toResolved(accumulator.skills),
            prompts: toResolved(accumulator.prompts),
            themes: toResolved(accumulator.themes),
        };
    }
    runCommand(command, args, options) {
        return new Promise((resolvePromise, reject) => {
            const child = spawn(command, args, {
                cwd: options?.cwd,
                stdio: "inherit",
                shell: process.platform === "win32",
            });
            child.on("error", reject);
            child.on("exit", (code) => {
                if (code === 0) {
                    resolvePromise();
                }
                else {
                    reject(new Error(`${command} ${args.join(" ")} failed with code ${code}`));
                }
            });
        });
    }
    runCommandSync(command, args) {
        const result = spawnSync(command, args, {
            stdio: ["ignore", "pipe", "pipe"],
            encoding: "utf-8",
            shell: process.platform === "win32",
        });
        if (result.status !== 0) {
            throw new Error(`Failed to run ${command} ${args.join(" ")}: ${result.stderr || result.stdout}`);
        }
        return (result.stdout || result.stderr || "").trim();
    }
}
//# sourceMappingURL=package-manager.js.map