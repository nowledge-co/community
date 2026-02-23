export { bashTool, createBashTool, } from "./bash.js";
export { createEditTool, editTool, } from "./edit.js";
export { createFindTool, findTool, } from "./find.js";
export { createGrepTool, grepTool, } from "./grep.js";
export { createLsTool, lsTool, } from "./ls.js";
export { createReadTool, readTool, } from "./read.js";
export { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, formatSize, truncateHead, truncateLine, truncateTail, } from "./truncate.js";
export { createWriteTool, writeTool, } from "./write.js";
import { bashTool, createBashTool } from "./bash.js";
import { createEditTool, editTool } from "./edit.js";
import { createFindTool, findTool } from "./find.js";
import { createGrepTool, grepTool } from "./grep.js";
import { createLsTool, lsTool } from "./ls.js";
import { createReadTool, readTool } from "./read.js";
import { createWriteTool, writeTool } from "./write.js";
// Default tools for full access mode (using process.cwd())
export const codingTools = [readTool, bashTool, editTool, writeTool];
// Read-only tools for exploration without modification (using process.cwd())
export const readOnlyTools = [readTool, grepTool, findTool, lsTool];
// All available tools (using process.cwd())
export const allTools = {
    read: readTool,
    bash: bashTool,
    edit: editTool,
    write: writeTool,
    grep: grepTool,
    find: findTool,
    ls: lsTool,
};
/**
 * Create coding tools configured for a specific working directory.
 */
export function createCodingTools(cwd, options) {
    return [
        createReadTool(cwd, options?.read),
        createBashTool(cwd, options?.bash),
        createEditTool(cwd),
        createWriteTool(cwd),
    ];
}
/**
 * Create read-only tools configured for a specific working directory.
 */
export function createReadOnlyTools(cwd, options) {
    return [createReadTool(cwd, options?.read), createGrepTool(cwd), createFindTool(cwd), createLsTool(cwd)];
}
/**
 * Create all tools configured for a specific working directory.
 */
export function createAllTools(cwd, options) {
    return {
        read: createReadTool(cwd, options?.read),
        bash: createBashTool(cwd, options?.bash),
        edit: createEditTool(cwd),
        write: createWriteTool(cwd),
        grep: createGrepTool(cwd),
        find: createFindTool(cwd),
        ls: createLsTool(cwd),
    };
}
//# sourceMappingURL=index.js.map