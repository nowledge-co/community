import { execSync } from "node:child_process"

/**
 * Nowledge Mem client. Wraps the nmem CLI for local-first operations.
 * Falls back to uvx if plain nmem is not on PATH.
 */
export class NowledgeMemClient {
  constructor(logger) {
    this.logger = logger
    this.nmemCmd = null
  }

  resolveCommand() {
    if (this.nmemCmd) return this.nmemCmd

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

  exec(args) {
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

  async search(query, limit = 5) {
    const raw = this.exec(`--json m search "${query.replace(/"/g, '\\"')}" -n ${limit}`)
    const data = JSON.parse(raw)
    const memories = data.memories ?? data.results ?? []
    return memories.map((m) => ({
      id: String(m.id ?? ""),
      title: String(m.title ?? ""),
      content: String(m.content ?? ""),
      score: Number(m.score ?? 0),
      labels: Array.isArray(m.labels) ? m.labels : [],
      importance: Number(m.importance ?? m.rating ?? 0.5),
    }))
  }

  async addMemory(content, title, importance) {
    let args = `m add "${content.replace(/"/g, '\\"')}"`
    if (title) args += ` -t "${title.replace(/"/g, '\\"')}"`
    if (importance !== undefined) args += ` -i ${importance}`
    const raw = this.exec(`--json ${args}`)
    const data = JSON.parse(raw)
    return String(data.id ?? "created")
  }

  async readWorkingMemory() {
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

  async saveThread(summary) {
    let args = "t save --from openclaw --truncate"
    if (summary) args += ` -s "${summary.replace(/"/g, '\\"')}"`
    return this.exec(args)
  }

  async checkHealth() {
    try {
      this.exec("status")
      return true
    } catch {
      return false
    }
  }
}
