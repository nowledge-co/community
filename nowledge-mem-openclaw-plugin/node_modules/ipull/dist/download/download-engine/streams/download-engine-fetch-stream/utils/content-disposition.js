import { parse } from "@tinyhttp/content-disposition";
export function parseContentDisposition(header) {
    if (!header) {
        return undefined;
    }
    try {
        return String(parse(header).parameters.filename || "") || undefined;
    }
    catch { }
    return undefined;
}
//# sourceMappingURL=content-disposition.js.map