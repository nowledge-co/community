export function getRamUsageFromUnifiedVram(vramUsage, vramState) {
    const onlyVramSize = vramState.total - vramState.unifiedSize;
    const existingUsage = Math.max(0, vramState.total - vramState.free);
    const unifiedRamUsage = Math.min(vramState.unifiedSize, Math.max(0, vramUsage - Math.max(0, onlyVramSize - existingUsage)));
    return unifiedRamUsage;
}
//# sourceMappingURL=getRamUsageFromUnifiedVram.js.map