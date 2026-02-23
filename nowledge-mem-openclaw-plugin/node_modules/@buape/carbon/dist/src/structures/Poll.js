import { Routes } from "discord-api-types/v10";
import { Base } from "../abstracts/Base.js";
import { Message } from "../index.js";
import { User } from "./User.js";
export class Poll extends Base {
    channelId;
    messageId;
    _rawData;
    constructor(client, { channelId, messageId, data }) {
        super(client);
        this.channelId = channelId;
        this.messageId = messageId;
        this._rawData = data;
    }
    /**
     * The raw Discord API data for this poll
     */
    get rawData() {
        return this._rawData;
    }
    get question() {
        return this._rawData.question;
    }
    get answers() {
        return this._rawData.answers;
    }
    get allowMultiselect() {
        return this._rawData.allow_multiselect;
    }
    get layoutType() {
        return this._rawData.layout_type;
    }
    get results() {
        return this._rawData.results;
    }
    get expiry() {
        return this._rawData.expiry;
    }
    get isFinalized() {
        return this._rawData.results !== undefined;
    }
    async getAnswerVoters(answerId) {
        const usersData = (await this.client.rest.get(Routes.pollAnswerVoters(this.channelId, this.messageId, answerId)));
        return usersData.users.map((userData) => new User(this.client, userData));
    }
    async end() {
        const updatedMessage = (await this.client.rest.post(Routes.expirePoll(this.channelId, this.messageId), {}));
        return new Message(this.client, updatedMessage);
    }
}
//# sourceMappingURL=Poll.js.map