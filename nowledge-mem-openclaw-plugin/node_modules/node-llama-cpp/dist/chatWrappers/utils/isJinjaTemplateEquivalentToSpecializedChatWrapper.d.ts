import { ChatWrapper } from "../../ChatWrapper.js";
import { Tokenizer } from "../../types.js";
import { JinjaTemplateChatWrapperOptions } from "../generic/JinjaTemplateChatWrapper.js";
export declare function isJinjaTemplateEquivalentToSpecializedChatWrapper(jinjaTemplateWrapperOptions: JinjaTemplateChatWrapperOptions, specializedChatWrapper: ChatWrapper, tokenizer?: Tokenizer): boolean;
