"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractThreadInfo = exports.processAssistantMiddleware = exports.validate = exports.isAssistantMessage = exports.matchesConstraints = exports.isAssistantEvent = exports.enrichAssistantArgs = exports.Assistant = void 0;
const AssistantThreadContextStore_1 = require("./AssistantThreadContextStore");
const errors_1 = require("./errors");
const process_1 = __importDefault(require("./middleware/process"));
/** Constants */
const ASSISTANT_PAYLOAD_TYPES = new Set(['assistant_thread_started', 'assistant_thread_context_changed', 'message']);
class Assistant {
    threadContextStore;
    /** 'assistant_thread_started' */
    threadStarted;
    /** 'assistant_thread_context_changed' */
    threadContextChanged;
    /** 'message' */
    userMessage;
    constructor(config) {
        validate(config);
        const { threadContextStore = new AssistantThreadContextStore_1.DefaultThreadContextStore(), threadStarted, 
        // When `threadContextChanged` method is not provided, fallback to
        // AssistantContextStore's save method. If a custom store has also not
        // been provided, the default save context-via-metadata approach is used.
        // See DefaultThreadContextStore for details of this implementation.
        threadContextChanged = (args) => threadContextStore.save(args), userMessage, } = config;
        this.threadContextStore = threadContextStore;
        this.threadStarted = Array.isArray(threadStarted) ? threadStarted : [threadStarted];
        this.threadContextChanged = Array.isArray(threadContextChanged) ? threadContextChanged : [threadContextChanged];
        this.userMessage = Array.isArray(userMessage) ? userMessage : [userMessage];
    }
    getMiddleware() {
        return async (args) => {
            if (isAssistantEvent(args) && matchesConstraints(args)) {
                return this.processEvent(args);
            }
            return args.next();
        };
    }
    async processEvent(args) {
        const { payload } = args;
        const assistantArgs = enrichAssistantArgs(this.threadContextStore, args);
        const assistantMiddleware = this.getAssistantMiddleware(payload);
        return processAssistantMiddleware(assistantArgs, assistantMiddleware);
    }
    /**
     * `getAssistantMiddleware()` returns the Assistant instance's middleware
     */
    getAssistantMiddleware(payload) {
        switch (payload.type) {
            case 'assistant_thread_started':
                return this.threadStarted;
            case 'assistant_thread_context_changed':
                return this.threadContextChanged;
            case 'message':
                return this.userMessage;
            default:
                return [];
        }
    }
}
exports.Assistant = Assistant;
/**
 * `enrichAssistantArgs()` takes the event arguments and:
 *  1. Removes the next() passed in from App-level middleware processing, thus preventing
 *  events from continuing down the global middleware chain to subsequent listeners
 *  2. Adds assistant-specific utilities (i.e., helper methods)
 * */
function enrichAssistantArgs(threadContextStore, args) {
    const { next: _next, ...assistantArgs } = args;
    const preparedArgs = { ...assistantArgs };
    // Do not pass preparedArgs (ie, do not add utilities to get/save)
    preparedArgs.getThreadContext = () => threadContextStore.get(args);
    preparedArgs.saveThreadContext = () => threadContextStore.save(args);
    preparedArgs.say = createSay(preparedArgs);
    preparedArgs.setStatus = createSetStatus(preparedArgs);
    preparedArgs.setSuggestedPrompts = createSetSuggestedPrompts(preparedArgs);
    preparedArgs.setTitle = createSetTitle(preparedArgs);
    return preparedArgs;
}
exports.enrichAssistantArgs = enrichAssistantArgs;
/**
 * `isAssistantEvent()` determines if incoming event is a supported
 * Assistant event type.
 */
function isAssistantEvent(args) {
    return ASSISTANT_PAYLOAD_TYPES.has(args.payload.type);
}
exports.isAssistantEvent = isAssistantEvent;
/**
 * `matchesConstraints()` determines if the incoming event payload
 * is related to the Assistant.
 */
