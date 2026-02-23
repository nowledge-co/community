import lockfile from "proper-lockfile";
import { withLock } from "lifecycle-utils";
import { getConsoleLogPrefix } from "./getConsoleLogPrefix.js";
export const lockfileLockScope = {};
export async function withLockfile({ resourcePath, staleDuration = 1000 * 10, updateInterval = staleDuration / 2, retries = 2 }, callback) {
    return await withLock([lockfileLockScope, resourcePath], async () => {
        let releaseLock;
        let res;
        const lockPromise = lockfile.lock(resourcePath, {
            stale: staleDuration,
            update: updateInterval,
            retries,
            realpath: false
        });
        try {
            releaseLock = await lockPromise;
        }
        catch (err) {
            console.error(getConsoleLogPrefix() + `Failed to acquire lockfile for "${resourcePath}"`, err);
            throw err;
        }
        try {
            res = await callback();
        }
        catch (err) {
            try {
                await releaseLock();
            }
            catch (err) {
                console.error(getConsoleLogPrefix() + `Failed to release lockfile for "${resourcePath}"`, err);
            }
            throw err;
        }
        try {
            await releaseLock();
        }
        catch (err) {
            console.error(getConsoleLogPrefix() + `Failed to release lockfile for "${resourcePath}"`, err);
            throw err;
        }
        return res;
    });
}
//# sourceMappingURL=withLockfile.js.map