"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSource = void 0;
const STAT_LEN = 16;
/**
 * Creates an update source based on the given update supplier.
 *
 * @param supplier An update supplier to use for requesting updates
 * @returns An update source
 */
function createSource(supplier, options = {}) {
    const { speedTrafficBalance = 0.0, maxDelayMilliseconds = 500 } = options;
    let active = false;
    let endWait = () => { };
    let waitHandle = undefined;
    let controller;
    function deactivate() {
        active = false;
        clearTimeout(waitHandle);
        waitHandle = undefined;
        endWait();
    }
    let updateGenerator = worker();
    let pace = Infinity;
    const bounded = Math.max(0.0, Math.min(speedTrafficBalance, 1.0)); // [0;1]
    const balance = 100 * bounded / Math.max(1, maxDelayMilliseconds); // number of wanted updates per call
    // We take two cyclic buffers to store update counts and durations
    // for the last STAT_LEN update calls.
    const counts = Array(STAT_LEN).fill(100);
    const durations = Array(STAT_LEN).fill(1);
    // We also keep track of the sum of the values in each buffer
    let totalCounts = 100 * STAT_LEN; // sum of counts
    let totalDuration = 1 * STAT_LEN; // sum of durations
    // Write index for both buffers
    let index = 0;
    /** Records a pair ms/items and estimates the pause length */
    const record = balance === 0
        ? () => 0 // do not perform any tracking if the balance is 0.0
        : (newCount, newDuration) => {
            // save old
            const oldCount = counts[index];
            const oldDuration = durations[index];
            // write to buffer
            counts[index] = newCount;
            durations[index] = newDuration;
            // update sums
            totalCounts += newCount - oldCount;
            totalDuration += newDuration - oldDuration;
            // move index
            index = (index + 1) % STAT_LEN;
            // estimate time to wait, and cap it smoothly at maxDelay
            const estimate = balance * totalDuration / (totalCounts || 1);
            const capped = maxDelayMilliseconds * Math.tanh(estimate);
            return capped;
        };
    async function* worker() {
        active = true;
        do {
            controller = new node_shim_js_1.AbortController();
            controller.signal.addEventListener("abort", deactivate);
            try {
                const pre = Date.now();
                const items = await supplier.supply(pace, controller.signal);
                const post = Date.now();
                yield items;
                const wait = record(items.length, post - pre);
                if (items.length < 100 && wait > 0) {
                    await new Promise((r) => {
                        endWait = r;
                        waitHandle = setTimeout(r, wait);
                    });
                }
            }
            catch (e) {
                if (!controller.signal.aborted)
                    throw e;
                close();
                break;
            }
        } while (active);
    }
    function close() {
        deactivate();
        controller.abort();
        updateGenerator = worker();
        pace = Infinity;
    }
    return {
        generator: () => updateGenerator,
        setGeneratorPace: (newPace) => pace = newPace,
        isActive: () => active,
        close: () => close(),
    };
}
exports.createSource = createSource;
const node_shim_js_1 = require("./node-shim.js");
