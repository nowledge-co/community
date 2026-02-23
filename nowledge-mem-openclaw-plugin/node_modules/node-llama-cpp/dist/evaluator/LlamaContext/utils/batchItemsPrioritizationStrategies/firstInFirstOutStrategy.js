export function firstInFirstOutStrategy({ items, size }) {
    const res = [];
    const sortedItems = items
        .slice()
        .sort((a, b) => b.evaluationPriority - a.evaluationPriority);
    let leftFreeTokens = size;
    for (const item of sortedItems) {
        const processAmount = Math.min(item.tokens.length, leftFreeTokens);
        res.push({ item, processAmount });
        leftFreeTokens -= processAmount;
        if (leftFreeTokens === 0)
            break;
    }
    return res;
}
//# sourceMappingURL=firstInFirstOutStrategy.js.map