import process from "process";
import { getPlatform } from "./getPlatform.js";
import { detectAvailableComputeLayers } from "./detectAvailableComputeLayers.js";
let bestComputeLayersAvailablePromise = null;
export async function getBestComputeLayersAvailable() {
    if (bestComputeLayersAvailablePromise != null) {
        try {
            return await bestComputeLayersAvailablePromise;
        }
        catch (err) { }
    }
    bestComputeLayersAvailablePromise = detectBestComputeLayersAvailable();
    return await bestComputeLayersAvailablePromise;
}
export async function detectBestComputeLayersAvailable({ platform = getPlatform(), arch = process.arch, hasCudaWithStaticBinaryBuild = false } = {}) {
    if (platform === "mac" && arch === "arm64")
        return ["metal"];
    const res = [];
    const availableComputeLayers = await detectAvailableComputeLayers({
        platform
    });
    if (availableComputeLayers.cuda.hasNvidiaDriver && (availableComputeLayers.cuda.hasCudaRuntime || hasCudaWithStaticBinaryBuild))
        res.push("cuda");
    if (availableComputeLayers.vulkan)
        res.push("vulkan");
    res.push(false);
    return res;
}
//# sourceMappingURL=getBestComputeLayersAvailable.js.map