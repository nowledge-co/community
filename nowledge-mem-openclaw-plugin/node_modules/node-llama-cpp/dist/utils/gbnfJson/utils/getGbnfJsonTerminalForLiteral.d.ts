import { GbnfNull } from "../terminals/GbnfNull.js";
import { GbnfBooleanValue } from "../terminals/GbnfBooleanValue.js";
import { GbnfNumberValue } from "../terminals/GbnfNumberValue.js";
import { GbnfStringValue } from "../terminals/GbnfStringValue.js";
export declare function getGbnfJsonTerminalForLiteral(literal: string | number | boolean | null): GbnfStringValue | GbnfNull | GbnfBooleanValue | GbnfNumberValue;
