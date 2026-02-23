export declare function findBestOption<const O>({ generator, score }: {
    generator: () => Generator<O>;
    score: (option: O) => number | null;
}): O | null;
