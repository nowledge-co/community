import { ApplicationWebhookEventType, GatewayDispatchEvents } from "discord-api-types/v10";
export const WebhookEvent = {
    ...ApplicationWebhookEventType
};
export const GatewayEvent = {
    ...GatewayDispatchEvents
};
export const ListenerEvent = {
    ...GatewayEvent,
    ...WebhookEvent,
    GuildAvailable: "GUILD_AVAILABLE",
    GuildUnavailable: "GUILD_UNAVAILABLE"
};
//# sourceMappingURL=listeners.js.map