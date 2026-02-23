import { maximumParallelismStrategy } from "./batchItemsPrioritizationStrategies/maximumParallelismStrategy.js";
import { firstInFirstOutStrategy } from "./batchItemsPrioritizationStrategies/firstInFirstOutStrategy.js";
export function resolveBatchItemsPrioritizationStrategy(strategy) {
    if (strategy instanceof Function)
        return strategy;
    else if (strategy === "maximumParallelism")
        return maximumParallelismStrategy;
    else if (strategy === "firstInFirstOut")
        return firstInFirstOutStrategy;
    void strategy;
    throw new Error(`Unknown batch items prioritize strategy: ${strategy}`);
}
//# sourceMappingURL=resolveBatchItemsPrioritizationStrategy.js.map