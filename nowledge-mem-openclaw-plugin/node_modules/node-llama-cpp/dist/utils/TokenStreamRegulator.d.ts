import { Token, Tokenizer } from "../types.js";
export declare class TokenStreamRegulator {
    addChunk({ tokens, text }: {
        tokens: Token[];
        text: string;
    }): QueuedTokenRelease;
    popFreeChunkTokens(): Token[];
    getPartiallyFreeChunk(tokenizer: Tokenizer): {
        tokens: Token[];
        text: string;
    };
    getAllQueuedChunkTokens(): Token[];
    getLastQueuedChunkTokens(maxTokens?: number): Token[];
    clearQueue(): void;
    reset(): void;
    removeChunkIfLast(queuedTokenRelease: QueuedTokenRelease | undefined): boolean;
}
export declare class QueuedTokenRelease {
    private constructor();
    get tokens(): readonly Token[];
    get text(): string;
    get isFree(): boolean;
    get hasTextLocks(): boolean;
    get hasTokenLocks(): boolean;
    get isPartiallyFree(): boolean;
    getFreeTextIndex(): number;
    getFreeTokenIndex(): number;
    createTextIndexLock(startIndex: number): QueuedTokenReleaseLock;
    createTokenIndexLock(startIndex: number): QueuedTokenReleaseLock;
    modifyTokensAndText(tokens: readonly Token[], text: string): void;
}
export declare class QueuedTokenReleaseLock {
    private constructor();
    get index(): number;
    duplicate(): QueuedTokenReleaseLock;
    dispose(): void;
    [Symbol.dispose](): void;
}
