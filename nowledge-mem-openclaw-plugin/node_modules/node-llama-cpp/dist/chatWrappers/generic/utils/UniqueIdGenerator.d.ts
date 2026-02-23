export declare class UniqueIdGenerator {
    readonly antiText: string;
    private readonly _ids;
    constructor(antiText: string);
    generateId(numbersOnly?: boolean): string;
    removeId(id: string): void;
}
