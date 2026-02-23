import { createRequire } from "module";
const require = createRequire(import.meta.url);
let clipboard = null;
const hasDisplay = process.platform !== "linux" || Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
if (!process.env.TERMUX_VERSION && hasDisplay) {
    try {
        clipboard = require("@mariozechner/clipboard");
    }
    catch {
        clipboard = null;
    }
}
export { clipboard };
//# sourceMappingURL=clipboard-native.js.map