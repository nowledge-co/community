export function removeNullFields(obj) {
    const newObj = Object.assign({}, obj);
    for (const key in obj) {
        if (newObj[key] == null)
            delete newObj[key];
    }
    return newObj;
}
export function removeUndefinedFields(obj) {
    const newObj = Object.assign({}, obj);
    for (const key in obj) {
        if (newObj[key] === undefined)
            delete newObj[key];
    }
    return newObj;
}
//# sourceMappingURL=removeNullFields.js.map