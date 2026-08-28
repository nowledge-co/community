import { execFile } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"

const MAX_OUTPUT_BYTES = 64 * 1024 * 1024

/**
 * Build the CLI transport supported by the current OpenCode host.
 *
 * OpenCode CLI supplies Bun's tagged-template shell while OpenCode Desktop's
 * Node sidecar intentionally leaves it undefined. The Node fallback uses an
 * argv array directly so Space names and user content never pass through a
 * shell parser. Windows desktop installs expose a `.cmd` wrapper, so the
 * fallback resolves the Rust `.exe` behind our generated wrapper first.
 */
export function createNmemCliRunner(
  shell,
  execFileImpl = execFile,
  { platform = process.platform, readFileImpl = readFileSync, existsImpl = existsSync } = {},
) {
  if (typeof shell === "function") {
    return async (args) => shell`nmem --json ${args}`.text()
  }

  let commandPromise
  const command = async () => {
    if (platform !== "win32") return "nmem"
    commandPromise ??= resolveWindowsNmemExecutable(execFileImpl, readFileImpl, existsImpl)
    return commandPromise
  }

  return async (args) => {
    const executable = await command()
    if (!executable) {
      const error = new Error("nmem CLI executable was not found")
      error.code = "ENOENT"
      throw error
    }
    return new Promise((resolve, reject) => {
      execFileImpl(
        executable,
        ["--json", ...args],
        { encoding: "utf8", maxBuffer: MAX_OUTPUT_BYTES },
        (error, stdout, stderr) => {
          if (error) {
            error.stderr = String(stderr ?? "")
            reject(error)
            return
          }
          resolve(String(stdout ?? ""))
        },
      )
    })
  }
}

function runExecFile(execFileImpl, file, args, options) {
  return new Promise((resolve) => {
    execFileImpl(file, args, options, (error, stdout, stderr) => {
      resolve({ error, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") })
    })
  })
}

async function resolveWindowsNmemExecutable(execFileImpl, readFileImpl, existsImpl) {
  const whereOptions = { encoding: "utf8", maxBuffer: 64 * 1024 }
  const direct = await runExecFile(execFileImpl, "where.exe", ["nmem.exe"], whereOptions)
  if (!direct.error) {
    const directPath = direct.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && existsImpl(line))
    if (directPath) return directPath
  }

  const wrapper = await runExecFile(execFileImpl, "where.exe", ["nmem.cmd"], whereOptions)
  if (wrapper.error) return null
  for (const candidate of wrapper.stdout.split(/\r?\n/).map((line) => line.trim())) {
    if (!candidate) continue
    let contents
    try {
      contents = readFileImpl(candidate, "utf8")
    } catch {
      continue
    }
    // This is the exact wrapper shape emitted by the desktop app's Rust CLI
    // installer. Do not execute arbitrary batch files through a shell.
    const match = contents.match(/^\s*"([^"\r\n]+\.exe)"\s+%\*\s*$/m)
    if (match?.[1] && existsImpl(match[1])) return match[1]
  }
  return null
}
