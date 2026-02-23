import type { Tool as OpenAITool, ResponseCreateParamsStreaming, ResponseInput, ResponseStreamEvent } from "openai/resources/responses/responses.js";
import type { Api, AssistantMessage, Context, Model, Tool, Usage } from "../types.js";
import type { AssistantMessageEventStream } from "../utils/event-stream.js";
export interface OpenAIResponsesStreamOptions {
    serviceTier?: ResponseCreateParamsStreaming["service_tier"];
    applyServiceTierPricing?: (usage: Usage, serviceTier: ResponseCreateParamsStreaming["service_tier"] | undefined) => void;
}
export interface ConvertResponsesMessagesOptions {
    includeSystemPrompt?: boolean;
}
export interface ConvertResponsesToolsOptions {
    strict?: boolean | null;
}
export declare function convertResponsesMessages<TApi extends Api>(model: Model<TApi>, context: Context, allowedToolCallProviders: ReadonlySet<string>, options?: ConvertResponsesMessagesOptions): ResponseInput;
export declare function convertResponsesTools(tools: Tool[], options?: ConvertResponsesToolsOptions): OpenAITool[];
export declare function processResponsesStream<TApi extends Api>(openaiStream: AsyncIterable<ResponseStreamEvent>, output: AssistantMessage, stream: AssistantMessageEventStream, model: Model<TApi>, options?: OpenAIResponsesStreamOptions): Promise<void>;
//# sourceMappingURL=openai-responses-shared.d.ts.map