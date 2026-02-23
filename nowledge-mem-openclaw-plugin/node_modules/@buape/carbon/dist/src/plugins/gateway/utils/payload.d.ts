import { type GatewayPayload, type RequestGuildMembersData, type UpdatePresenceData, type UpdateVoiceStateData } from "../types.js";
export interface IdentifyProperties {
    os: string;
    browser: string;
    device: string;
}
export interface IdentifyData {
    token: string;
    properties: IdentifyProperties;
    intents: number;
    shard?: [number, number];
}
export interface ResumeData {
    token: string;
    sessionId: string;
    sequence: number;
}
export declare function validatePayload(data: string): GatewayPayload | null;
export declare function createIdentifyPayload(data: IdentifyData): GatewayPayload;
export declare function createResumePayload(data: ResumeData): GatewayPayload;
export declare function createUpdatePresencePayload(data: UpdatePresenceData): GatewayPayload;
export declare function createUpdateVoiceStatePayload(data: UpdateVoiceStateData): GatewayPayload;
export declare function createRequestGuildMembersPayload(data: RequestGuildMembersData): GatewayPayload;
//# sourceMappingURL=payload.d.ts.map