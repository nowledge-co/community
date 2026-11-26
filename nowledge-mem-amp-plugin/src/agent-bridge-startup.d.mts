type BridgeEnvironment = Readonly<Record<string, string | undefined>>

export function bridgeStartupHint(env?: BridgeEnvironment): string
type BridgeHint = ((sessionId: unknown, env?: BridgeEnvironment) => string) & { forget(sessionId: string): boolean }
export function createBridgeStartupHint(host?: string, consumeNotices?: boolean): BridgeHint