function matchesConstraints(args) {
    return args.payload.type === 'message' ? isAssistantMessage(args.payload) : true;
}
exports.matchesConstraints = matchesConstraints;
/**
 * `isAssistantMessage()` evaluates if the message payload is associated
 * with the Assistant container.
 */
function isAssistantMessage(payload) {
    const isThreadMessage = 'channel' in payload && 'thread_ts' in payload;
    const inAssistantContainer = 'channel_type' in payload &&
        payload.channel_type === 'im' &&
        (!('subtype' in payload) || payload.subtype === 'file_share' || payload.subtype === undefined); // TODO: undefined subtype is a limitation of message event, needs fixing (see https://github.com/slackapi/node-slack-sdk/issues/1904)
    return isThreadMessage && inAssistantContainer;
}
exports.isAssistantMessage = isAssistantMessage;
/**
 * `validate()` determines if the provided AssistantConfig is a valid configuration.
 */
function validate(config) {
    // Ensure assistant config object is passed in
    if (typeof config !== 'object') {
        const errorMsg = 'Assistant expects a configuration object as the argument';
        throw new errors_1.AssistantInitializationError(errorMsg);
    }
    // Check for missing required keys
    const requiredKeys = ['threadStarted', 'userMessage'];
    const missingKeys = [];
    for (const key of requiredKeys) {
        if (config[key] === undefined)
            missingKeys.push(key);
    }
    if (missingKeys.length > 0) {
        const errorMsg = `Assistant is missing required keys: ${missingKeys.join(', ')}`;
        throw new errors_1.AssistantInitializationError(errorMsg);
    }
    // Ensure a callback or an array of callbacks is present
    const requiredFns = ['threadStarted', 'userMessage'];
    if ('threadContextChanged' in config)
        requiredFns.push('threadContextChanged');
    for (const fn of requiredFns) {
        if (typeof config[fn] !== 'function' && !Array.isArray(config[fn])) {
            const errorMsg = `Assistant ${fn} property must be a function or an array of functions`;
            throw new errors_1.AssistantInitializationError(errorMsg);
        }
    }
    // Validate threadContextStore
    if (config.threadContextStore) {
        // Ensure assistant config object is passed in
        if (typeof config.threadContextStore !== 'object') {
            const errorMsg = 'Assistant expects threadContextStore to be a configuration object';
            throw new errors_1.AssistantInitializationError(errorMsg);
        }
        // Check for missing required keys
        const requiredContextKeys = ['get', 'save'];
        const missingContextKeys = [];
        for (const k of requiredContextKeys) {
            if (config.threadContextStore && config.threadContextStore[k] === undefined) {
                missingContextKeys.push(k);
            }
        }
        if (missingContextKeys.length > 0) {
            const errorMsg = `threadContextStore is missing required keys: ${missingContextKeys.join(', ')}`;
            throw new errors_1.AssistantInitializationError(errorMsg);
        }
        // Ensure properties of context store are functions
        const requiredStoreFns = ['get', 'save'];
        for (const fn of requiredStoreFns) {
            if (config.threadContextStore && typeof config.threadContextStore[fn] !== 'function') {
                const errorMsg = `threadContextStore ${fn} property must be a function`;
                throw new errors_1.AssistantInitializationError(errorMsg);
            }
        }
    }
}
exports.validate = validate;
/**
 * `processAssistantMiddleware()` invokes each callback for the given event
 */
async function processAssistantMiddleware(args, middleware) {
    const { context, client, logger } = args;
    const callbacks = [...middleware];
    const lastCallback = callbacks.pop();
    if (lastCallback !== undefined) {
        await (0, process_1.default)(callbacks, args, context, client, logger, async () => lastCallback({ ...args, context, client, logger }));
    }
}
exports.processAssistantMiddleware = processAssistantMiddleware;
/**
 * Utility functions
 */
