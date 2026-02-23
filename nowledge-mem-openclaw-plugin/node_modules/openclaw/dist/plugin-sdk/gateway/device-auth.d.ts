export type DeviceAuthPayloadParams = {
    deviceId: string;
    clientId: string;
    clientMode: string;
    role: string;
    scopes: string[];
    signedAtMs: number;
    token?: string | null;
    nonce: string;
};
export declare function buildDeviceAuthPayload(params: DeviceAuthPayloadParams): string;
