const DEFAULT_IGNORE_PATTERNS = [
    /(?:^|[\\/])node_modules[\\/].*tslog/i,
    /(?:^|[\\/])deps[\\/].*tslog/i,
    /tslog[\\/]+src[\\/]+internal[\\/]/i,
    /tslog[\\/]+src[\\/]BaseLogger/i,
    /tslog[\\/]+src[\\/]index/i,
];
export function splitStackLines(error) {
    const stack = typeof error?.stack === "string" ? error.stack : undefined;
    if (stack == null || stack.length === 0) {
        return [];
    }
    return stack.split("\n").map((line) => line.trimEnd());
}
export function sanitizeStackLines(lines) {
    return lines.filter((line) => line.length > 0 && !/^\s*Error\b/.test(line));
}
export function toStackFrames(lines, parseLine) {
    const frames = [];
    for (const line of lines) {
        const frame = parseLine(line);
        if (frame != null) {
            frames.push(frame);
        }
    }
    return frames;
}
export function findFirstExternalFrameIndex(frames, ignorePatterns = DEFAULT_IGNORE_PATTERNS) {
    for (let index = 0; index < frames.length; index += 1) {
        const frame = frames[index];
        const filePathCandidate = frame.filePath ?? "";
        const fullPathCandidate = frame.fullFilePath ?? "";
        if (!ignorePatterns.some((pattern) => pattern.test(filePathCandidate) || pattern.test(fullPathCandidate))) {
            return index;
        }
    }
    return 0;
}
export function getFrameAt(frames, index) {
    if (index < 0 || index >= frames.length) {
        return undefined;
    }
    return frames[index];
}
export function getCleanStackLines(error) {
    return sanitizeStackLines(splitStackLines(error));
}
export function buildStackTrace(error, parseLine) {
    return toStackFrames(getCleanStackLines(error), parseLine);
}
export function isIgnorableFrame(frame, ignorePatterns) {
    const filePathCandidate = frame.filePath ?? "";
    const fullPathCandidate = frame.fullFilePath ?? "";
    return ignorePatterns.some((pattern) => pattern.test(filePathCandidate) || pattern.test(fullPathCandidate));
}
export function clampIndex(index, maxExclusive) {
    if (index < 0) {
        return 0;
    }
    if (index >= maxExclusive) {
        return Math.max(0, maxExclusive - 1);
    }
    return index;
}
export function pickCallerStackFrame(error, parseLine, options = {}) {
    const lines = getCleanStackLines(error);
    const frames = toStackFrames(lines, parseLine);
    if (frames.length === 0) {
        return undefined;
    }
    const ignorePatterns = options.ignorePatterns ?? DEFAULT_IGNORE_PATTERNS;
    const autoIndex = findFirstExternalFrameIndex(frames, ignorePatterns);
    const resolvedIndex = options.stackDepthLevel != null ? options.stackDepthLevel : autoIndex;
    return getFrameAt(frames, clampIndex(resolvedIndex, frames.length));
}
export function getDefaultIgnorePatterns() {
    return [...DEFAULT_IGNORE_PATTERNS];
}
