"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parentThread = exports.createThread = void 0;
const worker_threads_1 = require("worker_threads");
function createThread(specifier, seed) {
    const worker = new worker_threads_1.Worker(specifier, { workerData: seed });
    return {
        onMessage(callback) {
            worker.on("message", callback);
        },
        postMessage(i) {
            worker.postMessage(i);
        },
    };
}
exports.createThread = createThread;
function parentThread() {
    return {
        seed: Promise.resolve(worker_threads_1.workerData),
        onMessage(callback) {
            worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.on("message", callback);
        },
        postMessage(o) {
            worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.postMessage(o);
        },
    };
}
exports.parentThread = parentThread;
