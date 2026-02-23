import { ChatHistoryItem, ChatModelFunctions, ChatWrapperSettings } from "../../../types.js";
import { UniqueIdGenerator } from "./UniqueIdGenerator.js";
export declare function extractFunctionCallSettingsFromJinjaTemplate({ idsGenerator, renderTemplate }: {
    idsGenerator: UniqueIdGenerator;
    renderTemplate({}: {
        chatHistory: ChatHistoryItem[];
        functions: ChatModelFunctions;
        additionalParams: Record<string, unknown>;
        stringifyFunctionParams: boolean;
        stringifyFunctionResults: boolean;
        combineModelMessageAndToolCalls: boolean;
        squashModelTextResponses?: boolean;
    }): string;
}): {
    settings: ChatWrapperSettings["functions"] | null;
    stringifyParams: boolean;
    stringifyResult: boolean;
    combineModelMessageAndToolCalls: boolean;
};
