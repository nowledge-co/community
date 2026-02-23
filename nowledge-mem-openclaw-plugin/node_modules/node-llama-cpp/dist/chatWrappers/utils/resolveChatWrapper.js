import { parseModelFileName } from "../../utils/parseModelFileName.js";
import { Llama3ChatWrapper } from "../Llama3ChatWrapper.js";
import { Llama2ChatWrapper } from "../Llama2ChatWrapper.js";
import { ChatMLChatWrapper } from "../ChatMLChatWrapper.js";
import { GeneralChatWrapper } from "../GeneralChatWrapper.js";
import { FalconChatWrapper } from "../FalconChatWrapper.js";
import { FunctionaryChatWrapper } from "../FunctionaryChatWrapper.js";
import { AlpacaChatWrapper } from "../AlpacaChatWrapper.js";
import { GemmaChatWrapper } from "../GemmaChatWrapper.js";
import { JinjaTemplateChatWrapper } from "../generic/JinjaTemplateChatWrapper.js";
import { TemplateChatWrapper } from "../generic/TemplateChatWrapper.js";
import { getConsoleLogPrefix } from "../../utils/getConsoleLogPrefix.js";
import { Llama3_1ChatWrapper } from "../Llama3_1ChatWrapper.js";
import { Llama3_2LightweightChatWrapper } from "../Llama3_2LightweightChatWrapper.js";
import { DeepSeekChatWrapper } from "../DeepSeekChatWrapper.js";
import { MistralChatWrapper } from "../MistralChatWrapper.js";
import { includesText } from "../../utils/includesText.js";
import { LlamaModel } from "../../evaluator/LlamaModel/LlamaModel.js";
import { QwenChatWrapper } from "../QwenChatWrapper.js";
import { HarmonyChatWrapper } from "../HarmonyChatWrapper.js";
import { SeedChatWrapper } from "../SeedChatWrapper.js";
import { isJinjaTemplateEquivalentToSpecializedChatWrapper } from "./isJinjaTemplateEquivalentToSpecializedChatWrapper.js";
import { getModelLinageNames } from "./getModelLinageNames.js";
export const specializedChatWrapperTypeNames = Object.freeze([
    "general", "deepSeek", "qwen", "llama3.2-lightweight", "llama3.1", "llama3", "llama2Chat", "mistral", "alpacaChat", "functionary",
    "chatML", "falconChat", "gemma", "harmony", "seed"
]);
export const templateChatWrapperTypeNames = Object.freeze([
    "template", "jinjaTemplate"
]);
export const resolvableChatWrapperTypeNames = Object.freeze([
    "auto",
    ...specializedChatWrapperTypeNames,
    ...templateChatWrapperTypeNames
]);
export const chatWrappers = Object.freeze({
    "general": GeneralChatWrapper,
    "deepSeek": DeepSeekChatWrapper,
    "qwen": QwenChatWrapper,
    "llama3.1": Llama3_1ChatWrapper,
    "llama3.2-lightweight": Llama3_2LightweightChatWrapper,
    "llama3": Llama3ChatWrapper,
    "llama2Chat": Llama2ChatWrapper,
    "mistral": MistralChatWrapper,
    "alpacaChat": AlpacaChatWrapper,
    "functionary": FunctionaryChatWrapper,
    "chatML": ChatMLChatWrapper,
    "falconChat": FalconChatWrapper,
    "gemma": GemmaChatWrapper,
    "harmony": HarmonyChatWrapper,
    "seed": SeedChatWrapper,
    "template": TemplateChatWrapper,
    "jinjaTemplate": JinjaTemplateChatWrapper
});
const chatWrapperToConfigType = new Map(Object.entries(chatWrappers)
    .map(([configType, Wrapper]) => ([Wrapper, configType])));
