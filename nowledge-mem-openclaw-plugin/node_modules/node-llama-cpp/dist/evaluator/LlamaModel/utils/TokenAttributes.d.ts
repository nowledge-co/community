import { Token } from "../../../types.js";
export declare const enum TokenAttribute {
    undefined = 0,
    unknown = 1,
    unused = 2,
    normal = 4,
    control = 8,// SPECIAL
    userDefined = 16,
    byte = 32,
    normalized = 64,
    lstrip = 128,
    rstrip = 256,
    singleWord = 512
}
export declare class TokenAttributes {
    readonly token: Token;
    private constructor();
    get undefined(): boolean;
    get unknown(): boolean;
    get unused(): boolean;
    get normal(): boolean;
    get control(): boolean;
    get userDefined(): boolean;
    get byte(): boolean;
    get normalized(): boolean;
    get lstrip(): boolean;
    get rstrip(): boolean;
    get singleWord(): boolean;
}
