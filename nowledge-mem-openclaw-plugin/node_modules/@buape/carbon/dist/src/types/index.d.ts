import type { APIActionRowComponent, APIAllowedMentions, APIAttachment, APIComponentInLabel, APIComponentInModalActionRow, APILabelComponent, APIModalComponent, APIModalInteractionResponseCallbackData, APITextDisplayComponent } from "discord-api-types/v10";
import type { BaseComponentInteraction } from "../abstracts/BaseComponentInteraction.js";
import type { BaseMessageInteractiveComponent } from "../abstracts/BaseMessageInteractiveComponent.js";
import type { Container } from "../classes/components/Container.js";
import type { File } from "../classes/components/File.js";
import type { MediaGallery } from "../classes/components/MediaGallery.js";
import type { Row } from "../classes/components/Row.js";
import type { Section } from "../classes/components/Section.js";
import type { Separator } from "../classes/components/Separator.js";
import type { TextDisplay } from "../classes/components/TextDisplay.js";
import type { Embed } from "../classes/Embed.js";
import type { CommandInteraction } from "../internals/CommandInteraction.js";
export type ComponentParserResult = {
    key: string;
    data: Record<string, string | number | boolean>;
};
export type ComponentData<T extends keyof ComponentParserResult["data"] = keyof ComponentParserResult["data"]> = {
    [K in T]: ComponentParserResult["data"][K];
};
export type AllowedMentions = APIAllowedMentions;
/**
 * A function that takes a command interaction and returns a boolean value
 */
export type ConditionalCommandOption = (interaction: CommandInteraction) => boolean;
/**
 * A function that takes a component interaction and returns a boolean value
 */
export type ConditionalComponentOption = (interaction: BaseComponentInteraction) => boolean;
export type APILabelComponent2 = Omit<APILabelComponent, "component"> & {
    component: APIComponentInLabel | import("discord-api-types/v10").APICheckboxActionComponent | import("discord-api-types/v10").APICheckboxGroupActionComponent | import("discord-api-types/v10").APIRadioGroupActionComponent;
};
export type APIModalInteractionResponseCallbackComponent2 = APIActionRowComponent<APIComponentInModalActionRow> | APILabelComponent2 | APITextDisplayComponent;
export type APIModalInteractionResponseCallbackData2 = Omit<APIModalInteractionResponseCallbackData, "components"> & {
    components: APIModalInteractionResponseCallbackComponent2[];
};
export type TopLevelComponents = Row<BaseMessageInteractiveComponent> | Container | File | MediaGallery | Section | Separator | TextDisplay;
export type PollSendPayload = {
    question: {
        /**
         * The text of the question, up to 300 characters
         */
        text?: string;
    };
    answers: {
        /**
         * The text of the answer, up to 55 characters
         */
        text?: string;
        /**
         * The emoji of the answer.
         * When creating a poll answer with an emoji,
         * you only need to send either the id (custom emoji) or name (default emoji) as the only field.
         */
        emoji?: {
            name: string;
            id: string;
        };
    }[];
    /**
     * The time in seconds before the poll expires.
     */
    expiry: number;
    /**
     * Whether the poll allows multiple answers
     */
    allowMultiselect: boolean;
    /**
     * The layout type of the poll.
     * Currently only 1 is supported, and will be set by default.
     * @default 1
     */
    layoutType?: 1;
};
export type MessagePayloadObject = {
    /**
     * The content of the message
     */
    content?: string;
    /**
     * The embeds of the message
     */
    embeds?: Embed[];
    /**
     * The components to send in the message
     */
    components?: TopLevelComponents[];
    /**
     * The settings for which mentions are allowed in the message
     */
    allowedMentions?: AllowedMentions;
    /**
     * The flags for the message
     */
    flags?: number;
    /**
     * Whether the message should be TTS
     */
    tts?: boolean;
    /**
     * The files to send in the message
     */
    files?: MessagePayloadFile[];
    /**
     * The poll to send in the message
     */
    poll?: PollSendPayload;
    /**
     * Whether the message should be ephemeral (shorthand for MessageFlags.Ephemeral)
     */
    ephemeral?: boolean;
    /**
     * The stickers to send in the message
     */
    stickers?: [string, string, string] | [string, string] | [string];
};
/**
 * The data that is sent to Discord when sending a message.
 * If you pass just a string, it will be treated as the content of the message.
 */
export type MessagePayload = string | MessagePayloadObject;
/**
 * The data for a file to send in an interaction
 */
export type MessagePayloadFile = {
    /**
     * The name of the file that will be given to Discord
     */
    name: string;
    /**
     * The data of the file in a Blob
     */
    data: Blob;
    /**
     * The alt text of the file, shown for accessibility
     */
    description?: string;
};
export type VoiceState = {
    guildId?: string;
    channelId: string | null;
    userId: string;
    sessionId: string;
    deaf: boolean;
    mute: boolean;
    selfDeaf: boolean;
    selfMute: boolean;
    selfStream: boolean;
    selfVideo: boolean;
    suppress: boolean;
    requestToSpeakTimestamp: string | null;
};
export type ResolvedFile = APIAttachment;
export type BaseMessageInteractiveComponentConstructor = new (...args: any[]) => BaseMessageInteractiveComponent;
export type ArrayOrSingle<T> = T | T[];
export type IfPartial<T, U, V = U | undefined> = T extends true ? V : U;
export * from "./listeners.js";
declare module "discord-api-types/v10" {
    type APIModalComponent2 = APIModalComponent | APILabelComponent2 | APICheckboxActionComponent | APICheckboxGroupActionComponent | APIRadioGroupActionComponent;
    enum ComponentType {
        RadioGroup = 21,
        CheckboxGroup = 22,
        Checkbox = 23
    }
    interface APIRadioGroupActionComponent {
        type: 21;
        id?: number;
        custom_id: string;
        options: APIRadioGroupOption[];
        required?: boolean;
    }
    interface APIRadioGroupOption {
        value: string;
        label: string;
        description?: string;
        default?: boolean;
    }
    interface APICheckboxGroupActionComponent {
        type: 22;
        id?: number;
        custom_id: string;
        options: APICheckboxGroupOption[];
        min_values?: number;
        max_values?: number;
        required?: boolean;
    }
    interface APICheckboxGroupOption {
        value: string;
        label: string;
        description?: string;
        default?: boolean;
    }
    interface APICheckboxActionComponent {
        type: 23;
        id?: number;
        custom_id: string;
        default?: boolean;
    }
}
//# sourceMappingURL=index.d.ts.map