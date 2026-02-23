import { ChatHistoryItem, ChatModelResponse } from "../../types.js";
import { LlamaText } from "../../utils/LlamaText.js";
export declare function chunkChatItems(chatHistory: readonly ChatHistoryItem[], { generateModelResponseText, joinAdjacentMessagesOfTheSameType }: {
    generateModelResponseText: (modelResponse: ChatModelResponse["response"]) => LlamaText;
    joinAdjacentMessagesOfTheSameType?: boolean;
}): {
    system: LlamaText;
    user: LlamaText;
    model: LlamaText;
}[];
