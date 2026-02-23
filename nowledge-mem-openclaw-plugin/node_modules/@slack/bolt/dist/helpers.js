"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertNever = exports.isEventTypeToSkipAuthorize = exports.isBodyWithTypeEnterpriseInstall = exports.getTypeAndConversation = exports.IncomingEventType = void 0;
/**
 * Internal data type for capturing the class of event processed in App#onIncomingEvent()
 */
var IncomingEventType;
(function (IncomingEventType) {
    IncomingEventType[IncomingEventType["Event"] = 0] = "Event";
    IncomingEventType[IncomingEventType["Action"] = 1] = "Action";
    IncomingEventType[IncomingEventType["Command"] = 2] = "Command";
    IncomingEventType[IncomingEventType["Options"] = 3] = "Options";
    IncomingEventType[IncomingEventType["ViewAction"] = 4] = "ViewAction";
    IncomingEventType[IncomingEventType["Shortcut"] = 5] = "Shortcut";
})(IncomingEventType || (exports.IncomingEventType = IncomingEventType = {}));
// ----------------------------
// For skipping authorize with event
const eventTypesToSkipAuthorize = ['app_uninstalled', 'tokens_revoked'];
/**
 * Helper which finds the type and channel (if any) that any specific incoming event is related to.
 *
 * This is analogous to WhenEventHasChannelContext and the conditional type that checks SlackAction for a channel
 * context.
 */
// biome-ignore lint/suspicious/noExplicitAny: response bodies can be anything
function getTypeAndConversation(body) {
    if (body.event !== undefined) {
        const { event } = body;
        // Find conversationId
        const conversationId = (() => {
            let foundConversationId;
            if ('channel' in event) {
                if (typeof event?.channel === 'string') {
                    foundConversationId = event.channel;
                }
                else if (typeof event?.channel === 'object' && 'id' in event.channel) {
                    foundConversationId = event.channel.id;
                }
            }
            if ('channel_id' in event) {
                foundConversationId = event.channel_id;
            }
            if ('item' in event && 'channel' in event.item) {
                // no channel for reaction_added, reaction_removed, star_added, or star_removed with file or file_comment items
                foundConversationId = event.item.channel;
            }
            // Using non-null assertion (!) because the alternative is to use `foundConversation: (string | undefined)`, which
            // impedes the very useful type checker help above that ensures the value is only defined to strings, not
            // undefined. This is safe when used in combination with the || operator with a default value.
            // biome-ignore lint/style/noNonNullAssertion: TODO: revisit this and use the types
            return foundConversationId || undefined;
        })();
        return {
            conversationId,
            type: IncomingEventType.Event,
        };
    }
    if (body.command !== undefined) {
        return {
            type: IncomingEventType.Command,
            conversationId: body.channel_id,
        };
    }
    if (body.name !== undefined || body.type === 'block_suggestion') {
        const optionsBody = body;
        return {
            type: IncomingEventType.Options,
            conversationId: optionsBody.channel !== undefined ? optionsBody.channel.id : undefined,
        };
    }
    // TODO: remove workflow_step stuff in v5
    if (body.actions !== undefined || body.type === 'dialog_submission' || body.type === 'workflow_step_edit') {
        const actionBody = body;
        return {
            type: IncomingEventType.Action,
            conversationId: actionBody.channel !== undefined ? actionBody.channel.id : undefined,
        };
    }
    if (body.type === 'shortcut') {
        return {
            type: IncomingEventType.Shortcut,
        };
    }
    if (body.type === 'message_action') {
        const shortcutBody = body;
        return {
            type: IncomingEventType.Shortcut,
            conversationId: shortcutBody.channel !== undefined ? shortcutBody.channel.id : undefined,
        };
    }
    if (body.type === 'view_submission' || body.type === 'view_closed') {
        return {
            type: IncomingEventType.ViewAction,
        };
    }
    return {};
}
exports.getTypeAndConversation = getTypeAndConversation;
/**
 * Helper which determines if the body of a request is enterprise install.
 *
 * Providing the type is optional but if you do the execution will be faster
 */
function isBodyWithTypeEnterpriseInstall(body, type) {
    const _type = type !== undefined ? type : getTypeAndConversation(body).type;
    if (_type === IncomingEventType.Event) {
        const bodyAsEvent = body;
        if (Array.isArray(bodyAsEvent.authorizations) && bodyAsEvent.authorizations[0] !== undefined) {
            return !!bodyAsEvent.authorizations[0].is_enterprise_install;
        }
    }
    // command payloads have this property set as a string
    if (typeof body.is_enterprise_install === 'string') {
        return body.is_enterprise_install === 'true';
    }
    // all remaining types have a boolean property
    if (body.is_enterprise_install !== undefined) {
        return body.is_enterprise_install;
    }
    // as a fallback we assume it's a single team installation (but this should never happen)
    return false;
}
exports.isBodyWithTypeEnterpriseInstall = isBodyWithTypeEnterpriseInstall;
/**
 * Helper which determines if the event type will skip Authorize.
 *
 * Token revocation use cases
 * https://github.com/slackapi/bolt-js/issues/674
 */
function isEventTypeToSkipAuthorize(event) {
    return eventTypesToSkipAuthorize.includes(event.body?.event?.type);
}
exports.isEventTypeToSkipAuthorize = isEventTypeToSkipAuthorize;
/* istanbul ignore next */
/** Helper that should never be called, but is useful for exhaustiveness checking in conditional branches */
function assertNever(x) {
    throw new Error(`Unexpected object: ${x}`);
}
exports.assertNever = assertNever;
//# sourceMappingURL=helpers.js.map