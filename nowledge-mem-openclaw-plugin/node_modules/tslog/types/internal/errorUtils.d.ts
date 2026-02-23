import { IErrorObject, IStackFrame } from "../interfaces.js";
type StackParser = (line: string) => IStackFrame | undefined;
export interface CollectCauseOptions {
    maxDepth?: number;
}
export declare function collectErrorCauses(error: unknown, options?: CollectCauseOptions): Error[];
export declare function toError(value: unknown): Error;
export declare function toErrorObject(error: Error, parseLine: StackParser): IErrorObject;
export {};
