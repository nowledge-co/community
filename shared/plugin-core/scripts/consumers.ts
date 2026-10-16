import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

export type Consumer = {
  id: string;
  directory: string;
  generatedDirectory: string;
  dependents: string[];
};

export function consumers(root = repositoryRoot): Consumer[] {
  const config = JSON.parse(readFileSync(resolve(root, "shared/plugin-core/consumers.json"), "utf8"));
  const registry = JSON.parse(readFileSync(resolve(root, "integrations.json"), "utf8"));
  if (config.schemaVersion !== 1 || !Array.isArray(config.consumers)) {
    throw new Error("Unsupported core consumer configuration");
  }
  const seen = new Set<string>();
  for (const consumer of config.consumers as Consumer[]) {
    const integration = registry.integrations.find((entry: { id: string }) => entry.id === consumer.id);
    if (!integration || integration.directory !== consumer.directory || seen.has(consumer.id)) {
      throw new Error(`Invalid or duplicate core consumer: ${consumer.id}`);
    }
    if (!/^(?:(src|extensions)\/)?generated\/plugin-core$/.test(consumer.generatedDirectory)) {
      throw new Error(`Invalid generated directory: ${consumer.generatedDirectory}`);
    }
    const destination = resolve(root, consumer.directory, consumer.generatedDirectory);
    if (!destination.startsWith(resolve(root) + sep)) throw new Error("Generated path escapes repository");
    if (!Array.isArray(consumer.dependents) || consumer.dependents.some(id =>
      !registry.integrations.some((entry: { id: string }) => entry.id === id))) {
      throw new Error(`Unknown dependent of ${consumer.id}`);
    }
    seen.add(consumer.id);
  }
  return config.consumers;
}
