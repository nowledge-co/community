"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bypassThrottler = exports.apiThrottler = exports.BottleneckStrategy = void 0;
const deps_node_js_1 = require("./deps.node.js");
const skipSet = new Set();
const bypassThrottler = async (ctx, next) => {
    let willSkip = true;
    ctx.api.config.use(async (prev, method, payload, signal) => {
        if (!willSkip) {
            return prev(method, payload, signal);
        }
        // Note: Depends on referential equality which is not guaranteed
        willSkip = false;
        skipSet.add(payload);
        try {
            const result = await prev(method, payload, signal);
            return result;
        }
        finally {
            skipSet.delete(payload);
        }
    });
    await next();
};
exports.bypassThrottler = bypassThrottler;
const apiThrottler = (opts = {}) => {
    var _a, _b, _c;
    const globalConfig = (_a = opts.global) !== null && _a !== void 0 ? _a : {
        reservoir: 30,
        reservoirRefreshAmount: 30,
        reservoirRefreshInterval: 1000,
    };
    const groupConfig = (_b = opts.group) !== null && _b !== void 0 ? _b : {
        maxConcurrent: 1,
        minTime: 1000,
        reservoir: 20,
        reservoirRefreshAmount: 20,
        reservoirRefreshInterval: 60000,
    };
    const outConfig = (_c = opts.out) !== null && _c !== void 0 ? _c : {
        maxConcurrent: 1,
        minTime: 1000,
    };
    const globalThrottler = new deps_node_js_1.Bottleneck(globalConfig);
    const groupThrottler = new deps_node_js_1.Bottleneck.Group(groupConfig);
    const outThrottler = new deps_node_js_1.Bottleneck.Group(outConfig);
    groupThrottler.on('created', (throttler) => throttler.chain(globalThrottler));
    outThrottler.on('created', (throttler) => throttler.chain(globalThrottler));
    const transformer = async (prev, method, payload, signal) => {
        if (!payload || !('chat_id' in payload) || skipSet.has(payload)) {
            return prev(method, payload, signal);
        }
        // @ts-ignore
        const chatId = Number(payload.chat_id);
        const isGroup = chatId < 0;
        const throttler = isGroup
            ? groupThrottler.key(`${chatId}`)
            : outThrottler.key(`${chatId}`);
        return throttler.schedule(() => prev(method, payload, signal));
    };
    return transformer;
};
exports.apiThrottler = apiThrottler;
const BottleneckStrategy = deps_node_js_1.Bottleneck.strategy;
exports.BottleneckStrategy = BottleneckStrategy;
