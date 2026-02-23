import type { WorkflowStepExecuteEvent } from '@slack/types';
import type { Block, KnownBlock, ViewsOpenResponse, WorkflowsStepCompletedResponse, WorkflowsStepFailedResponse, WorkflowsUpdateStepResponse } from '@slack/web-api';
import type { AllMiddlewareArgs, AnyMiddlewareArgs, Middleware, SlackActionMiddlewareArgs, SlackEventMiddlewareArgs, SlackViewMiddlewareArgs, ViewWorkflowStepSubmitAction, WorkflowStepEdit } from './types';
/** Interfaces */
/** @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
 * version.
 */
export interface StepConfigureArguments {
    blocks: (KnownBlock | Block)[];
    private_metadata?: string;
    submit_disabled?: boolean;
    external_id?: string;
}
/** @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
 * version.
 */
export interface StepUpdateArguments {
    inputs?: Record<string, {
        value: any;
        skip_variable_replacement?: boolean;
        variables?: Record<string, any>;
    }>;
    outputs?: {
        name: string;
        type: string;
        label: string;
    }[];
    step_name?: string;
    step_image_url?: string;
}
/** @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
 * version.
 */
export interface StepCompleteArguments {
    outputs?: Record<string, any>;
}
/** @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
 * version.
 */
export interface StepFailArguments {
    error: {
        message: string;
    };
}
/** @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
 * version.
 */
export type StepConfigureFn = (params: StepConfigureArguments) => Promise<ViewsOpenResponse>;
/** @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
 * version.
 */
export type StepUpdateFn = (params?: StepUpdateArguments) => Promise<WorkflowsUpdateStepResponse>;
/** @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
 * version.
 */
export type StepCompleteFn = (params?: StepCompleteArguments) => Promise<WorkflowsStepCompletedResponse>;
/** @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
 * version.
 */
export type StepFailFn = (params: StepFailArguments) => Promise<WorkflowsStepFailedResponse>;
/** @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
 * version.
 */
export interface WorkflowStepConfig {
    edit: WorkflowStepEditMiddleware | WorkflowStepEditMiddleware[];
    save: WorkflowStepSaveMiddleware | WorkflowStepSaveMiddleware[];
    execute: WorkflowStepExecuteMiddleware | WorkflowStepExecuteMiddleware[];
}
/** @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
 * version.
 */
export interface WorkflowStepEditMiddlewareArgs extends SlackActionMiddlewareArgs<WorkflowStepEdit> {
    step: WorkflowStepEdit['workflow_step'];
    configure: StepConfigureFn;
}
/** @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
 * version.
 */
export interface WorkflowStepSaveMiddlewareArgs extends SlackViewMiddlewareArgs<ViewWorkflowStepSubmitAction> {
    step: ViewWorkflowStepSubmitAction['workflow_step'];
    update: StepUpdateFn;
}
/** @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
 * version.
 */
export interface WorkflowStepExecuteMiddlewareArgs extends SlackEventMiddlewareArgs<'workflow_step_execute'> {
    step: WorkflowStepExecuteEvent['workflow_step'];
    complete: StepCompleteFn;
    fail: StepFailFn;
}
/** Types */
/** @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
 * version.
 */
export type SlackWorkflowStepMiddlewareArgs = WorkflowStepEditMiddlewareArgs | WorkflowStepSaveMiddlewareArgs | WorkflowStepExecuteMiddlewareArgs;
/** @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
 * version.
 */
export type WorkflowStepEditMiddleware = Middleware<WorkflowStepEditMiddlewareArgs>;
/** @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
 * version.
 */
export type WorkflowStepSaveMiddleware = Middleware<WorkflowStepSaveMiddlewareArgs>;
/** @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
 * version.
 */
export type WorkflowStepExecuteMiddleware = Middleware<WorkflowStepExecuteMiddlewareArgs>;
/** @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
 * version.
 */
export type WorkflowStepMiddleware = WorkflowStepEditMiddleware[] | WorkflowStepSaveMiddleware[] | WorkflowStepExecuteMiddleware[];
/** @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
 * version.
 */
export type AllWorkflowStepMiddlewareArgs<T extends SlackWorkflowStepMiddlewareArgs = SlackWorkflowStepMiddlewareArgs> = T & AllMiddlewareArgs;
/** @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
 * version.
 */
export declare class WorkflowStep {
    /** Step callback_id */
    private callbackId;
    /** Step Add/Edit :: 'workflow_step_edit' action */
    private edit;
    /** Step Config Save :: 'view_submission' */
    private save;
    /** Step Executed/Run :: 'workflow_step_execute' event */
    private execute;
    constructor(callbackId: string, config: WorkflowStepConfig);
    getMiddleware(): Middleware<AnyMiddlewareArgs>;
    private matchesConstraints;
    private processEvent;
    private getStepMiddleware;
}
/** Helper Functions */
/** @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
 * version.
 */
export declare function validate(callbackId: string, config: WorkflowStepConfig): void;
/**
 * `processStepMiddleware()` invokes each callback for lifecycle event
 * @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
 * version.
 * @param args workflow_step_edit action
 */
export declare function processStepMiddleware(args: AllWorkflowStepMiddlewareArgs, middleware: WorkflowStepMiddleware): Promise<void>;
/** @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
 * version.
 */
export declare function isStepEvent(args: AnyMiddlewareArgs): args is AllWorkflowStepMiddlewareArgs;
/**
 * `prepareStepArgs()` takes in a step's args and:
 *  1. removes the next() passed in from App-level middleware processing
 *    - events will *not* continue down global middleware chain to subsequent listeners
 *  2. augments args with step lifecycle-specific properties/utilities
 * @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
 * version.
 */
export declare function prepareStepArgs(args: AllWorkflowStepMiddlewareArgs): AllWorkflowStepMiddlewareArgs;
//# sourceMappingURL=WorkflowStep.d.ts.map