/**
 * Represents an embed in a message.
 */
export class Embed {
    /**
     * The title of the embed
     */
    title;
    /**
     * The description of the embed
     */
    description;
    /**
     * The URL of the embed
     */
    url;
    /**
     * The timestamp of the embed
     */
    timestamp;
    /**
     * The color of the embed
     */
    color;
    /**
     * The footer of the embed
     */
    footer;
    /**
     * The image URL of the embed
     */
    image;
    /**
     * The thumbnail URL of the embed
     */
    thumbnail;
    author;
    fields;
    /**
     * Create an embed from an API embed
     */
    constructor(embed) {
        if (embed) {
            this.title = embed.title;
            this.description = embed.description;
            this.url = embed.url;
            this.timestamp = embed.timestamp;
            this.color = embed.color;
            this.footer = embed.footer;
            this.image = embed.image?.url;
            this.thumbnail = embed.thumbnail?.url;
            this.author = embed.author;
            this.fields = embed.fields;
        }
    }
    /**
     * Serialize the embed to an API embed
     * @internal
     */
    serialize() {
        return {
            title: this.title,
            description: this.description,
            url: this.url,
            timestamp: this.timestamp,
            color: this.color,
            footer: this.footer,
            image: this.image ? { url: this.image } : undefined,
            thumbnail: this.thumbnail ? { url: this.thumbnail } : undefined,
            author: this.author,
            fields: this.fields
        };
    }
}
//# sourceMappingURL=Embed.js.map