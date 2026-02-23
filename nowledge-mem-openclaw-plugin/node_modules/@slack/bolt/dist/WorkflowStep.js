"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareStepArgs = exports.isStepEvent = exports.processStepMiddleware = exports.validate = exports.WorkflowStep = void 0;
const errors_1 = require("./errors");
const process_1 = __importDefault(require("./middleware/process"));
/** Constants */
const VALID_PAYLOAD_TYPES = new Set(['workflow_step_edit', 'workflow_step', 'workflow_step_execute']);
/** @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
 * version.
 */
class WorkflowStep {
    /** Step callback_id */
    callbackId;
    /** Step Add/Edit :: 'workflow_step_edit' action */
    edit;
    /** Step Config Save :: 'view_submission' */
    save;
    /** Step Executed/Run :: 'workflow_step_execute' event */
    execute;
    constructor(callbackId, config) {
        validate(callbackId, config);
        const { save, edit, execute } = config;
        this.callbackId = callbackId;
        this.save = Array.isArray(save) ? save : [save];
        this.edit = Array.isArray(edit) ? edit : [edit];
        this.execute = Array.isArray(execute) ? execute : [execute];
    }
    getMiddleware() {
        return async (args) => {
            if (isStepEvent(args) && this.matchesConstraints(args)) {
                return this.processEvent(args);
            }
            return args.next();
        };
    }
    matchesConstraints(args) {
        return args.payload.callback_id === this.callbackId;
    }
    async processEvent(args) {
        const { payload } = args;
        const stepArgs = prepareStepArgs(args);
        const stepMiddleware = this.getStepMiddleware(payload);
        return processStepMiddleware(stepArgs, stepMiddleware);
    }
    getStepMiddleware(payload) {
        switch (payload.type) {
            case 'workflow_step_edit':
                return this.edit;
            case 'workflow_step':
                return this.save;
            case 'workflow_step_execute':
                return this.execute;
            default:
                return [];
        }
    }
}
exports.WorkflowStep = WorkflowStep;
/** Helper Functions */
/** @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
 * version.
 */
function validate(callbackId, config) {
    // Ensure callbackId is valid
    if (typeof callbackId !== 'string') {
        const errorMsg = 'WorkflowStep expects a callback_id as the first argument';
        throw new errors_1.WorkflowStepInitializationError(errorMsg);
    }
    // Ensure step config object is passed in
    if (typeof config !== 'object') {
        const errorMsg = 'WorkflowStep expects a configuration object as the second argument';
        throw new errors_1.WorkflowStepInitializationError(errorMsg);
    }
    // Check for missing required keys
    const requiredKeys = ['save', 'edit', 'execute'];
    const missingKeys = [];
    for (const key of requiredKeys) {
        if (config[key] === undefined) {
            missingKeys.push(key);
        }
    }
    if (missingKeys.length > 0) {
        const errorMsg = `WorkflowStep is missing required keys: ${missingKeys.join(', ')}`;
        throw new errors_1.WorkflowStepInitializationError(errorMsg);
    }
    // Ensure a callback or an array of callbacks is present
    const requiredFns = ['save', 'edit', 'execute'];
    for (const fn of requiredFns) {
        if (typeof config[fn] !== 'function' && !Array.isArray(config[fn])) {
            const errorMsg = `WorkflowStep ${fn} property must be a function or an array of functions`;
            throw new errors_1.WorkflowStepInitializationError(errorMsg);
        }
    }
}
exports.validate = validate;
/**
 * `processStepMiddleware()` invokes each callback for lifecycle event
 * @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
 * version.
 * @param args workflow_step_edit action
 */
async function processStepMiddleware(args, middleware) {
    const { context, client, logger } = args;
    // TODO :: revisit type used below (look into contravariance)
    const callbacks = [...middleware];
    const lastCallback = callbacks.pop();
    if (lastCallback !== undefined) {
        await (0, process_1.default)(callbacks, args, context, client, logger, async () => lastCallback({ ...args, context, client, logger }));
    }
}
exports.processStepMiddleware = processStepMiddleware;
/** @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
 * version.
 */
function isStepEvent(args) {
    return VALID_PAYLOAD_TYPES.has(args.payload.type);
}
exports.isStepEvent = isStepEvent;
function selectToken(context) {
    return context.botToken !== undefined ? context.botToken : context.userToken;
}
/**
 * Factory for `configure()` utility
 * @param args workflow_step_edit action
 */
function createStepConfigure(args) {
    const { context, client, body: { callback_id, trigger_id }, } = args;
    const token = selectToken(context);
    return (params) => client.views.open({
        token,
        trigger_id,
        view: {
            callback_id,
            type: 'workflow_step',
            ...params,
        },
    });
}
/**
 * Factory for `update()` utility
 * @param args view_submission event
 */
function createStepUpdate(args) {
    const { context, client, body: { workflow_step: { workflow_step_edit_id }, }, } = args;
    const token = selectToken(context);
    return (params = {}) => client.workflows.updateStep({
        token,
        workflow_step_edit_id,
        ...params,
    });
}
/**
 * Factory for `complete()` utility
 * @param args workflow_step_execute event
 */
function createStepComplete(args) {
    const { context, client, payload: { workflow_step: { workflow_step_execute_id }, }, } = args;
    const token = selectToken(context);
    return (params = {}) => client.workflows.stepCompleted({
        token,
        workflow_step_execute_id,
        ...params,
    });
}
/**
 * Factory for `fail()` utility
 * @param args workflow_step_execute event
 */
function createStepFail(args) {
    const { context, client, payload: { workflow_step: { workflow_step_execute_id }, }, } = args;
    const token = selectToken(context);
    return (params) => {
        const { error } = params;
        return client.workflows.stepFailed({
            token,
            workflow_step_execute_id,
            error,
        });
    };
}
/**
 * `prepareStepArgs()` takes in a step's args and:
 *  1. removes the next() passed in from App-level middleware processing
 *    - events will *not* continue down global middleware chain to subsequent listeners
 *  2. augments args with step lifecycle-specific properties/utilities
 * @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
 * version.
 */
// TODO :: refactor to incorporate a generic parameter
function prepareStepArgs(args) {
    const { next: _next, ...stepArgs } = args;
    // biome-ignore lint/suspicious/noExplicitAny: need to use any as the cases of the switch that follows dont narrow to the specific required args type. use type predicates for each workflow_step event args in the switch to get rid of this any.
    const preparedArgs = { ...stepArgs };
    switch (preparedArgs.payload.type) {
        case 'workflow_step_edit':
            preparedArgs.step = preparedArgs.action.workflow_step;
            preparedArgs.configure = createStepConfigure(preparedArgs);
            break;
        case 'workflow_step':
            preparedArgs.step = preparedArgs.body.workflow_step;
            preparedArgs.update = createStepUpdate(preparedArgs);
            break;
        case 'workflow_step_execute':
            preparedArgs.step = preparedArgs.event.workflow_step;
            preparedArgs.complete = createStepComplete(preparedArgs);
            preparedArgs.fail = createStepFail(preparedArgs);
            break;
        default:
            break;
    }
    return preparedArgs;
}
exports.prepareStepArgs = prepareStepArgs;
//# sourceMappingURL=WorkflowStep.js.map