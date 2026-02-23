import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { homedir } from "os";
import { basename, isAbsolute, join, resolve, sep } from "path";
import { CONFIG_DIR_NAME, getPromptsDir } from "../config.js";
import { parseFrontmatter } from "../utils/frontmatter.js";
/**
 * Parse command arguments respecting quoted strings (bash-style)
 * Returns array of arguments
 */
export function parseCommandArgs(argsString) {
    const args = [];
    let current = "";
    let inQuote = null;
    for (let i = 0; i < argsString.length; i++) {
        const char = argsString[i];
        if (inQuote) {
            if (char === inQuote) {
                inQuote = null;
            }
            else {
                current += char;
            }
        }
        else if (char === '"' || char === "'") {
            inQuote = char;
        }
        else if (char === " " || char === "\t") {
            if (current) {
                args.push(current);
                current = "";
            }
        }
        else {
            current += char;
        }
    }
    if (current) {
        args.push(current);
    }
    return args;
}
/**
 * Substitute argument placeholders in template content
 * Supports:
 * - $1, $2, ... for positional args
 * - $@ and $ARGUMENTS for all args
 * - ${@:N} for args from Nth onwards (bash-style slicing)
 * - ${@:N:L} for L args starting from Nth
 *
 * Note: Replacement happens on the template string only. Argument values
 * containing patterns like $1, $@, or $ARGUMENTS are NOT recursively substituted.
 */
export function substituteArgs(content, args) {
    let result = content;
    // Replace $1, $2, etc. with positional args FIRST (before wildcards)
    // This prevents wildcard replacement values containing $<digit> patterns from being re-substituted
    result = result.replace(/\$(\d+)/g, (_, num) => {
        const index = parseInt(num, 10) - 1;
        return args[index] ?? "";
    });
    // Replace ${@:start} or ${@:start:length} with sliced args (bash-style)
    // Process BEFORE simple $@ to avoid conflicts
    result = result.replace(/\$\{@:(\d+)(?::(\d+))?\}/g, (_, startStr, lengthStr) => {
        let start = parseInt(startStr, 10) - 1; // Convert to 0-indexed (user provides 1-indexed)
        // Treat 0 as 1 (bash convention: args start at 1)
        if (start < 0)
            start = 0;
        if (lengthStr) {
            const length = parseInt(lengthStr, 10);
            return args.slice(start, start + length).join(" ");
        }
        return args.slice(start).join(" ");
    });
    // Pre-compute all args joined (optimization)
    const allArgs = args.join(" ");
    // Replace $ARGUMENTS with all args joined (new syntax, aligns with Claude, Codex, OpenCode)
    result = result.replace(/\$ARGUMENTS/g, allArgs);
    // Replace $@ with all args joined (existing syntax)
    result = result.replace(/\$@/g, allArgs);
    return result;
}
function loadTemplateFromFile(filePath, source, sourceLabel) {
    try {
        const rawContent = readFileSync(filePath, "utf-8");
        const { frontmatter, body } = parseFrontmatter(rawContent);
        const name = basename(filePath).replace(/\.md$/, "");
        // Get description from frontmatter or first non-empty line
        let description = frontmatter.description || "";
        if (!description) {
            const firstLine = body.split("\n").find((line) => line.trim());
            if (firstLine) {
                // Truncate if too long
                description = firstLine.slice(0, 60);
                if (firstLine.length > 60)
                    description += "...";
            }
        }
        // Append source to description
        description = description ? `${description} ${sourceLabel}` : sourceLabel;
        return {
            name,
            description,
            content: body,
            source,
            filePath,
        };
    }
    catch {
        return null;
    }
}
/**
 * Scan a directory for .md files (non-recursive) and load them as prompt templates.
 */
