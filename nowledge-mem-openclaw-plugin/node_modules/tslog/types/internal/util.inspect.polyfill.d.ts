import type { InspectOptions } from "./InspectOptions.interface.js";
export type { InspectOptions };
interface ICtx {
    showHidden?: boolean | unknown;
    depth?: number;
    colors?: boolean;
    customInspect?: boolean;
    stylize: (str: string, styleType: string) => string;
    seen: unknown[];
}
/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
export declare function inspect(obj: unknown, opts?: InspectOptions): string;
export declare namespace inspect {
    var colors: {
        [name: string]: [number, number];
    };
    var styles: {
        special: string;
        number: string;
        boolean: string;
        undefined: string;
        null: string;
        string: string;
        date: string;
        regexp: string;
    };
}
export declare function formatValue(ctx: ICtx, value: any, recurseTimes?: number): string;
export declare function formatWithOptions(inspectOptions: InspectOptions, ...args: unknown[]): string;
