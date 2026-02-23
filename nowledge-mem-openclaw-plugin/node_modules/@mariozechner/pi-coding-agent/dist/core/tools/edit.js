import { Type } from "@sinclair/typebox";
import { constants } from "fs";
import { access as fsAccess, readFile as fsReadFile, writeFile as fsWriteFile } from "fs/promises";
import { detectLineEnding, fuzzyFindText, generateDiffString, normalizeForFuzzyMatch, normalizeToLF, restoreLineEndings, stripBom, } from "./edit-diff.js";
import { resolveToCwd } from "./path-utils.js";
const editSchema = Type.Object({
    path: Type.String({ description: "Path to the file to edit (relative or absolute)" }),
    oldText: Type.String({ description: "Exact text to find and replace (must match exactly)" }),
    newText: Type.String({ description: "New text to replace the old text with" }),
});
const defaultEditOperations = {
    readFile: (path) => fsReadFile(path),
    writeFile: (path, content) => fsWriteFile(path, content, "utf-8"),
    access: (path) => fsAccess(path, constants.R_OK | constants.W_OK),
};
export function createEditTool(cwd, options) {
    const ops = options?.operations ?? defaultEditOperations;
    return {
        name: "edit",
        label: "edit",
        description: "Edit a file by replacing exact text. The oldText must match exactly (including whitespace). Use this for precise, surgical edits.",
        parameters: editSchema,
        execute: async (_toolCallId, { path, oldText, newText }, signal) => {
            const absolutePath = resolveToCwd(path, cwd);
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
                // Perform the edit operation
                (async () => {
                    try {
                        // Check if file exists
                        try {
                            await ops.access(absolutePath);
                        }
                        catch {
                            if (signal) {
                                signal.removeEventListener("abort", onAbort);
                            }
                            reject(new Error(`File not found: ${path}`));
                            return;
                        }
                        // Check if aborted before reading
                        if (aborted) {
                            return;
                        }
                        // Read the file
                        const buffer = await ops.readFile(absolutePath);
                        const rawContent = buffer.toString("utf-8");
                        // Check if aborted after reading
                        if (aborted) {
                            return;
                        }
                        // Strip BOM before matching (LLM won't include invisible BOM in oldText)
                        const { bom, text: content } = stripBom(rawContent);
                        const originalEnding = detectLineEnding(content);
                        const normalizedContent = normalizeToLF(content);
                        const normalizedOldText = normalizeToLF(oldText);
                        const normalizedNewText = normalizeToLF(newText);
                        // Find the old text using fuzzy matching (tries exact match first, then fuzzy)
                        const matchResult = fuzzyFindText(normalizedContent, normalizedOldText);
                        if (!matchResult.found) {
                            if (signal) {
                                signal.removeEventListener("abort", onAbort);
                            }
                            reject(new Error(`Could not find the exact text in ${path}. The old text must match exactly including all whitespace and newlines.`));
                            return;
                        }
                        // Count occurrences using fuzzy-normalized content for consistency
                        const fuzzyContent = normalizeForFuzzyMatch(normalizedContent);
                        const fuzzyOldText = normalizeForFuzzyMatch(normalizedOldText);
                        const occurrences = fuzzyContent.split(fuzzyOldText).length - 1;
                        if (occurrences > 1) {
                            if (signal) {
                                signal.removeEventListener("abort", onAbort);
                            }
                            reject(new Error(`Found ${occurrences} occurrences of the text in ${path}. The text must be unique. Please provide more context to make it unique.`));
                            return;
                        }
                        // Check if aborted before writing
                        if (aborted) {
                            return;
                        }
                        // Perform replacement using the matched text position
                        // When fuzzy matching was used, contentForReplacement is the normalized version
                        const baseContent = matchResult.contentForReplacement;
                        const newContent = baseContent.substring(0, matchResult.index) +
                            normalizedNewText +
                            baseContent.substring(matchResult.index + matchResult.matchLength);
                        // Verify the replacement actually changed something
                        if (baseContent === newContent) {
                            if (signal) {
                                signal.removeEventListener("abort", onAbort);
                            }
                            reject(new Error(`No changes made to ${path}. The replacement produced identical content. This might indicate an issue with special characters or the text not existing as expected.`));
                            return;
                        }
                        const finalContent = bom + restoreLineEndings(newContent, originalEnding);
                        await ops.writeFile(absolutePath, finalContent);
                        // Check if aborted after writing
                        if (aborted) {
                            return;
                        }
                        // Clean up abort handler
                        if (signal) {
                            signal.removeEventListener("abort", onAbort);
                        }
                        const diffResult = generateDiffString(baseContent, newContent);
                        resolve({
                            content: [
                                {
                                    type: "text",
                                    text: `Successfully replaced text in ${path}.`,
                                },
                            ],
                            details: { diff: diffResult.diff, firstChangedLine: diffResult.firstChangedLine },
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
/** Default edit tool using process.cwd() - for backwards compatibility */
export const editTool = createEditTool(process.cwd());
//# sourceMappingURL=edit.js.map