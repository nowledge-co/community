import { type APIPoll, type APIPollAnswer } from "discord-api-types/v10";
import { Base } from "../abstracts/Base.js";
import type { Client } from "../classes/Client.js";
import { Message } from "../index.js";
import { User } from "./User.js";
export declare class Poll extends Base {
    private channelId;
    private messageId;
    protected _rawData: APIPoll;
    constructor(client: Client, { channelId, messageId, data }: {
        channelId: string;
        messageId: string;
        data: APIPoll;
    });
    /**
     * The raw Discord API data for this poll
     */
    get rawData(): Readonly<APIPoll>;
    get question(): import("discord-api-types/v10").APIPollMedia;
    get answers(): ReadonlyArray<APIPollAnswer>;
    get allowMultiselect(): boolean;
    get layoutType(): APIPoll["layout_type"];
    get results(): APIPoll["results"] | undefined;
    get expiry(): string;
    get isFinalized(): boolean;
    getAnswerVoters(answerId: number): Promise<User[]>;
    end(): Promise<Message<false>>;
}
//# sourceMappingURL=Poll.d.ts.map