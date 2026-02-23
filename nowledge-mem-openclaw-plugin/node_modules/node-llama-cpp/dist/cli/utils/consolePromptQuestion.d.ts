export declare function consolePromptQuestion(question: string, { validate, renderSummaryOnExit, exitOnCtrlC, defaultValue }?: {
    validate?: (input: string) => string | null | Promise<string | null>;
    renderSummaryOnExit?: (item: string | null) => string;
    exitOnCtrlC?: boolean;
    defaultValue?: string;
}): Promise<string | null>;
