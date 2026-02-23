export type ModuleSpecifier = string;
export interface Thread<I, O> {
    onMessage: (callback: (o: O) => void | Promise<void>) => void;
    postMessage: (i: I) => void | Promise<void>;
}
interface Seed<S> {
    seed: Promise<S>;
}
export declare function createThread<I, O, S>(specifier: ModuleSpecifier, seed: S): Thread<I, O>;
export declare function parentThread<I, O, S>(): Thread<I, O> & Seed<S>;
export {};
