import { MessageFlags } from "discord-api-types/v10";
export const serializePayload = (payload, defaultEphemeral = false) => {
    if (typeof payload === "string") {
        return { content: payload, flags: defaultEphemeral ? 64 : undefined };
    }
    if (payload.components?.some((component) => component.isV2)) {
        payload.flags = payload.flags
            ? payload.flags | MessageFlags.IsComponentsV2
            : MessageFlags.IsComponentsV2;
    }
    if (payload.ephemeral !== undefined) {
        if (payload.ephemeral) {
            payload.flags = payload.flags
                ? payload.flags | MessageFlags.Ephemeral
                : MessageFlags.Ephemeral;
        }
        else {
            payload.flags = payload.flags
                ? payload.flags & ~MessageFlags.Ephemeral
                : undefined;
        }
    }
    if (payload.flags &&
        (payload.flags & MessageFlags.IsComponentsV2) ===
            MessageFlags.IsComponentsV2) {
        if (payload.content) {
            throw new Error("You cannot send a message with both content and v2 components. Use the TextDisplay component as a replacement for the content property in the message. https://carbon.buape.com/classes/components/text-display");
        }
        if (payload.embeds) {
            throw new Error("You cannot send a message with both embeds and v2 components. Use the Container component as a replacement for the embeds in the message. https://carbon.buape.com/classes/components/container");
        }
    }
    const { ephemeral, ...payloadWithoutEphemeral } = payload;
    const data = {
        ...payloadWithoutEphemeral,
        allowed_mentions: payload.allowedMentions,
        embeds: payload.embeds?.map((embed) => embed.serialize()),
        components: payload.components?.map((row) => row.serialize()),
        poll: payload.poll
            ? {
                ...payload.poll,
                answers: payload.poll.answers.map((answer) => ({
                    poll_media: {
                        text: answer.text,
                        emoji: answer.emoji
                    }
                })),
                allow_multiselect: payload.poll.allowMultiselect,
                layout_type: payload.poll.layoutType ?? 1
            }
            : undefined,
        sticker_ids: payload.stickers
    };
    if (payload.ephemeral === undefined && defaultEphemeral) {
        data.flags = payload.flags
            ? payload.flags | MessageFlags.Ephemeral
            : MessageFlags.Ephemeral;
    }
    return data;
};
//# sourceMappingURL=payload.js.map