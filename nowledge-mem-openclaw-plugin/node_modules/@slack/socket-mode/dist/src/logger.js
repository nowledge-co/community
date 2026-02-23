"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogLevel = void 0;
const logger_1 = require("@slack/logger");
Object.defineProperty(exports, "LogLevel", { enumerable: true, get: function () { return logger_1.LogLevel; } });
let instanceCount = 0;
exports.default = {
    getLogger: function getLogger(name, level, existingLogger) {
        // Get a unique ID for the logger.
        const instanceId = instanceCount;
        instanceCount += 1;
        // Set up the logger.
        const logger = (() => {
            if (existingLogger !== undefined) {
                return existingLogger;
            }
            return new logger_1.ConsoleLogger();
        })();
        logger.setName(`socket-mode:${name}:${instanceId}`);
        if (level !== undefined) {
            logger.setLevel(level);
        }
        return logger;
    },
};
//# sourceMappingURL=logger.js.map