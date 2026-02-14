import { getPreferenceValues } from "@raycast/api";

interface Preferences {
  serverUrl: string;
}

function getBaseUrl(): string {
  const { serverUrl } = getPreferenceValues<Preferences>();
  return serverUrl || "http://localhost:14242";
}

export interface Memory {
  id: string;
  title: string;
  content: string;
  importance: number;
  labels: string[];
  created_at: string;
  unit_type?: string;
}

export interface SearchResult {
  memory: Memory;
  similarity_score: number;
  relevance_reason?: string;
}

export async function searchMemories(query: string, limit = 10): Promise<SearchResult[]> {
  const url = `${getBaseUrl()}/memories/search`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit, mode: "fast" }),
  });

  if (!res.ok) {
    throw new Error(`Search failed: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as SearchResult[];
}

export async function listMemories(limit = 20): Promise<Memory[]> {
  const url = `${getBaseUrl()}/memories?limit=${limit}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`List failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { memories: Memory[] };
  return data.memories;
}

export interface CreateMemoryRequest {
  content: string;
  title?: string;
  importance?: number;
  labels?: string[];
}

export async function createMemory(req: CreateMemoryRequest): Promise<Memory> {
  const url = `${getBaseUrl()}/memories`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    throw new Error(`Create failed: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as Memory;
}

function getWorkingMemoryPath(): string {
  const os = require("os");
  const path = require("path");
  return path.join(os.homedir(), "ai-now", "memory.md");
}

export async function readWorkingMemory(): Promise<string> {
  const fs = await import("fs");
  const filePath = getWorkingMemoryPath();

  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

export async function writeWorkingMemory(content: string): Promise<void> {
  const fs = await import("fs");
  const filePath = getWorkingMemoryPath();
  fs.writeFileSync(filePath, content, "utf-8");
}
