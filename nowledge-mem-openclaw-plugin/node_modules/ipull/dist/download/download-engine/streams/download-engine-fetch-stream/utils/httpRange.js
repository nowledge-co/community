export function parseHttpContentRange(value) {
    try {
        if (!value)
            return null;
        const parts = value.split(" ")[1].split("/");
        const range = parts[0].split("-");
        const size = parseInt(parts[1]);
        const start = parseInt(range[0]);
        const end = parseInt(range[1]);
        const length = end - start + 1;
        return {
            start,
            end,
            size,
            length
        };
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=httpRange.js.map