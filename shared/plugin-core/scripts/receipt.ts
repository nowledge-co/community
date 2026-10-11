import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { consumers, repositoryRoot } from "./consumers.ts";

export function releaseReceipt(plugin: string, packPath: string, sourceSha: string, root = repositoryRoot) {
  if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error("Require full reviewed source SHA");
  const consumer = consumers(root).find(entry => entry.id === plugin);
  if (!consumer) throw new Error(`No embedded core for ${plugin}`);
  const metadata = JSON.parse(readFileSync(join(root, consumer.directory, "package.json"), "utf8"));
  const packs = JSON.parse(readFileSync(packPath, "utf8"));
  if (!Array.isArray(packs) || packs.length !== 1) throw new Error("Require one tested tarball");
  const [pack] = packs;
  if (pack.name !== metadata.name || pack.version !== metadata.version || basename(pack.filename) !== pack.filename) {
    throw new Error("Pack identity differs from reviewed plugin");
  }
  const artifact = join(dirname(packPath), pack.filename);
  const bytes = readFileSync(artifact);
  const integrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
  if (integrity !== pack.integrity) throw new Error("Tarball differs from pack integrity");
  const manifestPath = `${consumer.generatedDirectory}/manifest.json`;
  const manifest = JSON.parse(readFileSync(join(root, consumer.directory, manifestPath), "utf8"));
  const coreMetadata = JSON.parse(readFileSync(join(root, "shared/plugin-core/package.json"), "utf8"));
  if (manifest.schemaVersion !== 1 || manifest.core?.name !== coreMetadata.name ||
      manifest.core?.version !== coreMetadata.version || !/^[a-f0-9]{64}$/.test(manifest.core?.sourceDigest) ||
      !["index.js", "index.d.ts", "package.json"].every(name => typeof manifest.files?.[name] === "string")) {
    throw new Error("Invalid embedded core manifest");
  }
  const readPacked = (name: string): Buffer => execFileSync("tar", ["-xOf", artifact, `package/${name}`]);
  const packedManifest = JSON.parse(readPacked(manifestPath).toString("utf8"));
  if (JSON.stringify(packedManifest) !== JSON.stringify(manifest)) throw new Error("Packed core manifest differs from source");
  for (const [name, expected] of Object.entries(manifest.files)) {
    if (!/^[a-z-]+\.(js|ts|json)$/.test(name) && !/^[a-z-]+\.d\.ts$/.test(name)) throw new Error("Invalid manifest path");
    const hash = createHash("sha256").update(readPacked(`${consumer.generatedDirectory}/${name}`)).digest("hex");
    if (hash !== expected) throw new Error(`Packed core hash mismatch: ${name}`);
  }
  return {
    schemaVersion: 1,
    sourceSha,
    plugin: { id: plugin, name: metadata.name, version: metadata.version },
    coreManifest: manifest,
    artifact: { filename: pack.filename, integrity, sha256: createHash("sha256").update(bytes).digest("hex") },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const verify = args[0] === "--verify";
  if (verify) args.shift();
  const [plugin, packPath, sourceSha, root] = args;
  if (!plugin || !packPath || !sourceSha) throw new Error("Usage: receipt.ts [--verify] <plugin> <pack.json> <source-sha> [source-root]");
  const expected = releaseReceipt(plugin, packPath, sourceSha, root ? resolve(root) : repositoryRoot);
  const receiptPath = join(dirname(packPath), "core-receipt.json");
  if (verify) {
    if (JSON.stringify(JSON.parse(readFileSync(receiptPath, "utf8"))) !== JSON.stringify(expected)) {
      throw new Error("Retained core receipt differs from reviewed source or artifact");
    }
    console.log(`Verified embedded core receipt for ${plugin}`);
  } else writeFileSync(receiptPath, JSON.stringify(expected, null, 2) + "\n");
}
