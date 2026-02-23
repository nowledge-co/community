export declare class ReplHistory {
    private readonly _filePath;
    private _fileContent;
    private constructor();
    add(line: string): Promise<void>;
    get history(): readonly string[];
    private _addItemToHistory;
    static load(filePath: string, saveAndLoadHistory?: boolean): Promise<ReplHistory>;
}
