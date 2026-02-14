/** OpenClaw Plugin API — minimal type definitions */

export interface OpenClawPluginApi {
  pluginConfig: unknown
  logger: OpenClawLogger
  registerTool(tool: ToolDefinition, options?: ToolOptions): void
  registerCommand(command: CommandDefinition): void
  // biome-ignore lint/suspicious/noExplicitAny: openclaw CLI program shape
  registerCli(handler: (ctx: { program: any }) => void, options?: CliOptions): void
  registerService(service: ServiceDefinition): void
  on(event: string, handler: (event: Record<string, unknown>, ctx?: Record<string, unknown>) => unknown): void
}

export interface OpenClawLogger {
  info(msg: string): void
  warn(msg: string): void
  error(msg: string): void
  debug(msg: string): void
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute(params: Record<string, unknown>): Promise<ToolResult>
}

export interface ToolResult {
  content: Array<{ type: string; text: string }>
  details?: Record<string, unknown>
}

export interface ToolOptions {
  category?: string
}

export interface CommandDefinition {
  name: string
  description: string
  acceptsArgs?: boolean
  handler(ctx: { args?: string }): Promise<{ text: string }>
}

export interface CliOptions {
  commands?: string[]
}

export interface ServiceDefinition {
  id: string
  start(): void
  stop(): void
}
