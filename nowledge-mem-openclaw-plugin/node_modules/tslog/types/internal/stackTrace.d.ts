import { IStackFrame } from "../interfaces.js";
/**
 * Split an error stack into individual lines while guaranteeing an array result.
 */
export declare function splitStackLines(error: Error | unknown): string[];
/**
 * Remove empty and error header lines which vary between runtimes.
 */
export declare function sanitizeStackLines(lines: string[]): string[];
/**
 * Convert stack trace lines into stack frames using the provided parser.
 */
export declare function toStackFrames(lines: string[], parseLine: (line: string) => IStackFrame | undefined): IStackFrame[];
/**
 * Determine the first stack frame that does not match known internal patterns.
 */
export declare function findFirstExternalFrameIndex(frames: IStackFrame[], ignorePatterns?: RegExp[]): number;
/**
 * Safely access a frame within the provided array.
 */
export declare function getFrameAt(frames: IStackFrame[], index: number): IStackFrame | undefined;
/**
 * Utility that splits and sanitizes stack lines in a single call.
 */
export declare function getCleanStackLines(error: Error | unknown): string[];
/**
 * Build a normalized stack trace for the provided error using the parser.
 */
export declare function buildStackTrace(error: Error | unknown, parseLine: (line: string) => IStackFrame | undefined): IStackFrame[];
export declare function isIgnorableFrame(frame: IStackFrame, ignorePatterns: RegExp[]): boolean;
export declare function clampIndex(index: number, maxExclusive: number): number;
export declare function pickCallerStackFrame(error: Error | unknown, parseLine: (line: string) => IStackFrame | undefined, options?: {
    stackDepthLevel?: number;
    ignorePatterns?: RegExp[];
}): IStackFrame | undefined;
export declare function getDefaultIgnorePatterns(): RegExp[];
