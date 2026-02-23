import { LlamaContext } from "../../evaluator/LlamaContext/LlamaContext.js";
export declare function printCommonInfoLines({ context, draftContext, minTitleLength, useMmap, useDirectIo, logBatchSize, tokenMeterEnabled, printBos, printEos }: {
    context: LlamaContext;
    draftContext?: LlamaContext;
    minTitleLength?: number;
    useMmap?: boolean;
    useDirectIo?: boolean;
    logBatchSize?: boolean;
    tokenMeterEnabled?: boolean;
    printBos?: boolean;
    printEos?: boolean;
}): Promise<number>;