const specializedChatWrapperRelatedTexts = {
    "harmony": ["gpt", "gpt-oss"]
};
export function resolveChatWrapper(options, modelOptions) {
    if (options instanceof LlamaModel)
        return resolveChatWrapper({
            ...(modelOptions ?? {}),
            customWrapperSettings: modelOptions?.customWrapperSettings,
            bosString: options.tokens.bosString,
            filename: options.filename,
            fileInfo: options.fileInfo,
            tokenizer: options.tokenizer
        }) ?? new GeneralChatWrapper();
    const { type = "auto", bosString, filename, fileInfo, tokenizer, customWrapperSettings, warningLogs = true, fallbackToOtherWrappersOnJinjaError = true, noJinja = false } = options;
    function createSpecializedChatWrapper(specializedChatWrapper, defaultSettings = {}) {
        const chatWrapperConfigType = chatWrapperToConfigType.get(specializedChatWrapper);
        const chatWrapperSettings = customWrapperSettings?.[chatWrapperConfigType];
        return new specializedChatWrapper({
            ...(defaultSettings ?? {}),
            ...(chatWrapperSettings ?? {})
        });
    }
    if (type !== "auto" && type != null) {
        if (isTemplateChatWrapperType(type)) {
            const Wrapper = chatWrappers[type];
            if (isClassReference(Wrapper, TemplateChatWrapper)) {
                const wrapperSettings = customWrapperSettings?.template;
                if (wrapperSettings == null || wrapperSettings?.template == null || wrapperSettings?.historyTemplate == null ||
                    wrapperSettings.historyTemplate.system == null || wrapperSettings.historyTemplate.user == null ||
                    wrapperSettings.historyTemplate.model == null) {
                    if (warningLogs)
                        console.warn(getConsoleLogPrefix() + "Template chat wrapper settings must have a template, historyTemplate, historyTemplate.system, historyTemplate.user, and historyTemplate.model. Falling back to resolve other chat wrapper types.");
                }
                else
                    return new TemplateChatWrapper(wrapperSettings);
            }
            else if (isClassReference(Wrapper, JinjaTemplateChatWrapper)) {
                const jinjaTemplate = customWrapperSettings?.jinjaTemplate?.template ?? fileInfo?.metadata?.tokenizer?.chat_template;
                if (jinjaTemplate == null) {
                    if (warningLogs)
                        console.warn(getConsoleLogPrefix() + "Jinja template chat wrapper received no template. Falling back to resolve other chat wrapper types.");
                }
                else {
                    try {
                        return new JinjaTemplateChatWrapper({
                            tokenizer,
                            ...(customWrapperSettings?.jinjaTemplate ?? {}),
                            template: jinjaTemplate
                        });
                    }
                    catch (err) {
                        if (!fallbackToOtherWrappersOnJinjaError)
                            throw err;
                        else if (warningLogs)
                            console.error(getConsoleLogPrefix() + "Error creating Jinja template chat wrapper. Falling back to resolve other chat wrappers. Error:", err);
                    }
                }
            }
            else
                void Wrapper;
        }
        else if (Object.hasOwn(chatWrappers, type)) {
            const Wrapper = chatWrappers[type];
            const wrapperSettings = customWrapperSettings?.[type];
            return new Wrapper(wrapperSettings);
        }
    }
    const modelJinjaTemplate = customWrapperSettings?.jinjaTemplate?.template ?? fileInfo?.metadata?.tokenizer?.chat_template;
    if (modelJinjaTemplate != null && modelJinjaTemplate.trim() !== "") {
        const jinjaTemplateChatWrapperOptions = {
            tokenizer,
            ...(customWrapperSettings?.jinjaTemplate ?? {}),
            template: modelJinjaTemplate
        };
        const chatWrapperNamesToCheck = orderChatWrapperNamesByAssumedCompatibilityWithModel(specializedChatWrapperTypeNames, { filename, fileInfo });
        for (const specializedChatWrapperTypeName of chatWrapperNamesToCheck) {
            const Wrapper = chatWrappers[specializedChatWrapperTypeName];
            const wrapperSettings = customWrapperSettings?.[specializedChatWrapperTypeName];
            const isCompatible = Wrapper._checkModelCompatibility({
                tokenizer,
                fileInfo
            });
            if (!isCompatible)
                continue;
            const testOptionConfigurations = Wrapper._getOptionConfigurationsToTestIfCanSupersedeJinjaTemplate?.() ?? [];
            if (testOptionConfigurations.length === 0)
                testOptionConfigurations.push({});
            for (const testConfigurationOrPair of testOptionConfigurations) {
                const testConfig = testConfigurationOrPair instanceof Array
                    ? (testConfigurationOrPair[0] ?? {})
                    : testConfigurationOrPair;
                const applyConfig = testConfigurationOrPair instanceof Array
                    ? (testConfigurationOrPair[1] ?? {})
                    : testConfigurationOrPair;
                const additionalJinjaOptions = testConfigurationOrPair instanceof Array
                    ? testConfigurationOrPair[2]
                    : undefined;
                const testChatWrapperSettings = {
                    ...(wrapperSettings ?? {}),
                    ...(testConfig ?? {})
                };
                const applyChatWrapperSettings = {
                    ...(wrapperSettings ?? {}),
                    ...(applyConfig ?? {})
                };
                const chatWrapper = new Wrapper(testChatWrapperSettings);
                const jinjaTemplateChatWrapperOptionsWithAdditionalParameters = {
                    ...(additionalJinjaOptions ?? {}),
                    ...jinjaTemplateChatWrapperOptions,
                    additionalRenderParameters: additionalJinjaOptions?.additionalRenderParameters == null
                        ? jinjaTemplateChatWrapperOptions.additionalRenderParameters
                        : {
                            ...(jinjaTemplateChatWrapperOptions.additionalRenderParameters ?? {}),
                            ...additionalJinjaOptions.additionalRenderParameters
                        }
                };
                if (isJinjaTemplateEquivalentToSpecializedChatWrapper(jinjaTemplateChatWrapperOptionsWithAdditionalParameters, chatWrapper, tokenizer))
                    return new Wrapper(applyChatWrapperSettings);
            }
        }
        if (!noJinja) {
            if (!fallbackToOtherWrappersOnJinjaError)
                return new JinjaTemplateChatWrapper(jinjaTemplateChatWrapperOptions);
            try {
                return new JinjaTemplateChatWrapper(jinjaTemplateChatWrapperOptions);
            }
            catch (err) {
                console.error(getConsoleLogPrefix() + "Error creating Jinja template chat wrapper. Falling back to resolve other chat wrappers. Error:", err);
            }
        }
    }
    for (const modelNames of getModelLinageNames(fileInfo?.metadata)) {
        if (includesText(modelNames, ["llama 3.2", "llama-3.2", "llama3.2"]) && Llama3_2LightweightChatWrapper._checkModelCompatibility({ tokenizer, fileInfo }))
            return createSpecializedChatWrapper(Llama3_2LightweightChatWrapper);
        else if (includesText(modelNames, ["llama 3.1", "llama-3.1", "llama3.1"]) && Llama3_1ChatWrapper._checkModelCompatibility({ tokenizer, fileInfo }))
            return createSpecializedChatWrapper(Llama3_1ChatWrapper);
        else if (includesText(modelNames, ["llama 3", "llama-3", "llama3"]))
            return createSpecializedChatWrapper(Llama3ChatWrapper);
        else if (includesText(modelNames, ["Mistral", "Mistral Large", "Mistral Large Instruct", "Mistral-Large", "Codestral"]))
            return createSpecializedChatWrapper(MistralChatWrapper);
        else if (includesText(modelNames, ["Gemma", "Gemma 2"]))
            return createSpecializedChatWrapper(GemmaChatWrapper);
        else if (includesText(modelNames, ["gpt-oss", "Gpt Oss", "Gpt-Oss", "openai_gpt-oss", "Openai_Gpt Oss", "openai.gpt-oss", "Openai.Gpt Oss"]))
            return createSpecializedChatWrapper(HarmonyChatWrapper);
        else if (includesText(modelNames, ["seed-oss", "Seed Oss", "Seed OSS", "Seed-Oss", "Seed-OSS", "ByteDance-Seed_Seed-OSS", "ByteDance-Seed.Seed-OSS"]))
            return createSpecializedChatWrapper(SeedChatWrapper);
    }
    // try to find a pattern in the Jinja template to resolve to a specialized chat wrapper,
    // with a logic similar to `llama.cpp`'s `llama_chat_apply_template_internal` function
    if (modelJinjaTemplate != null && modelJinjaTemplate.trim() !== "") {
        if (modelJinjaTemplate.includes("<seed:think>") || (modelJinjaTemplate.includes("<seed:bos>") && modelJinjaTemplate.includes("<seed:eos>")))
            return createSpecializedChatWrapper(SeedChatWrapper);
        else if (modelJinjaTemplate.includes("<|start|>") && modelJinjaTemplate.includes("<|channel|>"))
            return createSpecializedChatWrapper(HarmonyChatWrapper);
        else if (modelJinjaTemplate.includes("<|im_start|>"))
            return createSpecializedChatWrapper(ChatMLChatWrapper);
        else if (modelJinjaTemplate.includes("[INST]"))
            return createSpecializedChatWrapper(Llama2ChatWrapper, {
                addSpaceBeforeEos: modelJinjaTemplate.includes("' ' + eos_token")
            });
        else if (modelJinjaTemplate.includes("<|start_header_id|>") && modelJinjaTemplate.includes("<|end_header_id|>")) {
            if (Llama3_1ChatWrapper._checkModelCompatibility({ tokenizer, fileInfo }))
                return createSpecializedChatWrapper(Llama3_1ChatWrapper);
            else
                return createSpecializedChatWrapper(Llama3ChatWrapper);
        }
        else if (modelJinjaTemplate.includes("<start_of_turn>"))
            return createSpecializedChatWrapper(GemmaChatWrapper);
    }
    if (filename != null) {
        const { name, subType, fileType, otherInfo } = parseModelFileName(filename);
        if (fileType?.toLowerCase() === "gguf") {
            const lowercaseName = name?.toLowerCase();
            const lowercaseSubType = subType?.toLowerCase();
            const splitLowercaseSubType = (lowercaseSubType?.split("-") ?? []).concat(otherInfo.map((info) => info.toLowerCase()));
            const firstSplitLowercaseSubType = splitLowercaseSubType[0];
            if (lowercaseName === "llama") {
                if (splitLowercaseSubType.includes("chat"))
                    return createSpecializedChatWrapper(Llama2ChatWrapper);
                return createSpecializedChatWrapper(GeneralChatWrapper);
            }
            else if (lowercaseName === "codellama")
                return createSpecializedChatWrapper(GeneralChatWrapper);
            else if (lowercaseName === "yarn" && firstSplitLowercaseSubType === "llama")
                return createSpecializedChatWrapper(Llama2ChatWrapper);
            else if (lowercaseName === "orca")
                return createSpecializedChatWrapper(ChatMLChatWrapper);
            else if (lowercaseName === "phind" && lowercaseSubType === "codellama")
                return createSpecializedChatWrapper(Llama2ChatWrapper);
            else if (lowercaseName === "mistral")
                return createSpecializedChatWrapper(GeneralChatWrapper);
            else if (firstSplitLowercaseSubType === "llama")
                return createSpecializedChatWrapper(Llama2ChatWrapper);
            else if (lowercaseSubType === "alpaca")
                return createSpecializedChatWrapper(AlpacaChatWrapper);
            else if (lowercaseName === "functionary")
                return createSpecializedChatWrapper(FunctionaryChatWrapper);
            else if (lowercaseName === "dolphin" && splitLowercaseSubType.includes("mistral"))
                return createSpecializedChatWrapper(ChatMLChatWrapper);
            else if (lowercaseName === "gemma")
                return createSpecializedChatWrapper(GemmaChatWrapper);
            else if (splitLowercaseSubType.includes("chatml"))
                return createSpecializedChatWrapper(ChatMLChatWrapper);
        }
    }
    if (bosString !== "" && bosString != null) {
        if ("<s>[INST] <<SYS>>\n".startsWith(bosString)) {
            return createSpecializedChatWrapper(Llama2ChatWrapper);
        }
        else if ("<|im_start|>system\n".startsWith(bosString)) {
            return createSpecializedChatWrapper(ChatMLChatWrapper);
        }
    }
    if (fileInfo != null) {
        const arch = fileInfo.metadata.general?.architecture;
        if (arch === "llama")
            return createSpecializedChatWrapper(GeneralChatWrapper);
        else if (arch === "falcon")
            return createSpecializedChatWrapper(FalconChatWrapper);
        else if (arch === "gemma" || arch === "gemma2")
            return createSpecializedChatWrapper(GemmaChatWrapper);
    }
    return null;
}
export function isSpecializedChatWrapperType(type) {
    return specializedChatWrapperTypeNames.includes(type);
}
export function isTemplateChatWrapperType(type) {
    return templateChatWrapperTypeNames.includes(type);
}
// this is needed because TypeScript guards don't work automatically with class references
function isClassReference(value, classReference) {
    return value === classReference;
}
function orderChatWrapperNamesByAssumedCompatibilityWithModel(chatWrapperNames, { filename, fileInfo }) {
    const rankPoints = {
        modelName: 3,
        modelNamePosition: 4,
        fileName: 2,
        fileNamePosition: 3
    };
    function getPointsForTextMatch(pattern, fullText, existsPoints, positionPoints) {
        if (fullText == null)
            return 0;
        const index = fullText.toLowerCase().indexOf(pattern.toLowerCase());
        if (index >= 0)
            return existsPoints + (((index + 1) / fullText.length) * positionPoints);
        return 0;
    }
    function getPointsForWrapperName(wrapperName, fullText, existsPoints, positionPoints) {
        const additionalNames = specializedChatWrapperRelatedTexts[wrapperName] ?? [];
        return [wrapperName, ...additionalNames]
            .map((pattern) => getPointsForTextMatch(pattern, fullText, existsPoints, positionPoints))
            .reduce((res, item) => Math.max(res, item), 0);
    }
    const modelName = fileInfo?.metadata?.general?.name;
    return chatWrapperNames
        .slice()
        .sort((a, b) => {
        let aPoints = 0;
        let bPoints = 0;
        aPoints += getPointsForWrapperName(a, modelName, rankPoints.modelName, rankPoints.modelNamePosition);
        bPoints += getPointsForWrapperName(b, modelName, rankPoints.modelName, rankPoints.modelNamePosition);
        aPoints += getPointsForWrapperName(a, filename, rankPoints.fileName, rankPoints.fileNamePosition);
        bPoints += getPointsForWrapperName(b, filename, rankPoints.fileName, rankPoints.fileNamePosition);
        return bPoints - aPoints;
    });
}
//# sourceMappingURL=resolveChatWrapper.js.map