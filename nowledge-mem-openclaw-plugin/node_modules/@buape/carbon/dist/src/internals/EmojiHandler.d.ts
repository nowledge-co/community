import { Base } from "../abstracts/Base.js";
import { ApplicationEmoji } from "../structures/Emoji.js";
/**
 * This class is specifically used for application emojis that you manage from the Discord Developer Portal
 */
export declare class EmojiHandler extends Base {
    list(): Promise<ApplicationEmoji[]>;
    get(id: string): Promise<ApplicationEmoji>;
    getByName(name: string): Promise<ApplicationEmoji | undefined>;
    /**
     * Upload a new emoji to the application
     * @param name The name of the emoji
     * @param image The image of the emoji in base64 format
     * @returns The created ApplicationEmoji
     */
    create(name: string, image: string): Promise<ApplicationEmoji>;
    delete(id: string): Promise<void>;
}
//# sourceMappingURL=EmojiHandler.d.ts.map