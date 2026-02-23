import { LlamaChatSession } from "../evaluator/LlamaChatSession/LlamaChatSession.js";
import { LlamaChat } from "../evaluator/LlamaChat/LlamaChat.js";
import { LlamaCompletion } from "../evaluator/LlamaCompletion.js";
export type LlamaClasses = {
    readonly LlamaChatSession: typeof LlamaChatSession;
    readonly LlamaChat: typeof LlamaChat;
    readonly LlamaCompletion: typeof LlamaCompletion;
};
export declare function getLlamaClasses(): LlamaClasses;
