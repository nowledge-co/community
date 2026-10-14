import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build, version as esbuildVersion } from "esbuild";
import ts from "typescript";
import { consumers, repositoryRoot } from "./consumers.ts";

const coreRoot = resolve(repositoryRoot, "shared/plugin-core");
export const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

async function files(directory: string, prefix = ""): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(join(directory, prefix), { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...await files(directory, name));
    else if (entry.isFile()) result.push(name);
    else throw new Error(`Unsupported generated/input entry: ${name}`);
  }
  return result.sort();
}

export async function buildCore(): Promise<Map<string, string>> {
  const temporary = await mkdtemp(join(tmpdir(), "nmem-core-build-"));
  try {
    const inputs = ["package.json", "package-lock.json", "tsconfig.json", "consumers.json"];
    for (const directory of ["src", "scripts"]) {
      inputs.push(...(await files(join(coreRoot, directory))).map(name => `${directory}/${name}`));
    }
    const digest = createHash("sha256");
    for (const name of inputs.sort()) {
      const content = Buffer.from((await readFile(join(coreRoot, name), "utf8")).replace(/\r\n/g, "\n"));
      digest.update(`${Buffer.byteLength(name)}:${name}${content.byteLength}:`);
      digest.update(content);
    }
    const bundled = await build({
      entryPoints: [join(coreRoot, "src/index.ts")],
      absWorkingDir: coreRoot,
      bundle: true,
      platform: "node",
      format: "esm",
      target: "es2022",
      legalComments: "none",
      banner: { js: "// Generated from shared/plugin-core. Run npm --prefix shared/plugin-core run build." },
      write: false,
    });
    const config = ts.readConfigFile(join(coreRoot, "tsconfig.json"), ts.sys.readFile);
    if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, coreRoot);
    const sourceFiles = (await files(join(coreRoot, "src"))).map(name => join(coreRoot, "src", name));
    const program = ts.createProgram(sourceFiles, {
      ...parsed.options,
      noEmit: false,
      declaration: true,
      emitDeclarationOnly: true,
      rootDir: join(coreRoot, "src"),
      outDir: temporary,
    });
    const emitted = program.emit();
    const diagnostics = [...ts.getPreEmitDiagnostics(program), ...emitted.diagnostics];
    if (diagnostics.length) {
      throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: name => name,
        getCurrentDirectory: () => coreRoot,
        getNewLine: () => "\n",
      }));
    }
    const output = new Map<string, string>();
    output.set("index.js", bundled.outputFiles![0]!.text);
    for (const name of await files(temporary)) output.set(name, await readFile(join(temporary, name), "utf8"));
    output.set("package.json", JSON.stringify({ private: true, type: "module" }, null, 2) + "\n");
    const metadata = JSON.parse(await readFile(join(coreRoot, "package.json"), "utf8"));
    output.set("manifest.json", JSON.stringify({
      schemaVersion: 1,
      core: { name: metadata.name, version: metadata.version, sourceDigest: digest.digest("hex") },
      build: { target: "es2022", format: "esm", esbuild: esbuildVersion, typescript: ts.version },
      files: Object.fromEntries([...output].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([name, content]) => [name, sha256(content)])),
    }, null, 2) + "\n");
    return output;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function syncGenerated(
  directory: string,
  output: ReadonlyMap<string, string>,
  check: boolean,
): Promise<void> {
  if (!check) await mkdir(directory, { recursive: true });
  for (const [name, content] of output) {
    const path = join(directory, name);
    if (check) {
      const actual = await readFile(path, "utf8").catch(() => undefined);
      if (actual !== content) throw new Error(`Stale generated core: ${path}`);
    } else await writeFile(path, content);
  }
  const actualFiles = await files(directory);
  if (actualFiles.some(name => !output.has(name))) throw new Error(`Unexpected generated files in ${directory}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const output = await buildCore();
  for (const consumer of consumers()) {
    await syncGenerated(join(repositoryRoot, consumer.directory, consumer.generatedDirectory), output, process.argv.includes("--check"));
    console.log(`${process.argv.includes("--check") ? "Verified" : "Generated"} ${consumer.id}`);
  }
}
