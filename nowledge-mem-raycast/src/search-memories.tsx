import { ActionPanel, Action, List, Icon, Color, Detail } from "@raycast/api";
import { useState } from "react";
import { useCachedPromise } from "@raycast/utils";
import { searchMemories, listMemories, type SearchResult, type Memory } from "./api";

function importanceColor(importance: number): Color {
  if (importance >= 0.8) return Color.Red;
  if (importance >= 0.5) return Color.Orange;
  return Color.Green;
}

function MemoryDetail({ memory, score }: { memory: Memory; score?: number }) {
  const md = [
    `# ${memory.title || "Untitled"}`,
    "",
    memory.content,
    "",
    "---",
    "",
    `**ID:** \`${memory.id}\``,
    `**Importance:** ${memory.importance}`,
    memory.labels?.length ? `**Labels:** ${memory.labels.join(", ")}` : "",
    memory.unit_type ? `**Type:** ${memory.unit_type}` : "",
    score !== undefined ? `**Relevance:** ${(score * 100).toFixed(0)}%` : "",
    `**Created:** ${new Date(memory.created_at).toLocaleDateString()}`,
  ]
    .filter(Boolean)
    .join("\n");

  return <Detail markdown={md} />;
}

export default function SearchMemories() {
  const [searchText, setSearchText] = useState("");

  const {
    isLoading: searchLoading,
    data: searchResults,
  } = useCachedPromise(
    async (query: string) => {
      if (!query) return null;
      return searchMemories(query, 15);
    },
    [searchText],
    { keepPreviousData: true },
  );

  const {
    isLoading: recentLoading,
    data: recentMemories,
  } = useCachedPromise(
    async () => listMemories(15),
    [],
  );

  const isLoading = searchText ? searchLoading : recentLoading;

  if (searchText && searchResults) {
    return (
      <List
        isLoading={isLoading}
        onSearchTextChange={setSearchText}
        searchBarPlaceholder="Search your knowledge base..."
        throttle
      >
        <List.Section title="Results" subtitle={`${searchResults.length} memories`}>
          {searchResults.map((result: SearchResult) => (
            <List.Item
              key={result.memory.id}
              title={result.memory.title || "Untitled"}
              subtitle={result.memory.content.substring(0, 80)}
              accessories={[
                {
                  tag: {
                    value: `${(result.similarity_score * 100).toFixed(0)}%`,
                    color: importanceColor(result.similarity_score),
                  },
                },
                { date: new Date(result.memory.created_at) },
              ]}
              actions={
                <ActionPanel>
                  <Action.Push
                    title="View Memory"
                    icon={Icon.Eye}
                    target={<MemoryDetail memory={result.memory} score={result.similarity_score} />}
                  />
                  <Action.CopyToClipboard title="Copy Content" content={result.memory.content} />
                  <Action.CopyToClipboard
                    title="Copy Title"
                    content={result.memory.title || ""}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                  />
                  <Action.Open
                    title="Open in Nowledge Mem"
                    target={`nowledgemem://memory/${result.memory.id}`}
                    shortcut={{ modifiers: ["cmd"], key: "o" }}
                  />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      </List>
    );
  }

  return (
    <List
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search your knowledge base..."
      throttle
    >
      <List.Section title="Recent Memories" subtitle={`${recentMemories?.length ?? 0} memories`}>
        {(recentMemories ?? []).map((memory: Memory) => (
          <List.Item
            key={memory.id}
            title={memory.title || "Untitled"}
            subtitle={memory.content.substring(0, 80)}
            accessories={[
              ...(memory.labels?.length
                ? [{ tag: memory.labels[0] }]
                : []),
              {
                tag: {
                  value: String(memory.importance),
                  color: importanceColor(memory.importance),
                },
              },
              { date: new Date(memory.created_at) },
            ]}
            actions={
              <ActionPanel>
                <Action.Push
                  title="View Memory"
                  icon={Icon.Eye}
                  target={<MemoryDetail memory={memory} />}
                />
                <Action.CopyToClipboard title="Copy Content" content={memory.content} />
                <Action.Open
                  title="Open in Nowledge Mem"
                  target={`nowledgemem://memory/${memory.id}`}
                  shortcut={{ modifiers: ["cmd"], key: "o" }}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}
