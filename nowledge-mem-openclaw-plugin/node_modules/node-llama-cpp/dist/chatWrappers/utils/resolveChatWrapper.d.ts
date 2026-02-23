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
import { Llama3_1ChatWrapper } from "../Llama3_1ChatWrapper.js";
import { Llama3_2LightweightChatWrapper } from "../Llama3_2LightweightChatWrapper.js";
import { DeepSeekChatWrapper } from "../DeepSeekChatWrapper.js";
import { MistralChatWrapper } from "../MistralChatWrapper.js";
import { Tokenizer } from "../../types.js";
import { LlamaModel } from "../../evaluator/LlamaModel/LlamaModel.js";
import { QwenChatWrapper } from "../QwenChatWrapper.js";
import { HarmonyChatWrapper } from "../HarmonyChatWrapper.js";
import { SeedChatWrapper } from "../SeedChatWrapper.js";
import type { GgufFileInfo } from "../../gguf/types/GgufFileInfoTypes.js";
export declare const specializedChatWrapperTypeNames: readonly ["general", "deepSeek", "qwen", "llama3.2-lightweight", "llama3.1", "llama3", "llama2Chat", "mistral", "alpacaChat", "functionary", "chatML", "falconChat", "gemma", "harmony", "seed"];
export type SpecializedChatWrapperTypeName = (typeof specializedChatWrapperTypeNames)[number];
export declare const templateChatWrapperTypeNames: readonly ["template", "jinjaTemplate"];
export type TemplateChatWrapperTypeName = (typeof templateChatWrapperTypeNames)[number];
export declare const resolvableChatWrapperTypeNames: readonly ["auto", "general", "deepSeek", "qwen", "llama3.2-lightweight", "llama3.1", "llama3", "llama2Chat", "mistral", "alpacaChat", "functionary", "chatML", "falconChat", "gemma", "harmony", "seed", "template", "jinjaTemplate"];
export type ResolvableChatWrapperTypeName = (typeof resolvableChatWrapperTypeNames)[number];
export declare const chatWrappers: Readonly<{
    readonly general: typeof GeneralChatWrapper;
    readonly deepSeek: typeof DeepSeekChatWrapper;
    readonly qwen: typeof QwenChatWrapper;
    readonly "llama3.1": typeof Llama3_1ChatWrapper;
    readonly "llama3.2-lightweight": typeof Llama3_2LightweightChatWrapper;
    readonly llama3: typeof Llama3ChatWrapper;
    readonly llama2Chat: typeof Llama2ChatWrapper;
    readonly mistral: typeof MistralChatWrapper;
    readonly alpacaChat: typeof AlpacaChatWrapper;
    readonly functionary: typeof FunctionaryChatWrapper;
    readonly chatML: typeof ChatMLChatWrapper;
    readonly falconChat: typeof FalconChatWrapper;
    readonly gemma: typeof GemmaChatWrapper;
    readonly harmony: typeof HarmonyChatWrapper;
    readonly seed: typeof SeedChatWrapper;
    readonly template: typeof TemplateChatWrapper;
    readonly jinjaTemplate: typeof JinjaTemplateChatWrapper;
}>;
export type BuiltInChatWrapperType = InstanceType<typeof chatWrappers[keyof typeof chatWrappers]>;
export type ResolveChatWrapperOptions = {
    /**
     * Resolve to a specific chat wrapper type.
     * You better not set this option unless you need to force a specific chat wrapper type.
     *
     * Defaults to `"auto"`.
     */
    type?: "auto" | SpecializedChatWrapperTypeName | TemplateChatWrapperTypeName;
    bosString?: string | null;
    filename?: string;
    fileInfo?: GgufFileInfo;
    tokenizer?: Tokenizer;
    customWrapperSettings?: {
        [wrapper in keyof typeof chatWrappers]?: ConstructorParameters<(typeof chatWrappers)[wrapper]>[0];
    };
    /**
     * Defaults to `true`.
     */
    warningLogs?: boolean;
    /**
     * Defaults to `true`.
     */
    fallbackToOtherWrappersOnJinjaError?: boolean;
    /**
     * Don't resolve to a Jinja chat wrapper unless `type` is set to a Jinja chat wrapper type.
     *
     * Defaults to `false`.
     */
    noJinja?: boolean;
};
export type ResolveChatWrapperWithModelOptions = {
    /**
     * Resolve to a specific chat wrapper type.
     * You better not set this option unless you need to force a specific chat wrapper type.
     *
     * Defaults to `"auto"`.
     */
    type?: "auto" | SpecializedChatWrapperTypeName | TemplateChatWrapperTypeName;
    customWrapperSettings?: {
        [wrapper in keyof typeof chatWrappers]?: typeof JinjaTemplateChatWrapper extends (typeof chatWrappers)[wrapper] ? Partial<ConstructorParameters<(typeof chatWrappers)[wrapper]>[0]> : ConstructorParameters<(typeof chatWrappers)[wrapper]>[0];
    };
    /**
     * Defaults to `true`.
     */
    warningLogs?: boolean;
    /**
     * Defaults to `true`.
     */
    fallbackToOtherWrappersOnJinjaError?: boolean;
    /**
     * Don't resolve to a Jinja chat wrapper unless `type` is set to a Jinja chat wrapper type.
     *
     * Defaults to `false`.
     */
    noJinja?: boolean;
};
/**
 * Resolve to a chat wrapper instance based on the provided information.
 * The more information provided, the better the resolution will be (except for `type`).
 *
 * It's recommended to not set `type` to a specific chat wrapper in order for the resolution to be more flexible, but it is useful for when
 * you need to provide the ability to force a specific chat wrapper type.
 * Note that when setting `type` to a generic chat wrapper type (such as `"template"` or `"jinjaTemplate"`), the `customWrapperSettings`
 * must contain the necessary settings for that chat wrapper to be created.
 *
 * When loading a Jinja chat template from either `fileInfo` or `customWrapperSettings.jinjaTemplate.template`,
 * if the chat template format is invalid, it fallbacks to resolve other chat wrappers,
 * unless `fallbackToOtherWrappersOnJinjaError` is set to `false` (in which case, it will throw an error).
 * @example
 * ```typescript
 * import {getLlama, resolveChatWrapper, GeneralChatWrapper} from "node-llama-cpp";
 *
 * const llama = await getLlama();
 * const model = await llama.loadModel({modelPath: "path/to/model.gguf"});
 *
 * const chatWrapper = resolveChatWrapper(model, {
 *     customWrapperSettings: {
 *         "llama3.1": {
 *             cuttingKnowledgeDate: new Date("2025-01-01T00:00:00Z")
 *         }
 *     }
 * }) ?? new GeneralChatWrapper()
 * ```
 * @example
 *```typescript
 * import {getLlama, resolveChatWrapper, GeneralChatWrapper} from "node-llama-cpp";
 *
 * const llama = await getLlama();
 * const model = await llama.loadModel({modelPath: "path/to/model.gguf"});
 *
 * const chatWrapper = resolveChatWrapper({
 *     bosString: model.tokens.bosString,
 *     filename: model.filename,
 *     fileInfo: model.fileInfo,
 *     tokenizer: model.tokenizer
 * }) ?? new GeneralChatWrapper()
 * ```
 */
export declare function resolveChatWrapper(model: LlamaModel, options?: ResolveChatWrapperWithModelOptions): BuiltInChatWrapperType;
export declare function resolveChatWrapper(options: ResolveChatWrapperOptions): BuiltInChatWrapperType | null;
export declare function isSpecializedChatWrapperType(type: string): type is SpecializedChatWrapperTypeName;
export declare function isTemplateChatWrapperType(type: string): type is TemplateChatWrapperTypeName;
