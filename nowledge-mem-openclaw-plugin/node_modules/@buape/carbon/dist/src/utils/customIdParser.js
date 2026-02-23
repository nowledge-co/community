export const parseCustomId = (id) => {
    const colonIndex = id.indexOf(":");
    const key = colonIndex === -1 ? id : id.slice(0, colonIndex);
    const rawData = colonIndex === -1 ? "" : id.slice(colonIndex + 1);
    if (!key)
        throw new Error(`Invalid component ID: ${id}`);
    // If there's no data after the key, return empty data object
    if (!rawData) {
        return { key, data: {} };
    }
    return {
        key,
        data: Object.fromEntries(rawData
            .split(";")
            .filter((pair) => pair.length > 0) // Filter out empty pairs
            .map((pair) => {
            const [k, v] = pair.split("=", 2);
            // Handle missing value (no '=' in pair)
            if (v === undefined)
                return [k, k];
            // Handle boolean values
            if (v === "true")
                return [k, true];
            if (v === "false")
                return [k, false];
            // Handle numeric values, but preserve empty strings and numbers that are unsafe to cast to a Number
            if (v === "")
                return [k, ""];
            const numValue = Number(v);
            if (Number.isNaN(numValue))
                return [k, v];
            if (Number.isInteger(numValue) && !Number.isSafeInteger(numValue))
                return [k, v];
            return [k, numValue];
        }))
    };
};
//# sourceMappingURL=customIdParser.js.map