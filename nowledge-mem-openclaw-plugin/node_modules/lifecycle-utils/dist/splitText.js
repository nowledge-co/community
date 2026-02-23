/**
 * Split a text by multiple separators, and return a result of the text and separators.
 * For example, `splitText("Hello <and> world [then] !", ["<and>", "[then]"])`
 *   will return `["Hello ", new Separator("<and>"), " world ", new Separator("[then]"), " !"]`
 */
export function splitText(text, separators) {
    if (separators.length === 0)
        return [text];
    const separatorsFindTree = separatorsToFindTree(separators);
    const activeChecks = [];
    const textIndexToLowestSeparatorIndex = new Map();
    const finalPartRanges = [];
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        activeChecks.unshift({
            currentNode: separatorsFindTree,
            startIndex: i,
            conflictedBy: []
        });
        let rangeToAdd = null;
        for (let j = 0; j < activeChecks.length; j++) {
            const activeCheck = activeChecks[j];
            const nextNode = activeCheck.currentNode.next.get(char);
            if (nextNode == null) {
                activeChecks.splice(j, 1);
                j--;
                continue;
            }
            if (nextNode.separator != null && nextNode.separatorIndex != null) {
                if (!textIndexToLowestSeparatorIndex.has(activeCheck.startIndex) ||
                    nextNode.separatorIndex < textIndexToLowestSeparatorIndex.get(activeCheck.startIndex))
                    textIndexToLowestSeparatorIndex.set(activeCheck.startIndex, nextNode.separatorIndex);
                if (rangeToAdd == null || nextNode.separatorIndex < rangeToAdd.separatorIndex)
                    rangeToAdd = {
                        textStartIndex: activeCheck.startIndex,
                        separatorIndex: nextNode.separatorIndex,
                        conflictedBy: activeCheck.conflictedBy.slice()
                    };
            }
            activeCheck.currentNode = nextNode;
        }
        if (rangeToAdd != null) {
            if (activeChecks.length > 0) {
                for (const activeCheck of activeChecks) {
                    rangeToAdd.conflictedBy.push(activeCheck.startIndex);
                    activeCheck.conflictedBy.push(rangeToAdd.textStartIndex);
                }
            }
            finalPartRanges.push(rangeToAdd);
        }
    }
    const res = [];
    let lastEndIndex = 0;
    for (const range of finalPartRanges) {
        const isConflicted = range.conflictedBy.some((textIndex) => {
            const conflictedByIndexSeparatorIndex = textIndexToLowestSeparatorIndex.get(textIndex);
            if (conflictedByIndexSeparatorIndex == null)
                return false;
            return conflictedByIndexSeparatorIndex < range.separatorIndex;
        });
        if (isConflicted)
            continue;
        if (lastEndIndex < range.textStartIndex)
            res.push(text.slice(lastEndIndex, range.textStartIndex));
        res.push(Separator._create(separators[range.separatorIndex]));
        lastEndIndex = range.textStartIndex + separators[range.separatorIndex].length;
    }
    if (lastEndIndex < text.length)
        res.push(text.slice(lastEndIndex));
    if (res.length === 0 && text.length === 0)
        res.push("");
    return res;
}
export class Separator {
    separator;
    constructor(separator) {
        this.separator = separator;
    }
    /** @internal */
    static _create(separator) {
        return new Separator(separator);
    }
}
function separatorsToFindTree(separators) {
    const root = { next: new Map() };
    for (let i = 0; i < separators.length; i++) {
        const separator = separators[i];
        let node = root;
        for (let j = 0; j < separator.length; j++) {
            const char = separator[j];
            if (!node.next.has(char))
                node.next.set(char, { next: new Map() });
            node = node.next.get(char);
        }
        if (node.separator == null) {
            node.separator = separator;
            node.separatorIndex = i;
        }
    }
    return root;
}
//# sourceMappingURL=splitText.js.map