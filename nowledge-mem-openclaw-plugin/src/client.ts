import { execSync } from "node:child_process"
import type { OpenClawLogger } from "../types/openclaw"

export interface SearchResult {
  id: string
  title: string
  content: string
  score: number
  labels: string[]
  importance: number
}

export interface WorkingMemory {
  content: string
  available: boolean
}

/**
 * Nowledge Mem client — wraps the nmem CLI for local-first operations.
 * Falls back to uvx if plain nmem is not on PATH.
 */
export class NowledgeMemClient {
  private logger: OpenClawLogger
  private nmemCmd: string | null = null

  constructor(logger: OpenClawLogger) {
    this.logger = logger
  }

  private resolveCommand(): string {
    if (this.nmemCmd) return this.nmemCmd

    // Try plain nmem first, then uvx fallback
    for (const cmd of ["nmem", "uvx --from nmem-cli nmem"]) {
      try {
        execSync(`${cmd} --version`, { stdio: "pipe", timeout: 10_000 })
        this.nmemCmd = cmd
        this.logger.info(`nmem resolved: ${cmd}`)
        return cmd
      } catch {
        // try next
      }
    }

    throw new Error(
      "nmem CLI not found. Install with: pip install nmem-cli (or use uvx)"
    )
  }

  private exec(args: string): string {
    const cmd = this.resolveCommand()
    try {
      return execSync(`${cmd} ${args}`, {
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 30_000,
        encoding: "utf-8",
      }).trim()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.logger.error(`nmem command failed: ${cmd} ${args} — ${message}`)
      throw err
    }
  }

  async search(query: string, limit = 5): Promise<SearchResult[]> {
    const raw = this.exec(`--json m search "${query.replace(/"/g, '\\"')}" -n ${limit}`)
    const data = JSON.parse(raw)
    const memories = data.memories ?? data.results ?? []
    return memories.map((m: Record<string, unknown>) => ({
      id: String(m.id ?? ""),
      title: String(m.title ?? ""),
      content: String(m.content ?? ""),
      score: Number(m.score ?? 0),
      labels: Array.isArray(m.labels) ? m.labels : [],
      importance: Number(m.importance ?? m.rating ?? 0.5),
    }))
  }

  async addMemory(
    content: string,
    title?: string,
    importance?: number
  ): Promise<string> {
    let args = `m add "${content.replace(/"/g, '\\"')}"`
    if (title) args += ` -t "${title.replace(/"/g, '\\"')}"`
    if (importance !== undefined) args += ` -i ${importance}`
    const raw = this.exec(`--json ${args}`)
    const data = JSON.parse(raw)
    return String(data.id ?? "created")
  }

  async readWorkingMemory(): Promise<WorkingMemory> {
    try {
      const content = execSync("cat ~/ai-now/memory.md 2>/dev/null", {
        encoding: "utf-8",
        timeout: 5_000,
      }).trim()
      return { content, available: content.length > 0 }
    } catch {
      return { content: "", available: false }
    }
  }

  async saveThread(summary?: string): Promise<string> {
    let args = "t save --from openclaw --truncate"
    if (summary) args += ` -s "${summary.replace(/"/g, '\\"')}"`
    return this.exec(args)
  }

  async checkHealth(): Promise<boolean> {
    try {
      this.exec("status")
      return true
    } catch {
      return false
    }
  }
}
