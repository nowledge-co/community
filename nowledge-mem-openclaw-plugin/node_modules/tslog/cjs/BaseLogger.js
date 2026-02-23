"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseLogger = exports.loggerEnvironment = void 0;
exports.createLoggerEnvironment = createLoggerEnvironment;
const urlToObj_js_1 = require("./urlToObj.js");
const metaFormatting_js_1 = require("./internal/metaFormatting.js");
const errorUtils_js_1 = require("./internal/errorUtils.js");
const formatTemplate_js_1 = require("./formatTemplate.js");
const util_inspect_polyfill_js_1 = require("./internal/util.inspect.polyfill.js");
const stackTrace_js_1 = require("./internal/stackTrace.js");
const environment_js_1 = require("./internal/environment.js");
const jsonStringifyRecursive_js_1 = require("./internal/jsonStringifyRecursive.js");
function createLoggerEnvironment() {
    const runtimeInfo = detectRuntimeInfo();
    const meta = createRuntimeMeta(runtimeInfo);
    const usesBrowserStack = runtimeInfo.name === "browser" || runtimeInfo.name === "worker";
    const callerIgnorePatterns = usesBrowserStack
        ? [...(0, stackTrace_js_1.getDefaultIgnorePatterns)(), /node_modules[\\/].*tslog/i]
        : [...(0, stackTrace_js_1.getDefaultIgnorePatterns)(), /node:(?:internal|vm)/i, /\binternal[\\/]/i];
    let cachedCwd;
    const environment = {
        getMeta(logLevelId, logLevelName, stackDepthLevel, hideLogPositionForPerformance, name, parentNames) {
            return Object.assign({}, meta, {
                name,
                parentNames,
                date: new Date(),
                logLevelId,
                logLevelName,
                path: !hideLogPositionForPerformance ? environment.getCallerStackFrame(stackDepthLevel) : undefined,
            });
        },
        getCallerStackFrame(stackDepthLevel, error = new Error()) {
            const frames = (0, stackTrace_js_1.buildStackTrace)(error, (line) => parseStackLine(line));
            if (frames.length === 0) {
                return {};
            }
            const autoIndex = (0, stackTrace_js_1.findFirstExternalFrameIndex)(frames, callerIgnorePatterns);
            const useManualIndex = Number.isFinite(stackDepthLevel) && stackDepthLevel >= 0;
            const resolvedIndex = useManualIndex ? (0, stackTrace_js_1.clampIndex)(stackDepthLevel, frames.length) : (0, stackTrace_js_1.clampIndex)(autoIndex, frames.length);
            return frames[resolvedIndex] ?? {};
        },
        getErrorTrace(error) {
            return (0, stackTrace_js_1.buildStackTrace)(error, (line) => parseStackLine(line));
        },
        isError(value) {
            return isNativeError(value);
        },
        isBuffer(value) {
            return typeof Buffer !== "undefined" && typeof Buffer.isBuffer === "function" ? Buffer.isBuffer(value) : false;
        },
        prettyFormatLogObj(maskedArgs, settings) {
            return maskedArgs.reduce((result, arg) => {
                if (environment.isError(arg)) {
                    result.errors.push(environment.prettyFormatErrorObj(arg, settings));
                }
                else {
                    result.args.push(arg);
                }
                return result;
            }, { args: [], errors: [] });
        },
        prettyFormatErrorObj(error, settings) {
            const stackLines = formatStackFrames(environment.getErrorTrace(error), settings);
            const causeSections = (0, errorUtils_js_1.collectErrorCauses)(error).map((cause, index) => {
                const header = `Caused by (${index + 1}): ${cause.name ?? "Error"}${cause.message ? `: ${cause.message}` : ""}`;
                const frames = formatStackFrames((0, stackTrace_js_1.buildStackTrace)(cause, (line) => parseStackLine(line)), settings);
                return [header, ...frames].join("\n");
            });
            const placeholderValuesError = {
                errorName: ` ${error.name} `,
                errorMessage: formatErrorMessage(error),
                errorStack: [...stackLines, ...causeSections].join("\n"),
            };
            return (0, formatTemplate_js_1.formatTemplate)(settings, settings.prettyErrorTemplate, placeholderValuesError);
        },
        transportFormatted(logMetaMarkup, logArgs, logErrors, logMeta, settings) {
            const prettyLogs = settings.stylePrettyLogs !== false;
            const logErrorsStr = (logErrors.length > 0 && logArgs.length > 0 ? "\n" : "") + logErrors.join("\n");
            const sanitizedMetaMarkup = stripAnsi(logMetaMarkup);
            const metaMarkupForText = prettyLogs ? logMetaMarkup : sanitizedMetaMarkup;
            if (shouldUseCss(prettyLogs)) {
                settings.prettyInspectOptions.colors = false;
                const formattedArgs = formatWithOptionsSafe(settings.prettyInspectOptions, logArgs);
                const cssMeta = logMeta != null ? buildCssMetaOutput(settings, logMeta) : { text: sanitizedMetaMarkup, styles: [] };
                const hasCssMeta = cssMeta.text.length > 0 && cssMeta.styles.length > 0;
                const metaOutput = hasCssMeta ? cssMeta.text : sanitizedMetaMarkup;
                const output = metaOutput + formattedArgs + logErrorsStr;
                if (hasCssMeta) {
                    console.log(output, ...cssMeta.styles);
                }
                else {
                    console.log(output);
                }
                return;
            }
            settings.prettyInspectOptions.colors = prettyLogs;
            const formattedArgs = formatWithOptionsSafe(settings.prettyInspectOptions, logArgs);
            console.log(metaMarkupForText + formattedArgs + logErrorsStr);
        },
        transportJSON(json) {
            console.log((0, jsonStringifyRecursive_js_1.jsonStringifyRecursive)(json));
        },
    };
    if (getNodeEnv() === "test") {
        environment.__resetWorkingDirectoryCacheForTests = () => {
            cachedCwd = undefined;
        };
    }
    return environment;
    function parseStackLine(line) {
        return usesBrowserStack ? parseBrowserStackLine(line) : parseServerStackLine(line);
    }
    function parseServerStackLine(rawLine) {
        if (typeof rawLine !== "string" || rawLine.length === 0) {
            return undefined;
        }
        const trimmedLine = rawLine.trim();
        if (!trimmedLine.includes(" at ") && !trimmedLine.startsWith("at ")) {
            return undefined;
        }
        const line = trimmedLine.replace(/^at\s+/, "");
        let method;
        let location = line;
        const methodMatch = line.match(/^(.*?)\s+\((.*)\)$/);
        if (methodMatch) {
            method = methodMatch[1];
            location = methodMatch[2];
        }
        const sanitizedLocation = location.replace(/^\(/, "").replace(/\)$/, "");
        const withoutQuery = sanitizedLocation.replace(/\?.*$/, "");
        let fileLine;
        let fileColumn;
        let filePathCandidate = withoutQuery;
        const segments = withoutQuery.split(":");
        if (segments.length >= 3 && /^\d+$/.test(segments[segments.length - 1] ?? "")) {
            fileColumn = segments.pop();
            fileLine = segments.pop();
            filePathCandidate = segments.join(":");
        }
        else if (segments.length >= 2 && /^\d+$/.test(segments[segments.length - 1] ?? "")) {
            fileLine = segments.pop();
            filePathCandidate = segments.join(":");
        }
        let normalizedPath = filePathCandidate.replace(/^file:\/\//, "");
        const cwd = getWorkingDirectory();
        if (cwd != null && normalizedPath.startsWith(cwd)) {
            normalizedPath = normalizedPath.slice(cwd.length);
            normalizedPath = normalizedPath.replace(/^[\\/]/, "");
        }
        if (normalizedPath.length === 0) {
            normalizedPath = filePathCandidate;
        }
        const normalizedPathWithoutLine = normalizeFilePath(normalizedPath);
        const effectivePath = normalizedPathWithoutLine.length > 0 ? normalizedPathWithoutLine : normalizedPath;
        const pathSegments = effectivePath.split(/\\|\//);
        const fileName = pathSegments[pathSegments.length - 1];
        const fileNameWithLine = fileName && fileLine ? `${fileName}:${fileLine}` : undefined;
        const filePathWithLine = effectivePath && fileLine ? `${effectivePath}:${fileLine}` : undefined;
        return {
            fullFilePath: sanitizedLocation,
            fileName,
            fileNameWithLine,
            fileColumn,
            fileLine,
            filePath: effectivePath,
            filePathWithLine,
            method,
        };
    }
    function parseBrowserStackLine(line) {
        const href = globalThis.location?.origin;
        if (line == null) {
            return undefined;
        }
        const match = line.match(BROWSER_PATH_REGEX);
        if (!match) {
            return undefined;
        }
        const filePath = match[1]?.replace(/\?.*$/, "");
        if (filePath == null) {
            return undefined;
        }
        const pathParts = filePath.split("/");
        const fileLine = match[2];
        const fileColumn = match[3];
        const fileName = pathParts[pathParts.length - 1];
        return {
            fullFilePath: href ? `${href}${filePath}` : filePath,
            fileName,
            fileNameWithLine: fileName && fileLine ? `${fileName}:${fileLine}` : undefined,
            fileColumn,
            fileLine,
            filePath,
            filePathWithLine: fileLine ? `${filePath}:${fileLine}` : undefined,
            method: undefined,
        };
    }
    function formatStackFrames(frames, settings) {
        return frames.map((stackFrame) => (0, formatTemplate_js_1.formatTemplate)(settings, settings.prettyErrorStackTemplate, { ...stackFrame }, true));
    }
    function formatErrorMessage(error) {
        return Object.getOwnPropertyNames(error)
            .filter((key) => key !== "stack" && key !== "cause")
            .reduce((result, key) => {
            const value = error[key];
            if (typeof value === "function") {
                return result;
            }
            result.push(String(value));
            return result;
        }, [])
            .join(", ");
    }
    function shouldUseCss(prettyLogs) {
        return prettyLogs && (runtimeInfo.name === "browser" || runtimeInfo.name === "worker") && (0, environment_js_1.consoleSupportsCssStyling)();
    }
    function stripAnsi(value) {
        return value.replace(ANSI_REGEX, "");
    }
    function buildCssMetaOutput(settings, metaValue) {
        if (metaValue == null) {
            return { text: "", styles: [] };
        }
        const { template, placeholders } = (0, metaFormatting_js_1.buildPrettyMeta)(settings, metaValue);
        const parts = [];
        const styles = [];
        let lastIndex = 0;
        const placeholderRegex = /{{(.+?)}}/g;
        let match;
        while ((match = placeholderRegex.exec(template)) != null) {
            if (match.index > lastIndex) {
                parts.push(template.slice(lastIndex, match.index));
            }
            const key = match[1];
            const rawValue = placeholders[key] != null ? String(placeholders[key]) : "";
            const tokens = collectStyleTokens(settings.prettyLogStyles?.[key], rawValue);
            const css = tokensToCss(tokens);
            if (css.length > 0) {
                parts.push(`%c${rawValue}%c`);
                styles.push(css, "");
            }
            else {
                parts.push(rawValue);
            }
            lastIndex = placeholderRegex.lastIndex;
        }
        if (lastIndex < template.length) {
            parts.push(template.slice(lastIndex));
        }
        return {
            text: parts.join(""),
            styles,
        };
    }
    function collectStyleTokens(style, value) {
        if (style == null) {
            return [];
        }
        if (typeof style === "string") {
            return [style];
        }
        if (Array.isArray(style)) {
            return style.flatMap((token) => collectStyleTokens(token, value));
        }
        if (typeof style === "object") {
            const normalizedValue = value.trim();
            const nextStyle = style[normalizedValue] ?? style["*"];
            if (nextStyle == null) {
                return [];
            }
            return collectStyleTokens(nextStyle, value);
        }
        return [];
    }
    function tokensToCss(tokens) {
        const seen = new Set();
        const cssParts = [];
        for (const token of tokens) {
            const css = styleTokenToCss(token);
            if (css != null && css.length > 0 && !seen.has(css)) {
                seen.add(css);
                cssParts.push(css);
            }
        }
        return cssParts.join("; ");
    }
    function styleTokenToCss(token) {
        const color = COLOR_TOKENS[token];
        if (color != null) {
            return `color: ${color}`;
        }
        const background = BACKGROUND_TOKENS[token];
        if (background != null) {
            return `background-color: ${background}`;
        }
        switch (token) {
            case "bold":
                return "font-weight: bold";
            case "dim":
                return "opacity: 0.75";
            case "italic":
                return "font-style: italic";
            case "underline":
                return "text-decoration: underline";
            case "overline":
                return "text-decoration: overline";
            case "inverse":
                return "filter: invert(1)";
            case "hidden":
                return "visibility: hidden";
            case "strikethrough":
                return "text-decoration: line-through";
            default:
                return undefined;
        }
    }
    function getWorkingDirectory() {
        if (cachedCwd === undefined) {
            cachedCwd = (0, environment_js_1.safeGetCwd)() ?? null;
        }
        return cachedCwd ?? undefined;
    }
    function shouldCaptureHostname() {
        return runtimeInfo.name === "node" || runtimeInfo.name === "deno" || runtimeInfo.name === "bun";
    }
    function shouldCaptureRuntimeVersion() {
        return runtimeInfo.name === "node" || runtimeInfo.name === "deno" || runtimeInfo.name === "bun";
    }
    function createRuntimeMeta(info) {
        if (info.name === "browser" || info.name === "worker") {
            return {
                runtime: info.name,
                browser: info.userAgent,
            };
        }
        const metaStatic = {
            runtime: info.name,
        };
        if (shouldCaptureRuntimeVersion()) {
            metaStatic.runtimeVersion = info.version ?? "unknown";
        }
        if (shouldCaptureHostname()) {
            metaStatic.hostname = info.hostname ?? "unknown";
        }
        return metaStatic;
    }
    function formatWithOptionsSafe(options, args) {
        try {
            return (0, util_inspect_polyfill_js_1.formatWithOptions)(options, ...args);
        }
        catch {
            return args.map(stringifyFallback).join(" ");
        }
    }
    function stringifyFallback(value) {
        if (typeof value === "string") {
            return value;
        }
        try {
            return JSON.stringify(value);
        }
        catch {
            return String(value);
        }
    }
    function normalizeFilePath(value) {
        if (typeof value !== "string" || value.length === 0) {
            return value;
        }
        const replaced = value.replace(/\\+/g, "\\").replace(/\\/g, "/");
        const hasRootDoubleSlash = replaced.startsWith("//");
        const hasLeadingSlash = replaced.startsWith("/") && !hasRootDoubleSlash;
        const driveMatch = replaced.match(/^[A-Za-z]:/);
        const drivePrefix = driveMatch ? driveMatch[0] : "";
        const withoutDrive = drivePrefix ? replaced.slice(drivePrefix.length) : replaced;
        const segments = withoutDrive.split("/");
        const normalizedSegments = [];
        for (const segment of segments) {
            if (segment === "" || segment === ".") {
                continue;
            }
            if (segment === "..") {
                if (normalizedSegments.length > 0) {
                    normalizedSegments.pop();
                }
                continue;
            }
            normalizedSegments.push(segment);
        }
        let normalized = normalizedSegments.join("/");
        if (hasRootDoubleSlash) {
            normalized = `//${normalized}`;
        }
        else if (hasLeadingSlash) {
            normalized = `/${normalized}`;
        }
        else if (drivePrefix !== "") {
            normalized = `${drivePrefix}${normalized.length > 0 ? `/${normalized}` : ""}`;
        }
        if (normalized.length === 0) {
            return value;
        }
        return normalized;
    }
    function detectRuntimeInfo() {
        if ((0, environment_js_1.isBrowserEnvironment)()) {
            const navigatorObj = globalThis.navigator;
            return {
                name: "browser",
                userAgent: navigatorObj?.userAgent,
            };
        }
        const globalScope = globalThis;
        if (typeof globalScope.importScripts === "function") {
            return {
                name: "worker",
                userAgent: globalScope.navigator?.userAgent,
            };
        }
        const globalAny = globalThis;
        if (globalAny.Bun != null) {
            const bunVersion = globalAny.Bun.version;
            return {
                name: "bun",
                version: bunVersion != null ? `bun/${bunVersion}` : undefined,
                hostname: getEnvironmentHostname(globalAny.process, globalAny.Deno, globalAny.Bun, globalAny.location),
            };
        }
        if (globalAny.Deno != null) {
            const denoHostname = resolveDenoHostname(globalAny.Deno);
            const denoVersion = globalAny.Deno?.version?.deno;
            return {
                name: "deno",
                version: denoVersion != null ? `deno/${denoVersion}` : undefined,
                hostname: denoHostname ?? getEnvironmentHostname(globalAny.process, globalAny.Deno, globalAny.Bun, globalAny.location),
            };
        }
        if (globalAny.process?.versions?.node != null || globalAny.process?.version != null) {
            return {
                name: "node",
                version: globalAny.process?.versions?.node ?? globalAny.process?.version,
                hostname: getEnvironmentHostname(globalAny.process, globalAny.Deno, globalAny.Bun, globalAny.location),
            };
        }
        if (globalAny.process != null) {
            return {
                name: "node",
                version: "unknown",
                hostname: getEnvironmentHostname(globalAny.process, globalAny.Deno, globalAny.Bun, globalAny.location),
            };
        }
        return {
            name: "unknown",
        };
    }
    function getEnvironmentHostname(nodeProcess, deno, bun, location) {
        const processHostname = nodeProcess?.env?.HOSTNAME ?? nodeProcess?.env?.HOST ?? nodeProcess?.env?.COMPUTERNAME;
        if (processHostname != null && processHostname.length > 0) {
            return processHostname;
        }
        const bunHostname = bun?.env?.HOSTNAME ?? bun?.env?.HOST ?? bun?.env?.COMPUTERNAME;
        if (bunHostname != null && bunHostname.length > 0) {
            return bunHostname;
        }
        try {
            const denoEnvGet = deno?.env?.get;
            if (typeof denoEnvGet === "function") {
                const value = denoEnvGet("HOSTNAME");
                if (value != null && value.length > 0) {
                    return value;
                }
            }
        }
        catch {
        }
        if (location?.hostname != null && location.hostname.length > 0) {
            return location.hostname;
        }
        return undefined;
    }
    function resolveDenoHostname(deno) {
        try {
            if (typeof deno?.hostname === "function") {
                const value = deno.hostname();
                if (value != null && value.length > 0) {
                    return value;
                }
            }
        }
        catch {
        }
        const locationHostname = globalThis.location?.hostname;
        if (locationHostname != null && locationHostname.length > 0) {
            return locationHostname;
        }
        return undefined;
    }
    function getNodeEnv() {
        const globalProcess = globalThis?.process;
        return globalProcess?.env?.NODE_ENV;
    }
    function isNativeError(value) {
        if (value instanceof Error) {
            return true;
        }
        if (value != null && typeof value === "object") {
            const objectTag = Object.prototype.toString.call(value);
            if (/\[object .*Error\]/.test(objectTag)) {
                return true;
            }
            const name = value.name;
            if (typeof name === "string" && name.endsWith("Error")) {
                return true;
            }
        }
        return false;
    }
}
const ANSI_REGEX = /\u001b\[[0-9;]*m/g;
const COLOR_TOKENS = {
    black: "#000000",
    red: "#ef5350",
    green: "#66bb6a",
    yellow: "#fdd835",
    blue: "#42a5f5",
    magenta: "#ab47bc",
    cyan: "#26c6da",
    white: "#fafafa",
    blackBright: "#424242",
    redBright: "#ff7043",
    greenBright: "#81c784",
    yellowBright: "#ffe082",
    blueBright: "#64b5f6",
    magentaBright: "#ce93d8",
    cyanBright: "#4dd0e1",
    whiteBright: "#ffffff",
};
const BACKGROUND_TOKENS = {
    bgBlack: "#000000",
    bgRed: "#ef5350",
    bgGreen: "#66bb6a",
    bgYellow: "#fdd835",
    bgBlue: "#42a5f5",
    bgMagenta: "#ab47bc",
    bgCyan: "#26c6da",
    bgWhite: "#fafafa",
    bgBlackBright: "#424242",
    bgRedBright: "#ff7043",
    bgGreenBright: "#81c784",
    bgYellowBright: "#ffe082",
    bgBlueBright: "#64b5f6",
    bgMagentaBright: "#ce93d8",
    bgCyanBright: "#4dd0e1",
    bgWhiteBright: "#ffffff",
};
const BROWSER_PATH_REGEX = /(?:(?:file|https?|global code|[^@]+)@)?(?:file:)?((?:\/[^:/]+){2,})(?::(\d+))?(?::(\d+))?/;
const runtime = createLoggerEnvironment();
exports.loggerEnvironment = runtime;
__exportStar(require("./interfaces.js"), exports);
class BaseLogger {
    constructor(settings, logObj, stackDepthLevel = Number.NaN) {
        this.logObj = logObj;
        this.stackDepthLevel = stackDepthLevel;
        this.runtime = runtime;
        this.maxErrorCauseDepth = 5;
        this.settings = {
            type: settings?.type ?? "pretty",
            name: settings?.name,
            parentNames: settings?.parentNames,
            minLevel: settings?.minLevel ?? 0,
            argumentsArrayName: settings?.argumentsArrayName,
            hideLogPositionForProduction: settings?.hideLogPositionForProduction ?? false,
            prettyLogTemplate: settings?.prettyLogTemplate ??
                "{{yyyy}}.{{mm}}.{{dd}} {{hh}}:{{MM}}:{{ss}}:{{ms}}\t{{logLevelName}}\t{{filePathWithLine}}{{nameWithDelimiterPrefix}}\t",
            prettyErrorTemplate: settings?.prettyErrorTemplate ?? "\n{{errorName}} {{errorMessage}}\nerror stack:\n{{errorStack}}",
            prettyErrorStackTemplate: settings?.prettyErrorStackTemplate ?? "  • {{fileName}}\t{{method}}\n\t{{filePathWithLine}}",
            prettyErrorParentNamesSeparator: settings?.prettyErrorParentNamesSeparator ?? ":",
            prettyErrorLoggerNameDelimiter: settings?.prettyErrorLoggerNameDelimiter ?? "\t",
            stylePrettyLogs: settings?.stylePrettyLogs ?? true,
            prettyLogTimeZone: settings?.prettyLogTimeZone ?? "UTC",
            prettyLogStyles: settings?.prettyLogStyles ?? {
                logLevelName: {
                    "*": ["bold", "black", "bgWhiteBright", "dim"],
                    SILLY: ["bold", "white"],
                    TRACE: ["bold", "whiteBright"],
                    DEBUG: ["bold", "green"],
                    INFO: ["bold", "blue"],
                    WARN: ["bold", "yellow"],
                    ERROR: ["bold", "red"],
                    FATAL: ["bold", "redBright"],
                },
                dateIsoStr: "white",
                filePathWithLine: "white",
                name: ["white", "bold"],
                nameWithDelimiterPrefix: ["white", "bold"],
                nameWithDelimiterSuffix: ["white", "bold"],
                errorName: ["bold", "bgRedBright", "whiteBright"],
                fileName: ["yellow"],
                fileNameWithLine: "white",
            },
            prettyInspectOptions: settings?.prettyInspectOptions ?? {
                colors: true,
                compact: false,
                depth: Infinity,
            },
            metaProperty: settings?.metaProperty ?? "_meta",
            maskPlaceholder: settings?.maskPlaceholder ?? "[***]",
            maskValuesOfKeys: settings?.maskValuesOfKeys ?? ["password"],
            maskValuesOfKeysCaseInsensitive: settings?.maskValuesOfKeysCaseInsensitive ?? false,
            maskValuesRegEx: settings?.maskValuesRegEx,
            prefix: [...(settings?.prefix ?? [])],
            attachedTransports: [...(settings?.attachedTransports ?? [])],
            overwrite: {
                mask: settings?.overwrite?.mask,
                toLogObj: settings?.overwrite?.toLogObj,
                addMeta: settings?.overwrite?.addMeta,
                addPlaceholders: settings?.overwrite?.addPlaceholders,
                formatMeta: settings?.overwrite?.formatMeta,
                formatLogObj: settings?.overwrite?.formatLogObj,
                transportFormatted: settings?.overwrite?.transportFormatted,
                transportJSON: settings?.overwrite?.transportJSON,
            },
        };
        this.captureStackForMeta = this._shouldCaptureStack();
    }
    log(logLevelId, logLevelName, ...args) {
        if (logLevelId < this.settings.minLevel) {
            return;
        }
        const resolvedArgs = this._resolveLogArguments(args);
        const logArgs = [...this.settings.prefix, ...resolvedArgs];
        const maskedArgs = this.settings.overwrite?.mask != null
            ? this.settings.overwrite?.mask(logArgs)
            : this.settings.maskValuesOfKeys != null && this.settings.maskValuesOfKeys.length > 0
                ? this._mask(logArgs)
                : logArgs;
        const thisLogObj = this.logObj != null ? this._recursiveCloneAndExecuteFunctions(this.logObj) : undefined;
        const logObj = this.settings.overwrite?.toLogObj != null ? this.settings.overwrite?.toLogObj(maskedArgs, thisLogObj) : this._toLogObj(maskedArgs, thisLogObj);
        const logObjWithMeta = this.settings.overwrite?.addMeta != null
            ? this.settings.overwrite?.addMeta(logObj, logLevelId, logLevelName)
            : this._addMetaToLogObj(logObj, logLevelId, logLevelName);
        const logMeta = logObjWithMeta?.[this.settings.metaProperty];
        let logMetaMarkup;
        let logArgsAndErrorsMarkup = undefined;
        if (this.settings.overwrite?.formatMeta != null) {
            logMetaMarkup = this.settings.overwrite?.formatMeta(logObjWithMeta?.[this.settings.metaProperty]);
        }
        if (this.settings.overwrite?.formatLogObj != null) {
            logArgsAndErrorsMarkup = this.settings.overwrite?.formatLogObj(maskedArgs, this.settings);
        }
        if (this.settings.type === "pretty") {
            logMetaMarkup = logMetaMarkup ?? this._prettyFormatLogObjMeta(logObjWithMeta?.[this.settings.metaProperty]);
            logArgsAndErrorsMarkup = logArgsAndErrorsMarkup ?? runtime.prettyFormatLogObj(maskedArgs, this.settings);
        }
        if (logMetaMarkup != null && logArgsAndErrorsMarkup != null) {
            if (this.settings.overwrite?.transportFormatted != null) {
                const transport = this.settings.overwrite.transportFormatted;
                const declaredParams = transport.length;
                if (declaredParams < 4) {
                    transport(logMetaMarkup, logArgsAndErrorsMarkup.args, logArgsAndErrorsMarkup.errors);
                }
                else if (declaredParams === 4) {
                    transport(logMetaMarkup, logArgsAndErrorsMarkup.args, logArgsAndErrorsMarkup.errors, logMeta);
                }
                else {
                    transport(logMetaMarkup, logArgsAndErrorsMarkup.args, logArgsAndErrorsMarkup.errors, logMeta, this.settings);
                }
            }
            else {
                runtime.transportFormatted(logMetaMarkup, logArgsAndErrorsMarkup.args, logArgsAndErrorsMarkup.errors, logMeta, this.settings);
            }
        }
        else {
            if (this.settings.overwrite?.transportJSON != null) {
                this.settings.overwrite.transportJSON(logObjWithMeta);
            }
            else if (this.settings.type !== "hidden") {
                runtime.transportJSON(logObjWithMeta);
            }
        }
        if (this.settings.attachedTransports != null && this.settings.attachedTransports.length > 0) {
            this.settings.attachedTransports.forEach((transportLogger) => {
                transportLogger(logObjWithMeta);
            });
        }
        return logObjWithMeta;
    }
    attachTransport(transportLogger) {
        this.settings.attachedTransports.push(transportLogger);
    }
    getSubLogger(settings, logObj) {
        const subLoggerSettings = {
            ...this.settings,
            ...settings,
            parentNames: this.settings?.parentNames != null && this.settings?.name != null
                ? [...this.settings.parentNames, this.settings.name]
                : this.settings?.name != null
                    ? [this.settings.name]
                    : undefined,
            prefix: [...this.settings.prefix, ...(settings?.prefix ?? [])],
        };
        const subLogger = new this.constructor(subLoggerSettings, logObj ?? this.logObj, this.stackDepthLevel);
        return subLogger;
    }
    _mask(args) {
        const maskKeys = this._getMaskKeys();
        return args?.map((arg) => {
            return this._recursiveCloneAndMaskValuesOfKeys(arg, maskKeys);
        });
    }
    _getMaskKeys() {
        const maskKeys = this.settings.maskValuesOfKeys ?? [];
        const signature = maskKeys.map(String).join("|");
        if (this.settings.maskValuesOfKeysCaseInsensitive === true) {
            if (this.maskKeysCache?.source === maskKeys && this.maskKeysCache.caseInsensitive === true && this.maskKeysCache.signature === signature) {
                return this.maskKeysCache.normalized;
            }
            const normalized = maskKeys.map((key) => (typeof key === "string" ? key.toLowerCase() : String(key).toLowerCase()));
            this.maskKeysCache = {
                source: maskKeys,
                caseInsensitive: true,
                normalized,
                signature,
            };
            return normalized;
        }
        this.maskKeysCache = {
            source: maskKeys,
            caseInsensitive: false,
            normalized: maskKeys,
            signature,
        };
        return maskKeys;
    }
    _resolveLogArguments(args) {
        if (args.length === 1 && typeof args[0] === "function") {
            const candidate = args[0];
            if (candidate.length === 0) {
                const result = candidate();
                return Array.isArray(result) ? result : [result];
            }
        }
        return args;
    }
    _recursiveCloneAndMaskValuesOfKeys(source, keys, seen = []) {
        if (seen.includes(source)) {
            return { ...source };
        }
        if (typeof source === "object" && source !== null) {
            seen.push(source);
        }
        if (runtime.isError(source) || runtime.isBuffer(source)) {
            return source;
        }
        else if (source instanceof Map) {
            return new Map(source);
        }
        else if (source instanceof Set) {
            return new Set(source);
        }
        else if (Array.isArray(source)) {
            return source.map((item) => this._recursiveCloneAndMaskValuesOfKeys(item, keys, seen));
        }
        else if (source instanceof Date) {
            return new Date(source.getTime());
        }
        else if (source instanceof URL) {
            return (0, urlToObj_js_1.urlToObject)(source);
        }
        else if (source !== null && typeof source === "object") {
            const baseObject = runtime.isError(source) ? this._cloneError(source) : Object.create(Object.getPrototypeOf(source));
            return Object.getOwnPropertyNames(source).reduce((o, prop) => {
                const lookupKey = this.settings?.maskValuesOfKeysCaseInsensitive !== true
                    ? prop
                    : typeof prop === "string"
                        ? prop.toLowerCase()
                        : String(prop).toLowerCase();
                o[prop] = keys.includes(lookupKey)
                    ? this.settings.maskPlaceholder
                    : (() => {
                        try {
                            return this._recursiveCloneAndMaskValuesOfKeys(source[prop], keys, seen);
                        }
                        catch {
                            return null;
                        }
                    })();
                return o;
            }, baseObject);
        }
        else {
            if (typeof source === "string") {
                let modifiedSource = source;
                for (const regEx of this.settings?.maskValuesRegEx || []) {
                    modifiedSource = modifiedSource.replace(regEx, this.settings?.maskPlaceholder || "");
                }
                return modifiedSource;
            }
            return source;
        }
    }
    _recursiveCloneAndExecuteFunctions(source, seen = []) {
        if (this.isObjectOrArray(source) && seen.includes(source)) {
            return this.shallowCopy(source);
        }
        if (this.isObjectOrArray(source)) {
            seen.push(source);
        }
        if (Array.isArray(source)) {
            return source.map((item) => this._recursiveCloneAndExecuteFunctions(item, seen));
        }
        else if (source instanceof Date) {
            return new Date(source.getTime());
        }
        else if (this.isObject(source)) {
            return Object.getOwnPropertyNames(source).reduce((o, prop) => {
                const descriptor = Object.getOwnPropertyDescriptor(source, prop);
                if (descriptor) {
                    Object.defineProperty(o, prop, descriptor);
                    const value = source[prop];
                    o[prop] = typeof value === "function" ? value() : this._recursiveCloneAndExecuteFunctions(value, seen);
                }
                return o;
            }, Object.create(Object.getPrototypeOf(source)));
        }
        else {
            return source;
        }
    }
    isObjectOrArray(value) {
        return typeof value === "object" && value !== null;
    }
    isObject(value) {
        return typeof value === "object" && !Array.isArray(value) && value !== null;
    }
    shallowCopy(source) {
        if (Array.isArray(source)) {
            return [...source];
        }
        else {
            return { ...source };
        }
    }
    _toLogObj(args, clonedLogObj = {}) {
        args = args?.map((arg) => (runtime.isError(arg) ? this._toErrorObject(arg) : arg));
        if (this.settings.argumentsArrayName == null) {
            if (args.length === 1 && !Array.isArray(args[0]) && runtime.isBuffer(args[0]) !== true && !(args[0] instanceof Date)) {
                clonedLogObj = typeof args[0] === "object" && args[0] != null ? { ...args[0], ...clonedLogObj } : { 0: args[0], ...clonedLogObj };
            }
            else {
                clonedLogObj = { ...clonedLogObj, ...args };
            }
        }
        else {
            clonedLogObj = {
                ...clonedLogObj,
                [this.settings.argumentsArrayName]: args,
            };
        }
        return clonedLogObj;
    }
    _cloneError(error) {
        const cloned = new error.constructor();
        Object.getOwnPropertyNames(error).forEach((key) => {
            cloned[key] = error[key];
        });
        return cloned;
    }
    _toErrorObject(error, depth = 0, seen = new Set()) {
        if (!seen.has(error)) {
            seen.add(error);
        }
        const errorObject = {
            nativeError: error,
            name: error.name ?? "Error",
            message: error.message,
            stack: runtime.getErrorTrace(error),
        };
        if (depth >= this.maxErrorCauseDepth) {
            return errorObject;
        }
        const causeValue = error.cause;
        if (causeValue != null) {
            const normalizedCause = (0, errorUtils_js_1.toError)(causeValue);
            if (!seen.has(normalizedCause)) {
                errorObject.cause = this._toErrorObject(normalizedCause, depth + 1, seen);
            }
        }
        return errorObject;
    }
    _addMetaToLogObj(logObj, logLevelId, logLevelName) {
        return {
            ...logObj,
            [this.settings.metaProperty]: runtime.getMeta(logLevelId, logLevelName, this.stackDepthLevel, !this.captureStackForMeta, this.settings.name, this.settings.parentNames),
        };
    }
    _shouldCaptureStack() {
        if (this.settings.hideLogPositionForProduction) {
            return false;
        }
        if (this.settings.type === "json") {
            return true;
        }
        const template = this.settings.prettyLogTemplate ?? "";
        const stackPlaceholders = /{{\s*(file(Name|Path|Line|PathWithLine|NameWithLine)|fullFilePath)\s*}}/;
        if (stackPlaceholders.test(template)) {
            return true;
        }
        return false;
    }
    _prettyFormatLogObjMeta(logObjMeta) {
        return (0, metaFormatting_js_1.buildPrettyMeta)(this.settings, logObjMeta).text;
    }
}
exports.BaseLogger = BaseLogger;
