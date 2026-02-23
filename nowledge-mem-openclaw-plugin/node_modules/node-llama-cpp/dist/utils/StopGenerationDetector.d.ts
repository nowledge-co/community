import { Token, Tokenizer } from "../types.js";
import { LlamaText } from "./LlamaText.js";
import { QueuedTokenRelease, QueuedTokenReleaseLock } from "./TokenStreamRegulator.js";
export type StopGenerationTrigger = (string | Token)[];
export declare class StopGenerationDetector<T extends string = string> {
    recordGeneration({ text, tokens, queuedTokenRelease, startNewChecks, triggerMustStartWithGeneration }: {
        text: string;
        tokens: Token[];
        queuedTokenRelease?: QueuedTokenRelease;
        startNewChecks?: boolean;
        triggerMustStartWithGeneration?: boolean;
    }): void;
    addStopTrigger(stopTrigger: StopGenerationTrigger, completeEvent?: T): this;
    /** Whether there are some stops that have been found and triggered. */
    get hasTriggeredStops(): boolean;
    /** Whether there are some stops that have been found, but not triggered yet. */
    get hasInProgressStops(): boolean;
    /** Gets the stops that have been found and triggered. */
    getTriggeredStops(): TriggeredStop<T>[];
    clearTriggeredStops(): void;
    clearInProgressStops(): void;
    get hasTriggers(): boolean;
    /**
     * For a given generation, get the number of possibilities that would be disregarded if the generation is recorded.
     *
     * Calling this function does not change the state of the detector.
     */
    getDisregardedPossibilitiesCountForAGeneration({ text, tokens, startNewChecks }: {
        text: string;
        tokens: Token[];
        /** Setting this to `true` implies that `triggerMustStartWithGeneration` is also `true` */
        startNewChecks: boolean;
    }): number;
    static resolveStopTriggers(stopTriggers: readonly (string | Readonly<StopGenerationTrigger> | LlamaText)[], tokenizer: Tokenizer): StopGenerationTrigger[];
    static resolveLlamaTextTrigger(llamaText: LlamaText, tokenizer: Tokenizer): StopGenerationTrigger;
    static getFirstRemainingGenerationAfterStop(triggeredStops: TriggeredStop[]): {
        stopTrigger: StopGenerationTrigger | undefined;
        firstRemainingGenerationAfterStop: string | Token[] | undefined;
    };
    static detokenizeRemainingGeneration(remainingGeneration: string | Token[] | undefined, stopTrigger: StopGenerationTrigger | undefined, tokenizer: Tokenizer, specialTokens?: boolean): string;
}
export type TriggeredStop<T extends string = string> = {
    stopTrigger: StopGenerationTrigger;
    events: T[];
    remainingGeneration: (string | Token[])[];
    queuedTokenReleaseLocks: QueuedTokenReleaseLock[];
};
