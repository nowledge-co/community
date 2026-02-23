import { Bottleneck } from './deps.node.js';
import type { MiddlewareFn, Transformer } from './deps.node.js';
declare type APIThrottlerOptions = {
    global?: Bottleneck.ConstructorOptions;
    group?: Bottleneck.ConstructorOptions;
    out?: Bottleneck.ConstructorOptions;
};
declare const bypassThrottler: MiddlewareFn;
declare const apiThrottler: (opts?: APIThrottlerOptions) => Transformer;
declare const BottleneckStrategy: {
    readonly LEAK: Bottleneck.Strategy;
    readonly OVERFLOW_PRIORITY: Bottleneck.Strategy;
    readonly OVERFLOW: Bottleneck.Strategy;
    readonly BLOCK: Bottleneck.Strategy;
};
export { BottleneckStrategy };
export type { APIThrottlerOptions };
export { apiThrottler, bypassThrottler };