function loadTemplatesFromDir(dir, source, sourceLabel) {
    const templates = [];
    if (!existsSync(dir)) {
        return templates;
    }
    try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            // For symlinks, check if they point to a file
            let isFile = entry.isFile();
            if (entry.isSymbolicLink()) {
                try {
                    const stats = statSync(fullPath);
                    isFile = stats.isFile();
                }
                catch {
                    // Broken symlink, skip it
                    continue;
                }
            }
            if (isFile && entry.name.endsWith(".md")) {
                const template = loadTemplateFromFile(fullPath, source, sourceLabel);
                if (template) {
                    templates.push(template);
                }
            }
        }
    }
    catch {
        return templates;
    }
    return templates;
}
function normalizePath(input) {
    const trimmed = input.trim();
    if (trimmed === "~")
        return homedir();
    if (trimmed.startsWith("~/"))
        return join(homedir(), trimmed.slice(2));
    if (trimmed.startsWith("~"))
        return join(homedir(), trimmed.slice(1));
    return trimmed;
}
function resolvePromptPath(p, cwd) {
    const normalized = normalizePath(p);
    return isAbsolute(normalized) ? normalized : resolve(cwd, normalized);
}
function buildPathSourceLabel(p) {
    const base = basename(p).replace(/\.md$/, "") || "path";
    return `(path:${base})`;
}
/**
 * Load all prompt templates from:
 * 1. Global: agentDir/prompts/
 * 2. Project: cwd/{CONFIG_DIR_NAME}/prompts/
 * 3. Explicit prompt paths
 */
export function loadPromptTemplates(options = {}) {
    const resolvedCwd = options.cwd ?? process.cwd();
    const resolvedAgentDir = options.agentDir ?? getPromptsDir();
    const promptPaths = options.promptPaths ?? [];
    const includeDefaults = options.includeDefaults ?? true;
    const templates = [];
    if (includeDefaults) {
        // 1. Load global templates from agentDir/prompts/
        // Note: if agentDir is provided, it should be the agent dir, not the prompts dir
        const globalPromptsDir = options.agentDir ? join(options.agentDir, "prompts") : resolvedAgentDir;
        templates.push(...loadTemplatesFromDir(globalPromptsDir, "user", "(user)"));
        // 2. Load project templates from cwd/{CONFIG_DIR_NAME}/prompts/
        const projectPromptsDir = resolve(resolvedCwd, CONFIG_DIR_NAME, "prompts");
        templates.push(...loadTemplatesFromDir(projectPromptsDir, "project", "(project)"));
    }
    const userPromptsDir = options.agentDir ? join(options.agentDir, "prompts") : resolvedAgentDir;
    const projectPromptsDir = resolve(resolvedCwd, CONFIG_DIR_NAME, "prompts");
    const isUnderPath = (target, root) => {
        const normalizedRoot = resolve(root);
        if (target === normalizedRoot) {
            return true;
        }
        const prefix = normalizedRoot.endsWith(sep) ? normalizedRoot : `${normalizedRoot}${sep}`;
        return target.startsWith(prefix);
    };
    const getSourceInfo = (resolvedPath) => {
        if (!includeDefaults) {
            if (isUnderPath(resolvedPath, userPromptsDir)) {
                return { source: "user", label: "(user)" };
            }
            if (isUnderPath(resolvedPath, projectPromptsDir)) {
                return { source: "project", label: "(project)" };
            }
        }
        return { source: "path", label: buildPathSourceLabel(resolvedPath) };
    };
    // 3. Load explicit prompt paths
    for (const rawPath of promptPaths) {
        const resolvedPath = resolvePromptPath(rawPath, resolvedCwd);
        if (!existsSync(resolvedPath)) {
            continue;
        }
        try {
            const stats = statSync(resolvedPath);
            const { source, label } = getSourceInfo(resolvedPath);
            if (stats.isDirectory()) {
                templates.push(...loadTemplatesFromDir(resolvedPath, source, label));
            }
            else if (stats.isFile() && resolvedPath.endsWith(".md")) {
                const template = loadTemplateFromFile(resolvedPath, source, label);
                if (template) {
                    templates.push(template);
                }
            }
        }
        catch {
            // Ignore read failures
        }
    }
    return templates;
}
/**
 * Expand a prompt template if it matches a template name.
 * Returns the expanded content or the original text if not a template.
 */
export function expandPromptTemplate(text, templates) {
    if (!text.startsWith("/"))
        return text;
    const spaceIndex = text.indexOf(" ");
    const templateName = spaceIndex === -1 ? text.slice(1) : text.slice(1, spaceIndex);
    const argsString = spaceIndex === -1 ? "" : text.slice(spaceIndex + 1);
    const template = templates.find((t) => t.name === templateName);
    if (template) {
        const args = parseCommandArgs(argsString);
        return substituteArgs(template.content, args);
    }
    return text;
}
//# sourceMappingURL=prompt-templates.js.map