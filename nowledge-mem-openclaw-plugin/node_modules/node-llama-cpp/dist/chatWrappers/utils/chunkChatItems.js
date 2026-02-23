import { LlamaText } from "../../utils/LlamaText.js";
export function chunkChatItems(chatHistory, { generateModelResponseText, joinAdjacentMessagesOfTheSameType = true }) {
    const resultItems = [];
    let systemTexts = [];
    let userTexts = [];
    let modelTexts = [];
    let currentAggregateFocus = null;
    function flush() {
        if (systemTexts.length > 0 || userTexts.length > 0 || modelTexts.length > 0)
            resultItems.push({
                system: LlamaText.joinValues("\n\n", systemTexts),
                user: LlamaText.joinValues("\n\n", userTexts),
                model: LlamaText.joinValues("\n\n", modelTexts)
            });
        systemTexts = [];
        userTexts = [];
        modelTexts = [];
    }
    for (const item of chatHistory) {
        if (item.type === "system") {
            if (!joinAdjacentMessagesOfTheSameType || currentAggregateFocus !== "system")
                flush();
            currentAggregateFocus = "system";
            systemTexts.push(LlamaText.fromJSON(item.text));
        }
        else if (item.type === "user") {
            if (!joinAdjacentMessagesOfTheSameType || (currentAggregateFocus !== "system" && currentAggregateFocus !== "user"))
                flush();
            currentAggregateFocus = "user";
            userTexts.push(LlamaText(item.text));
        }
        else if (item.type === "model") {
            if (!joinAdjacentMessagesOfTheSameType)
                flush();
            currentAggregateFocus = "model";
            modelTexts.push(generateModelResponseText(item.response));
        }
        else
            void item;
    }
    flush();
    return resultItems;
}
//# sourceMappingURL=chunkChatItems.js.map