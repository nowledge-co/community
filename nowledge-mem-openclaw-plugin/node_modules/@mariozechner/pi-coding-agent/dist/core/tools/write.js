import { Type } from "@sinclair/typebox";
import { mkdir as fsMkdir, writeFile as fsWriteFile } from "fs/promises";
import { dirname } from "path";
import { resolveToCwd } from "./path-utils.js";
const writeSchema = Type.Object({
    path: Type.String({ description: "Path to the file to write (relative or absolute)" }),
    content: Type.String({ description: "Content to write to the file" }),
});
const defaultWriteOperations = {
    writeFile: (path, content) => fsWriteFile(path, content, "utf-8"),
    mkdir: (dir) => fsMkdir(dir, { recursive: true }).then(() => { }),
};
export function createWriteTool(cwd, options) {
    const ops = options?.operations ?? defaultWriteOperations;
    return {
        name: "write",
        label: "write",
        description: "Write content to a file. Creates the file if it doesn't exist, overwrites if it does. Automatically creates parent directories.",
        parameters: writeSchema,
        execute: async (_toolCallId, { path, content }, signal) => {
            const absolutePath = resolveToCwd(path, cwd);
            const dir = dirname(absolutePath);
            return new Promise((resolve, reject) => {
                // Check if already aborted
                if (signal?.aborted) {
                    reject(new Error("Operation aborted"));
                    return;
                }
                let aborted = false;
                // Set up abort handler
                const onAbort = () => {
                    aborted = true;
                    reject(new Error("Operation aborted"));
                };
                if (signal) {
                    signal.addEventListener("abort", onAbort, { once: true });
                }
                // Perform the write operation
                (async () => {
                    try {
                        // Create parent directories if needed
                        await ops.mkdir(dir);
                        // Check if aborted before writing
                        if (aborted) {
                            return;
                        }
                        // Write the file
                        await ops.writeFile(absolutePath, content);
                        // Check if aborted after writing
                        if (aborted) {
                            return;
                        }
                        // Clean up abort handler
                        if (signal) {
                            signal.removeEventListener("abort", onAbort);
                        }
                        resolve({
                            content: [{ type: "text", text: `Successfully wrote ${content.length} bytes to ${path}` }],
                            details: undefined,
                        });
                    }
                    catch (error) {
                        // Clean up abort handler
                        if (signal) {
                            signal.removeEventListener("abort", onAbort);
                        }
                        if (!aborted) {
                            reject(error);
                        }
                    }
                })();
            });
        },
    };
}
/** Default write tool using process.cwd() - for backwards compatibility */
export const writeTool = createWriteTool(process.cwd());
//# sourceMappingURL=write.js.map