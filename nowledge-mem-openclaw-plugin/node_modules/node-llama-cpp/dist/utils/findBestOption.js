export function findBestOption({ generator, score }) {
    let bestOption = null;
    let bestScore = null;
    for (const option of generator()) {
        const currentScore = score(option);
        if (currentScore === Infinity)
            return option;
        if (currentScore != null && (bestScore == null || currentScore > bestScore)) {
            bestOption = option;
            bestScore = currentScore;
        }
    }
    return bestOption;
}
//# sourceMappingURL=findBestOption.js.map