import { ISettingsParam, ISettings, ILogObjMeta, IMeta, IStackFrame } from "./interfaces.js";
export declare function createLoggerEnvironment(): LoggerEnvironment;
interface LoggerEnvironment {
    getMeta: (logLevelId: number, logLevelName: string, stackDepthLevel: number, hideLogPositionForPerformance: boolean, name?: string, parentNames?: string[]) => IMeta;
    getCallerStackFrame: (stackDepthLevel: number, error?: Error) => IStackFrame;
    getErrorTrace: (error: Error) => IStackFrame[];
    isError: (value: unknown) => value is Error;
    isBuffer: (value: unknown) => boolean;
    prettyFormatLogObj: <LogObj>(maskedArgs: unknown[], settings: ISettings<LogObj>) => {
        args: unknown[];
        errors: string[];
    };
    prettyFormatErrorObj: <LogObj>(error: Error, settings: ISettings<LogObj>) => string;
    transportFormatted: <LogObj>(logMetaMarkup: string, logArgs: unknown[], logErrors: string[], logMeta: IMeta | undefined, settings: ISettings<LogObj>) => void;
    transportJSON: <LogObj>(json: LogObj & ILogObjMeta) => void;
}
export declare const loggerEnvironment: LoggerEnvironment;
export * from "./interfaces.js";
export declare class BaseLogger<LogObj> {
    private logObj?;
    private stackDepthLevel;
    readonly runtime: LoggerEnvironment;
    settings: ISettings<LogObj>;
    private readonly maxErrorCauseDepth;
    private readonly captureStackForMeta;
    private maskKeysCache?;
    constructor(settings?: ISettingsParam<LogObj>, logObj?: LogObj | undefined, stackDepthLevel?: number);
    /**
     * Logs a message with a custom log level.
     * @param logLevelId    - Log level ID e.g. 0
     * @param logLevelName  - Log level name e.g. silly
     * @param args          - Multiple log attributes that should be logged out.
     * @return LogObject with meta property, when log level is >= minLevel
     */
    log(logLevelId: number, logLevelName: string, ...args: unknown[]): (LogObj & ILogObjMeta) | undefined;
    /**
     *  Attaches external Loggers, e.g. external log services, file system, database
     *
     * @param transportLogger - External logger to be attached. Must implement all log methods.
     */
    attachTransport(transportLogger: (transportLogger: LogObj & ILogObjMeta) => void): void;
    /**
     *  Returns a child logger based on the current instance with inherited settings
     *
     * @param settings - Overwrite settings inherited from parent logger
     * @param logObj - Overwrite logObj for sub-logger
     */
    getSubLogger(settings?: ISettingsParam<LogObj>, logObj?: LogObj): BaseLogger<LogObj>;
    private _mask;
    private _getMaskKeys;
    private _resolveLogArguments;
    private _recursiveCloneAndMaskValuesOfKeys;
    private _recursiveCloneAndExecuteFunctions;
    private isObjectOrArray;
    private isObject;
    private shallowCopy;
    private _toLogObj;
    private _cloneError;
    private _toErrorObject;
    private _addMetaToLogObj;
    private _shouldCaptureStack;
    private _prettyFormatLogObjMeta;
}
