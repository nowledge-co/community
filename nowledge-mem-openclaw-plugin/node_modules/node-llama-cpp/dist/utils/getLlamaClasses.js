import { LlamaChatSession } from "../evaluator/LlamaChatSession/LlamaChatSession.js";
import { LlamaChat } from "../evaluator/LlamaChat/LlamaChat.js";
import { LlamaCompletion } from "../evaluator/LlamaCompletion.js";
let cachedClasses = undefined;
export function getLlamaClasses() {
    if (cachedClasses == null)
        cachedClasses = Object.seal({
            LlamaChatSession,
            LlamaChat,
            LlamaCompletion
        });
    return cachedClasses;
}
//# sourceMappingURL=getLlamaClasses.js.map