type Environment = Readonly<Record<string, string | undefined>>
type Runner = (args: string[], timeout: number) => Promise<{ok: boolean; stdout?: string}>
export function validBridgeSession(session: unknown): boolean
export function bridgeSessionHint(host: string, session: unknown): string
export function bridgeNoticeWithRunner(host: string, session: unknown, run: Runner, env?: Environment): Promise<string>
export function closeBridgeSession(host: string, session: unknown, run: Runner): Promise<void>
