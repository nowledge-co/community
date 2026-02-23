import { getIsInDocumentationMode } from "../../state.js";
import { documentationPageUrls } from "../../config.js";
export function withCliCommandDescriptionDocsUrl(description, docsUrl) {
    const isInDocumentationMode = getIsInDocumentationMode();
    if (isInDocumentationMode)
        return description;
    return [
        description,
        docsUrl
    ].join("\n").trim();
}
export function withoutCliCommandDescriptionDocsUrl(description) {
    if (typeof description !== "string")
        return description;
    const lines = description.split("\n");
    if (lines.length > 0 && lines[lines.length - 1].startsWith(documentationPageUrls.CLI.index))
        return lines
            .slice(0, -1)
            .join("\n")
            .trim();
    return description;
}
//# sourceMappingURL=withCliCommandDescriptionDocsUrl.js.map