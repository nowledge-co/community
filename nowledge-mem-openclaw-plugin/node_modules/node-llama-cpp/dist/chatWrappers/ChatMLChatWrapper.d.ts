import { ChatWrapper } from "../ChatWrapper.js";
import { ChatWrapperGenerateContextStateOptions, ChatWrapperGeneratedContextState } from "../types.js";
export declare class ChatMLChatWrapper extends ChatWrapper {
    readonly wrapperName: string;
    generateContextState({ chatHistory, availableFunctions, documentFunctionParams }: ChatWrapperGenerateContextStateOptions): ChatWrapperGeneratedContextState;
}