/**
 * Creates utility `say()` to easily respond to wherever the message
 * was received. Alias for `postMessage()`.
 * https://api.slack.com/methods/chat.postMessage
 */
function createSay(args) {
    const { client, payload } = args;
    const { channelId: channel, threadTs: thread_ts, context } = extractThreadInfo(payload);
    return async (message) => {
        const threadContext = context.channel_id ? context : await args.getThreadContext();
        const postMessageArgument = typeof message === 'string' ? { text: message, channel, thread_ts } : { ...message, channel, thread_ts };
        if (threadContext || postMessageArgument.metadata) {
            postMessageArgument.metadata = {
                event_type: postMessageArgument.metadata?.event_type ?? 'assistant_thread_context',
                event_payload: {
                    ...threadContext,
                    ...(postMessageArgument.metadata?.event_payload ?? {}),
                },
            };
        }
        return client.chat.postMessage(postMessageArgument);
    };
}
/**
 * Creates utility `setStatus()` to set the status and indicate active processing.
 * https://api.slack.com/methods/assistant.threads.setStatus
 */
function createSetStatus(args) {
    const { client, payload } = args;
    const { channelId: channel_id, threadTs: thread_ts } = extractThreadInfo(payload);
    return (status) => {
        if (typeof status === 'string') {
            return client.assistant.threads.setStatus({
                channel_id,
                thread_ts,
                status,
            });
        }
        return client.assistant.threads.setStatus({
            channel_id,
            thread_ts,
            ...status,
        });
    };
}
/**
 * Creates utility `setSuggestedPrompts()` to provides prompts for the user to select from.
 * https://api.slack.com/methods/assistant.threads.setSuggestedPrompts
 */
function createSetSuggestedPrompts(args) {
    const { client, payload } = args;
    const { channelId: channel_id, threadTs: thread_ts } = extractThreadInfo(payload);
    return (params) => {
        const { prompts, title } = params;
        return client.assistant.threads.setSuggestedPrompts({
            channel_id,
            thread_ts,
            prompts,
            title,
        });
    };
}
/**
 * Creates utility `setTitle()` to set the title of the Assistant thread
 * https://api.slack.com/methods/assistant.threads.setTitle
 */
function createSetTitle(args) {
    const { client, payload } = args;
    const { channelId: channel_id, threadTs: thread_ts } = extractThreadInfo(payload);
    return (title) => client.assistant.threads.setTitle({
        channel_id,
        thread_ts,
        title,
    });
}
/**
 * `extractThreadInfo()` parses an incoming payload and returns relevant
 * details about the thread
 */
function extractThreadInfo(payload) {
    let channelId = '';
    let threadTs = '';
    let context = {};
    // assistant_thread_started, asssistant_thread_context_changed
    if ('assistant_thread' in payload &&
        payload.assistant_thread &&
        typeof payload.assistant_thread.channel_id === 'string' &&
        typeof payload.assistant_thread.thread_ts === 'string') {
        channelId = payload.assistant_thread.channel_id;
        threadTs = payload.assistant_thread.thread_ts;
        if (typeof payload.assistant_thread.context === 'object' && payload.assistant_thread.context !== null) {
            context = payload.assistant_thread.context;
        }
    }
    // user message in thread
    if ('channel' in payload && 'thread_ts' in payload && payload.thread_ts !== undefined) {
        channelId = payload.channel;
        threadTs = payload.thread_ts;
    }
    // throw error if `channel` or `thread_ts` are missing
    if (!channelId || !threadTs) {
        const missingProps = [];
        if (!channelId)
            missingProps.push('channel_id');
        if (!threadTs)
            missingProps.push('thread_ts');
        if (missingProps.length > 0) {
            const errorMsg = `Assistant message event is missing required properties: ${missingProps.join(', ')}`;
            throw new errors_1.AssistantMissingPropertyError(errorMsg);
        }
    }
    return { channelId, threadTs, context };
}
exports.extractThreadInfo = extractThreadInfo;
//# sourceMappingURL=Assistant.js.map