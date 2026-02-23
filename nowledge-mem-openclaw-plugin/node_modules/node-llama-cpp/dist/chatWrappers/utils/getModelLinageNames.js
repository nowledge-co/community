export function getModelLinageNames(ggufMetadata) {
    const res = [];
    if (ggufMetadata == null)
        return res;
    const currentModelInfo = [ggufMetadata?.general?.name, ggufMetadata?.general?.basename]
        .filter((v) => v != null);
    if (currentModelInfo.length > 0)
        res.push(currentModelInfo);
    if (typeof ggufMetadata?.general?.base_model?.count === "number") {
        for (let i = 0; i < ggufMetadata.general.base_model.count; i++) {
            const baseModel = ggufMetadata.general.base_model[String(i)];
            if (baseModel?.name != null)
                res.push([baseModel.name]);
        }
    }
    return res;
}
//# sourceMappingURL=getModelLinageNames.js.map