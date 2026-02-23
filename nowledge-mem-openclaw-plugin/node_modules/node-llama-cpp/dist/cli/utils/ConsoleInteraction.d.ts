export declare const enum ConsoleInteractionKey {
    ctrlC = "\u0003",
    upArrow = "\u001B[A",
    downArrow = "\u001B[B",
    enter = "\r"
}
export declare class ConsoleInteraction {
    constructor({ stdin }?: {
        stdin?: NodeJS.ReadStream;
    });
    get isActive(): boolean;
    start(): void;
    stop(): void;
    onKey(key: string | ConsoleInteractionKey | (string | ConsoleInteractionKey)[], callback: () => void): ConsoleInteractionOnKeyHandle;
    static yesNoQuestion(question: string): Promise<boolean>;
}
export declare class ConsoleInteractionOnKeyHandle {
    private constructor();
    dispose(): void;
    [Symbol.dispose](): void;
    get disposed(): boolean;
}
