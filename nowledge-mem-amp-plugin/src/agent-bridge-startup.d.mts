type BridgeEnvironment = Readonly<Record<string, string | undefined>>

export function bridgeStartupHint(env?: BridgeEnvironment): string
export function createBridgeStartupHint(): (sessionId: unknown, env?: BridgeEnvironment) => string
