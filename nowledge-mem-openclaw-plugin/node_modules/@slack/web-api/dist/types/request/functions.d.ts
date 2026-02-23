import type { TokenOverridable } from './common';
interface ExecutionID {
    function_execution_id: string;
}
export interface FunctionsCompleteErrorArguments extends ExecutionID, TokenOverridable {
    error: string;
}
export interface FunctionsCompleteSuccessArguments extends ExecutionID, TokenOverridable {
    outputs: Record<string, unknown>;
}
export {};
//# sourceMappingURL=functions.d.ts.map