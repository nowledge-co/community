import { ApplicationCommandOptionType } from "discord-api-types/v10";
import { Base } from "../abstracts/Base.js";
import { Guild, GuildMember, Role, User } from "../index.js";
/**
 * This class is used to parse the options of a command, and provide errors for any missing or invalid options.
 * It is used internally by the Command class.
 */
export class OptionsHandler extends Base {
    /**
     * The raw options that were in the interaction data, before they were parsed.
     */
    raw;
    /**
     * The resolved data from the interaction.
     */
    resolved;
    guildId;
    interactionData;
    definitions;
    constructor({ client, options, interactionData, definitions, guildId }) {
        super(client);
        this.raw = [];
        this.interactionData = interactionData;
        this.definitions = definitions;
        this.resolved = interactionData.resolved ?? {};
        this.guildId = guildId;
        for (const option of options) {
            if (option.type === ApplicationCommandOptionType.Subcommand) {
                for (const subOption of option.options ?? []) {
                    this.raw.push(subOption);
                }
            }
            else if (option.type === ApplicationCommandOptionType.SubcommandGroup) {
                for (const subOption of option.options ?? []) {
                    if (subOption.options) {
                        for (const subSubOption of subOption.options ?? []) {
                            this.raw.push(subSubOption);
                        }
                    }
                }
            }
            else {
                this.raw.push(option);
            }
        }
    }
    getString(key, required = false) {
        const value = this.raw.find((x) => x.name === key && x.type === ApplicationCommandOptionType.String)?.value;
        if (required) {
            if (!value || typeof value !== "string")
                throw new Error(`Missing required option: ${key}`);
        }
        else if (!value || typeof value !== "string")
            return undefined;
        this.checkAgainstDefinition(key, value);
        return value;
    }
    getInteger(key, required = false) {
        const value = this.raw.find((x) => x.name === key && x.type === ApplicationCommandOptionType.Integer)?.value;
        if (required) {
            if (!value || typeof value !== "number" || !Number.isSafeInteger(value))
                throw new Error(`Missing required option: ${key}`);
        }
        else if (!value ||
            typeof value !== "number" ||
            !Number.isSafeInteger(value))
            return undefined;
        this.checkAgainstDefinition(key, value);
        return value;
    }
    getNumber(key, required = false) {
        const value = this.raw.find((x) => x.name === key && x.type === ApplicationCommandOptionType.Number)?.value;
        if (required) {
            if (!value || typeof value !== "number")
                throw new Error(`Missing required option: ${key}`);
        }
        else if (!value || typeof value !== "number")
            return undefined;
        this.checkAgainstDefinition(key, value);
        return value;
    }
    getBoolean(key, required = false) {
        const value = this.raw.find((x) => x.name === key && x.type === ApplicationCommandOptionType.Boolean)?.value;
        if (required) {
            if (!value || typeof value !== "boolean")
                throw new Error(`Missing required option: ${key}`);
        }
        else if (!value || typeof value !== "boolean")
            return undefined;
        return value;
    }
    getUser(key, required = false) {
        const id = this.raw.find((x) => x.name === key && x.type === ApplicationCommandOptionType.User)?.value;
        if (required) {
            if (!id || typeof id !== "string")
                throw new Error(`Missing required option: ${key}`);
        }
        else if (!id || typeof id !== "string")
            return undefined;
        const user = this.resolved.users?.[id];
        if (!user) {
            throw new Error(`Discord failed to resolve user for ${key}, this is a bug.`);
        }
        return new User(this.client, user);
    }
    getMember(key, required = false) {
        const id = this.raw.find((x) => x.name === key && x.type === ApplicationCommandOptionType.User)?.value;
        if (required) {
            if (!id || typeof id !== "string")
                throw new Error(`Missing required option: ${key}`);
        }
        else if (!id || typeof id !== "string")
            return undefined;
        const user = this.resolved.users?.[id];
        if (!user) {
            throw new Error(`Discord failed to resolve user for ${key}, this is a bug.`);
        }
        const rawMember = this.resolved.members?.[id];
        const guildId = this.guildId;
        let member = null;
        if (rawMember && guildId)
            member = new GuildMember(this.client, { ...rawMember, mute: undefined, deaf: undefined, user }, new Guild(this.client, guildId));
        return member;
    }
    async getChannelId(key, required = false) {
        const id = this.raw.find((x) => x.name === key && x.type === ApplicationCommandOptionType.Channel)?.value;
        if (required) {
            if (!id || typeof id !== "string")
                throw new Error(`Missing required option: ${key}`);
        }
        else if (!id || typeof id !== "string")
            return undefined;
        return id;
    }
    async getChannel(key, required = false) {
        const id = this.raw.find((x) => x.name === key && x.type === ApplicationCommandOptionType.Channel)?.value;
        if (required) {
            if (!id || typeof id !== "string")
                throw new Error(`Missing required option: ${key}`);
        }
        else if (!id || typeof id !== "string")
            return undefined;
        return (await this.client.fetchChannel(id)) ?? undefined;
    }
    getRole(key, required = false) {
        const id = this.raw.find((x) => x.name === key && x.type === ApplicationCommandOptionType.Role)?.value;
        if (required) {
            if (!id || typeof id !== "string")
                throw new Error(`Missing required option: ${key}`);
        }
        else if (!id || typeof id !== "string")
            return undefined;
        const role = this.resolved.roles?.[id];
        if (!role) {
            throw new Error(`Discord failed to resolve role for ${key}, this is a bug.`);
        }
        if (!this.guildId) {
            throw new Error("Guild ID is not available for this interaction");
        }
        return new Role(this.client, role, this.guildId);
    }
    getMentionable(key, required = false) {
        const id = this.raw.find((x) => x.name === key && x.type === ApplicationCommandOptionType.Mentionable)?.value;
        if (required) {
            if (!id || typeof id !== "string")
                throw new Error(`Missing required option: ${key}`);
        }
        else if (!id || typeof id !== "string")
            return undefined;
        // Check if it's a user first
        const user = this.resolved.users?.[id];
        if (user) {
            return new User(this.client, user);
        }
        // Check if it's a role
        const role = this.resolved.roles?.[id];
        if (role) {
            if (!this.guildId) {
                throw new Error("Guild ID is not available for this interaction");
            }
            return new Role(this.client, role, this.guildId);
        }
        throw new Error(`Discord failed to resolve mentionable for ${key}, this is a bug.`);
    }
    getAttachment(key, required = false) {
        if (!this.interactionData)
            throw new Error("Interaction data is not available, this is a bug in Carbon.");
        const id = this.raw.find((x) => x.name === key && x.type === ApplicationCommandOptionType.Attachment)?.value;
        if (required) {
            if (!id || typeof id !== "string")
                throw new Error(`Missing required option: ${key}`);
        }
        else if (!id || typeof id !== "string")
            return undefined;
        const attachment = this.interactionData.resolved?.attachments?.[id];
        if (!attachment) {
            if (required)
                throw new Error(`Missing required option: ${key}`);
            return undefined;
        }
        return attachment;
    }
    checkAgainstDefinition(key, value) {
        const definition = this.definitions?.find((x) => x.name === key);
        if (!definition)
            return;
        if (definition.type === ApplicationCommandOptionType.String &&
            typeof value === "string") {
            if ("max_length" in definition &&
                definition.max_length &&
                value.length > definition.max_length)
                throw new Error(`Invalid length for option ${key}: Should be less than ${definition.max_length} characters but is ${value.length} characters`);
            if ("min_length" in definition &&
                definition.min_length &&
                value.length < definition.min_length)
                throw new Error(`Invalid length for option ${key}: Should be more than ${definition.min_length} characters but is ${value.length} characters`);
        }
        if ((definition.type === ApplicationCommandOptionType.Integer ||
            definition.type === ApplicationCommandOptionType.Number) &&
            typeof value === "number") {
            if ("min_value" in definition &&
                definition.min_value &&
                value < definition.min_value)
                throw new Error(`Invalid value for option ${key}: Should be more than ${definition.min_value} but is ${value}`);
            if ("max_value" in definition &&
                definition.max_value &&
                value > definition.max_value)
                throw new Error(`Invalid value for option ${key}: Should be less than ${definition.max_value} but is ${value}`);
        }
        if ("choices" in definition && definition.choices) {
            const choice = definition.choices.find((x) => x.value === value);
            if (!choice)
                throw new Error(`Invalid choice for option ${key}: Should be one of ${definition.choices?.map((x) => x.value).join(", ")} but is ${value}`);
        }
    }
}
//# sourceMappingURL=OptionsHandler.js.map