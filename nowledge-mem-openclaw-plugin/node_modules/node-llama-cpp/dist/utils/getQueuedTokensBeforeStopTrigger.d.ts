import { Token, Tokenizer } from "../types.js";
import { StopGenerationDetector } from "./StopGenerationDetector.js";
export declare function getQueuedTokensBeforeStopTrigger(triggeredStops: ReturnType<typeof StopGenerationDetector["prototype"]["getTriggeredStops"]>, partiallyFreeTokens: {
    tokens: Token[];
    text: string;
}, tokenizer: Tokenizer): Token[];
