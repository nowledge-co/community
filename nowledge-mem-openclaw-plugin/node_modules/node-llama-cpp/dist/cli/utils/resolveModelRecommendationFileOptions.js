import { resolveModelDestination } from "../../utils/resolveModelDestination.js";
export function resolveModelRecommendationFileOptions(modelRecommendation) {
    return modelRecommendation.fileOptions.map((fileOption) => {
        const resolvedModelDestination = resolveModelDestination(fileOption, true);
        if (resolvedModelDestination.type === "file")
            throw new Error(`File option "${fileOption}" is not a valid model URI`);
        if (resolvedModelDestination.type === "uri")
            return resolvedModelDestination.uri;
        return resolvedModelDestination.url;
    });
}
//# sourceMappingURL=resolveModelRecommendationFileOptions.js.map