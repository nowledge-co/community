import { BaseLogger } from "./BaseLogger.js";
export * from "./interfaces.js";
export * from "./BaseLogger.js";
export class Logger extends BaseLogger {
    constructor(settings, logObj) {
        const isBrowser = ![typeof window, typeof document].includes("undefined");
        const isSafari = isBrowser ? /^((?!chrome|android).)*safari/i.test(navigator.userAgent) : false;
        const normalizedSettings = settings ? { ...settings } : {};
        if (isBrowser && normalizedSettings.stylePrettyLogs == null) {
            normalizedSettings.stylePrettyLogs = true;
        }
        super(normalizedSettings, logObj, isSafari ? 4 : 5);
    }
    log(logLevelId, logLevelName, ...args) {
        return super.log(logLevelId, logLevelName, ...args);
    }
    silly(...args) {
        return super.log(0, "SILLY", ...args);
    }
    trace(...args) {
        return super.log(1, "TRACE", ...args);
    }
    debug(...args) {
        return super.log(2, "DEBUG", ...args);
    }
    info(...args) {
        return super.log(3, "INFO", ...args);
    }
    warn(...args) {
        return super.log(4, "WARN", ...args);
    }
    error(...args) {
        return super.log(5, "ERROR", ...args);
    }
    fatal(...args) {
        return super.log(6, "FATAL", ...args);
    }
    getSubLogger(settings, logObj) {
        return super.getSubLogger(settings, logObj);
    }
}
