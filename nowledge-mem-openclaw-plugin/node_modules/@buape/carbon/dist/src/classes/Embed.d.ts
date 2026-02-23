import type { APIEmbed } from "discord-api-types/v10";
/**
 * Represents an embed in a message.
 */
export declare class Embed {
    /**
     * The title of the embed
     */
    title?: string;
    /**
     * The description of the embed
     */
    description?: string;
    /**
     * The URL of the embed
     */
    url?: string;
    /**
     * The timestamp of the embed
     */
    timestamp?: string;
    /**
     * The color of the embed
     */
    color?: number;
    /**
     * The footer of the embed
     */
    footer?: {
        text: string;
        icon_url?: string;
    };
    /**
     * The image URL of the embed
     */
    image?: string;
    /**
     * The thumbnail URL of the embed
     */
    thumbnail?: string;
    author?: {
        name: string;
        url?: string;
        icon_url?: string;
    };
    fields?: {
        name: string;
        value: string;
        inline?: boolean;
    }[];
    /**
     * Create an embed from an API embed
     */
    constructor(embed?: APIEmbed);
    /**
     * Serialize the embed to an API embed
     * @internal
     */
    serialize(): APIEmbed;
}
//# sourceMappingURL=Embed.d.ts.map