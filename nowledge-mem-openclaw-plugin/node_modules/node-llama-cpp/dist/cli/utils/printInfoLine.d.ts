export declare function printInfoLine(options: Parameters<typeof renderInfoLine>[0]): void;
export declare function renderInfoLine({ title, padTitle, separateLines, info, maxWidth }: {
    title?: string;
    padTitle?: number;
    separateLines?: boolean;
    info: Array<{
        title: string;
        value: string | (() => string);
        show?: boolean;
    }>;
    maxWidth?: number;
}): string;
