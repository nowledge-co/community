"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromiseTimeout = PromiseTimeout;
function PromiseTimeout(timeout) {
    return new Promise(resolve => {
        setTimeout(() => resolve(), timeout);
    });
}
//# sourceMappingURL=promise-utils.js.map