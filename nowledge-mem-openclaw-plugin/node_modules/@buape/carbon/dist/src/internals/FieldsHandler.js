import { ComponentType } from "discord-api-types/v10";
import { Base } from "../abstracts/Base.js";
import { Role, User } from "../index.js";
/**
 * This class is used to parse the fields of a modal submit interaction.
 * It is used internally by the Modal class.
 */
export class FieldsHandler extends Base {
    /**
     * The raw data from the interaction.
     */
    rawData = {};
    /**
     * The resolved data from the interaction.
     */
    resolved;
    guildId;
    constructor(client, interaction) {
        super(client);
        this.resolved = interaction.data.resolved ?? {};
        this.guildId = interaction.guild_id;
        interaction.data.components.forEach((component) => {
            if (component.type === ComponentType.Label) {
                const subComponent = component.component;
                if (subComponent.type === ComponentType.TextInput) {
                    this.rawData[subComponent.custom_id] = [subComponent.value];
                }
                else {
                    this.rawData[subComponent.custom_id] = subComponent.values;
                }
            }
        });
    }
    getText(key, required = false) {
        const value = this.rawData[key]?.[0];
        if (required) {
            if (!value || typeof value !== "string")
                throw new Error(`Missing required field: ${key}`);
        }
        else if (!value || typeof value !== "string")
            return undefined;
        return value;
    }
    getStringSelect(key, required = false) {
        const value = this.rawData[key];
        if (required) {
            if (!value || !Array.isArray(value))
                throw new Error(`Missing required field: ${key}`);
        }
        else if (!value || !Array.isArray(value))
            return undefined;
        return value;
    }
    getChannelSelectIds(key, required = false) {
        const value = this.rawData[key];
        if (!value || !Array.isArray(value)) {
            if (required)
                throw new Error(`Missing required field: ${key}`);
            return undefined;
        }
        return value;
    }
    async getChannelSelect(key, required = false) {
        const value = this.rawData[key];
        if (!value || !Array.isArray(value)) {
            if (required)
                throw new Error(`Missing required field: ${key}`);
            return undefined;
        }
        return await Promise.all(value.map((id) => this.client.fetchChannel(id)));
    }
    getUserSelect(key, required = false) {
        const value = this.rawData[key];
        if (!value || !Array.isArray(value)) {
            if (required)
                throw new Error(`Missing required field: ${key}`);
            return undefined;
        }
        const resolved = value.map((id) => this.resolved.users?.[id]);
        if (!resolved.every((user) => user !== undefined)) {
            throw new Error(`Discord failed to resolve all users for ${key}, this is a bug.`);
        }
        return resolved
            .filter((user) => user !== undefined)
            .map((user) => new User(this.client, user));
    }
    getRoleSelect(key, required = false) {
        const value = this.rawData[key];
        if (!value || !Array.isArray(value)) {
            if (required)
                throw new Error(`Missing required field: ${key}`);
            return undefined;
        }
        const resolved = value.map((id) => this.resolved.roles?.[id]);
        if (!resolved.every((role) => role !== undefined)) {
            throw new Error(`Discord failed to resolve all roles for ${key}, this is a bug.`);
        }
        if (!this.guildId) {
            throw new Error("Guild ID is not available for this interaction");
        }
        const guildId = this.guildId;
        return resolved
            .filter((role) => role !== undefined)
            .map((role) => new Role(this.client, role, guildId));
    }
    getMentionableSelect(key, required = false) {
        const value = this.rawData[key];
        if (!value || !Array.isArray(value)) {
            if (required)
                throw new Error(`Missing required field: ${key}`);
            return undefined;
        }
        if (!this.guildId) {
            throw new Error("Guild ID is not available for this interaction");
        }
        const guildId = this.guildId;
        const resolvedRoles = value.map((id) => this.resolved.roles?.[id]);
        const resolvedUsers = value.map((id) => this.resolved.users?.[id]);
        const result = {
            roles: resolvedRoles
                .filter((role) => role !== undefined)
                .map((role) => new Role(this.client, role, guildId)),
            users: resolvedUsers
                .filter((user) => user !== undefined)
                .map((user) => new User(this.client, user))
        };
        if (result.roles.length + result.users.length !== value.length) {
            throw new Error(`Discord failed to resolve all mentionables for ${key}, this is a bug.`);
        }
        return result;
    }
    getFile(key, required = false) {
        const value = this.rawData[key];
        if (!value || !Array.isArray(value)) {
            if (required)
                throw new Error(`Missing required field: ${key}`);
            return undefined;
        }
        const resolved = value.map((id) => this.resolved.attachments?.[id]);
        if (!resolved.every((attachment) => attachment !== undefined)) {
            throw new Error(`Discord failed to resolve all attachments for ${key}, this is a bug.`);
        }
        return resolved.filter((attachment) => attachment !== undefined);
    }
}
//# sourceMappingURL=FieldsHandler.js.map