import { GatewayOpcodes } from "../types.js";
export function validatePayload(data) {
    try {
        const payload = JSON.parse(data);
        if (!payload || typeof payload !== "object") {
            console.error("[Gateway] Invalid payload: Not an object", { data });
            return null;
        }
        if (!("op" in payload) || typeof payload.op !== "number") {
            console.error("[Gateway] Invalid payload: Missing or invalid op code", {
                data
            });
            return null;
        }
        if (!("d" in payload)) {
            console.error("[Gateway] Invalid payload: Missing data field", { data });
            return null;
        }
        return payload;
    }
    catch (error) {
        console.error("[Gateway] Failed to validate payload:", error, { data });
        return null;
    }
}
export function createIdentifyPayload(data) {
    return {
        op: GatewayOpcodes.Identify,
        d: {
            token: data.token,
            properties: data.properties,
            intents: data.intents,
            ...(data.shard ? { shard: data.shard } : {})
        }
    };
}
export function createResumePayload(data) {
    return {
        op: GatewayOpcodes.Resume,
        d: {
            token: data.token,
            session_id: data.sessionId,
            seq: data.sequence
        }
    };
}
export function createUpdatePresencePayload(data) {
    return {
        op: GatewayOpcodes.PresenceUpdate,
        d: data
    };
}
export function createUpdateVoiceStatePayload(data) {
    return {
        op: GatewayOpcodes.VoiceStateUpdate,
        d: data
    };
}
export function createRequestGuildMembersPayload(data) {
    return {
        op: GatewayOpcodes.RequestGuildMembers,
        d: data
    };
}
//# sourceMappingURL=payload.js.map