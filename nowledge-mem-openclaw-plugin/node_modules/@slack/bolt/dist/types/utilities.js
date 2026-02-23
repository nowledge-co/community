"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRejected = exports.isFulfilled = void 0;
/** Type predicate for use with `Promise.allSettled` for filtering for resolved results. */
const isFulfilled = (p) => p.status === 'fulfilled';
exports.isFulfilled = isFulfilled;
/** Type predicate for use with `Promise.allSettled` for filtering for rejected results. */
const isRejected = (p) => p.status === 'rejected';
exports.isRejected = isRejected;
//# sourceMappingURL=utilities.js.map