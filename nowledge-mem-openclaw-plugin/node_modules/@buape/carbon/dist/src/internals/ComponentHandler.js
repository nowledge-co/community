import { InteractionResponseType, Routes } from "discord-api-types/v10";
import { Base } from "../abstracts/Base.js";
import { Button } from "../classes/components/Button.js";
import { ChannelSelectMenu } from "../classes/components/ChannelSelectMenu.js";
import { MentionableSelectMenu } from "../classes/components/MentionableSelectMenu.js";
import { RoleSelectMenu } from "../classes/components/RoleSelectMenu.js";
import { StringSelectMenu } from "../classes/components/StringSelectMenu.js";
import { UserSelectMenu } from "../classes/components/UserSelectMenu.js";
import { LRUCache } from "../utils/LRUCache.js";
import { ButtonInteraction } from "./ButtonInteraction.js";
import { ChannelSelectMenuInteraction } from "./ChannelSelectMenuInteraction.js";
import { MentionableSelectMenuInteraction } from "./MentionableSelectMenuInteraction.js";
import { RoleSelectMenuInteraction } from "./RoleSelectMenuInteraction.js";
import { StringSelectMenuInteraction } from "./StringSelectMenuInteraction.js";
import { UserSelectMenuInteraction } from "./UserSelectMenuInteraction.js";
export class ComponentHandler extends Base {
    componentCache = new LRUCache(10000);
    oneOffComponents = new Map();
    getComponentCacheKey(key, componentType) {
        return `${componentType}:${key}`;
    }
    registerComponent(component) {
        const componentKey = component.customIdParser(component.customId).key;
        const cacheKey = this.getComponentCacheKey(componentKey, component.type);
        if (!this.componentCache.has(cacheKey)) {
            this.componentCache.set(cacheKey, component);
        }
    }
    hasComponentWithKey(key, componentType) {
        for (const component of this.componentCache.values()) {
            const componentKey = component.customIdParser(component.customId).key;
            if (componentKey !== key)
                continue;
            if (componentType === undefined || component.type === componentType) {
                return true;
            }
        }
        return false;
    }
    findComponent(customId, componentType) {
        for (const component of this.componentCache.values()) {
            const componentKey = component.customIdParser(component.customId).key;
            const interactionKey = component.customIdParser(customId).key;
            if (componentKey === interactionKey && component.type === componentType) {
                return component;
            }
        }
        for (const component of this.componentCache.values()) {
            const componentKey = component.customIdParser(component.customId).key;
            if (componentKey === "*" && component.type === componentType) {
                return component;
            }
        }
        return undefined;
    }
    async handleInteraction(data) {
        const oneOffComponent = this.oneOffComponents.get(`${data.message.id}-${data.message.channel_id}`);
        if (oneOffComponent) {
            oneOffComponent.resolve(data.data);
            this.oneOffComponents.delete(`${data.message.id}-${data.message.channel_id}`);
            await this.client.rest
                .post(Routes.interactionCallback(data.id, data.token), {
                body: {
                    type: InteractionResponseType.DeferredMessageUpdate
                }
            })
                .catch(() => {
                console.warn(`Failed to acknowledge one-off component interaction for message ${data.message.id}`);
            });
            return;
        }
        const component = this.findComponent(data.data.custom_id, data.data.component_type);
        if (!component) {
            throw new Error(`Unknown component with type ${data.data.component_type} and custom ID ${data.data.custom_id} was received, did you forget to register the component? See https://carbon.buape.com/concepts/component-registration for more information.`);
        }
        const parsed = component.customIdParser(data.data.custom_id);
        if (component instanceof Button) {
            const interaction = new ButtonInteraction(this.client, data, {
                ephemeral: typeof component.ephemeral === "function"
                    ? false
                    : component.ephemeral
            });
            // Resolve ephemeral setting if it's a function
            if (typeof component.ephemeral === "function") {
                interaction.setDefaultEphemeral(component.ephemeral(interaction));
            }
            // Resolve defer setting if it's a function
            const shouldDefer = typeof component.defer === "function"
                ? component.defer(interaction)
                : component.defer;
            if (shouldDefer)
                await interaction.defer();
            await component.run(interaction, parsed.data);
        }
        else if (component instanceof RoleSelectMenu) {
            const interaction = new RoleSelectMenuInteraction(this.client, data, {
                ephemeral: typeof component.ephemeral === "function"
                    ? false
                    : component.ephemeral
            });
            // Resolve ephemeral setting if it's a function
            if (typeof component.ephemeral === "function") {
                interaction.setDefaultEphemeral(component.ephemeral(interaction));
            }
            // Resolve defer setting if it's a function
            const shouldDefer = typeof component.defer === "function"
                ? component.defer(interaction)
                : component.defer;
            if (shouldDefer)
                await interaction.defer();
            await component.run(interaction, parsed.data);
        }
        else if (component instanceof ChannelSelectMenu) {
            const interaction = new ChannelSelectMenuInteraction(this.client, data, {
                ephemeral: typeof component.ephemeral === "function"
                    ? false
                    : component.ephemeral
            });
            // Resolve ephemeral setting if it's a function
            if (typeof component.ephemeral === "function") {
                interaction.setDefaultEphemeral(component.ephemeral(interaction));
            }
            // Resolve defer setting if it's a function
            const shouldDefer = typeof component.defer === "function"
                ? component.defer(interaction)
                : component.defer;
            if (shouldDefer)
                await interaction.defer();
            await component.run(interaction, parsed.data);
        }
        else if (component instanceof MentionableSelectMenu) {
            const interaction = new MentionableSelectMenuInteraction(this.client, data, {
                ephemeral: typeof component.ephemeral === "function"
                    ? false
                    : component.ephemeral
            });
            // Resolve ephemeral setting if it's a function
            if (typeof component.ephemeral === "function") {
                interaction.setDefaultEphemeral(component.ephemeral(interaction));
            }
            // Resolve defer setting if it's a function
            const shouldDefer = typeof component.defer === "function"
                ? component.defer(interaction)
                : component.defer;
            if (shouldDefer)
                await interaction.defer();
            await component.run(interaction, parsed.data);
        }
        else if (component instanceof StringSelectMenu) {
            const interaction = new StringSelectMenuInteraction(this.client, data, {
                ephemeral: typeof component.ephemeral === "function"
                    ? false
                    : component.ephemeral
            });
            // Resolve ephemeral setting if it's a function
            if (typeof component.ephemeral === "function") {
                interaction.setDefaultEphemeral(component.ephemeral(interaction));
            }
            // Resolve defer setting if it's a function
            const shouldDefer = typeof component.defer === "function"
                ? component.defer(interaction)
                : component.defer;
            if (shouldDefer)
                await interaction.defer();
            await component.run(interaction, parsed.data);
        }
        else if (component instanceof UserSelectMenu) {
            const interaction = new UserSelectMenuInteraction(this.client, data, {
                ephemeral: typeof component.ephemeral === "function"
                    ? false
                    : component.ephemeral
            });
            // Resolve ephemeral setting if it's a function
            if (typeof component.ephemeral === "function") {
                interaction.setDefaultEphemeral(component.ephemeral(interaction));
            }
            // Resolve defer setting if it's a function
            const shouldDefer = typeof component.defer === "function"
                ? component.defer(interaction)
                : component.defer;
            if (shouldDefer)
                await interaction.defer();
            await component.run(interaction, parsed.data);
        }
        else {
            throw new Error(`Unknown component with type ${data.data.component_type} and custom ID ${data.data.custom_id}`);
        }
    }
}
//# sourceMappingURL=ComponentHandler.js.map