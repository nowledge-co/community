export function renderDataLine(dataLine, lineLength = process.stdout.columns - 1) {
    return resizeDataLine(dataLine, lineLength)
        .map(renderDataPart)
        .join("");
}
export function renderDataPart(dataPart) {
    let text = dataPart.fullText;
    if (dataPart.cropper != null) {
        text = dataPart
            .cropper(text, dataPart.size)
            .slice(0, dataPart.size)
            .padEnd(dataPart.size);
    }
    else {
        text = text
            .slice(0, dataPart.size)
            .padEnd(dataPart.size);
    }
    if (dataPart.formatter != null) {
        text = dataPart.formatter(text, dataPart.size);
    }
    return text;
}
// only enlarges parts, doesn't shrink them at the moment
export function resizeDataLine(dataLine, lineLength) {
    const res = dataLine.map((part) => ({ ...part }));
    const currentSize = dataLine.reduce((acc, part) => acc + part.size, 0);
    let sizeLeft = lineLength - currentSize;
    if (sizeLeft <= 0)
        return res;
    for (let i = 0; i < res.length && sizeLeft > 0; i++) {
        const part = res[i];
        if (part.addEndPadding != null) {
            const add = Math.min(part.addEndPadding, sizeLeft);
            part.size += add;
            sizeLeft -= add;
            part.addEndPadding -= add;
            if (part.addEndPadding === 0)
                delete part.addEndPadding;
        }
    }
    while (sizeLeft > 0) {
        const flexBoxCandidates = [];
        let totalFlexbox = 0;
        for (let i = 0; i < res.length; i++) {
            const part = res[i];
            if (part.flex == null)
                continue;
            if (part.maxSize != null && part.size >= part.maxSize)
                continue;
            flexBoxCandidates.push(part);
            totalFlexbox += part.flex;
        }
        flexBoxCandidates.sort((a, b) => a.flex - b.flex);
        if (flexBoxCandidates.length === 0)
            break;
        const sizeLeftSnapshot = sizeLeft;
        for (const part of flexBoxCandidates) {
            let partSize = Math.ceil(sizeLeftSnapshot * (part.flex / totalFlexbox));
            if (part.maxSize != null && partSize + part.size > part.maxSize)
                partSize = part.maxSize - part.size;
            part.size += partSize;
            sizeLeft -= partSize;
        }
    }
    return res;
}
//# sourceMappingURL=data-line.js.map