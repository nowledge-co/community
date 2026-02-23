import { ChatWrapper } from "../ChatWrapper.js";
import { ChatWrapperGenerateContextStateOptions, ChatWrapperGeneratedContextState, ChatWrapperSettings } from "../types.js";
export declare class GemmaChatWrapper extends ChatWrapper {
    readonly wrapperName: string;
    readonly settings: ChatWrapperSettings;
    generateContextState({ chatHistory, availableFunctions, documentFunctionParams }: ChatWrapperGenerateContextStateOptions): ChatWrapperGeneratedContextState;
}
