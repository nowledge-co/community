import {
  Action,
  ActionPanel,
  Color,
  Detail,
  Icon,
  List,
  showToast,
  Toast,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useEffect, useMemo, useState } from "react";
import {
  exploreGraphFromMemories,
  getGraphSample,
  searchGraph,
  type GraphEdge,
  type GraphNode,
  type GraphResponse,
} from "./api";

function nodeIcon(nodeType?: string): Icon {
  switch ((nodeType || "").toUpperCase()) {
    case "MEMORY":
      return Icon.MemoryChip;
    case "THREAD":
      return Icon.Message;
    case "PERSON":
      return Icon.Person;
    case "ORGANIZATION":
      return Icon.Building;
    case "EVENT":
      return Icon.Calendar;
    case "LOCATION":
      return Icon.Pin;
    case "CONCEPT":
      return Icon.LightBulb;
    default:
      return Icon.Dot;
  }
}

function nodeColor(nodeType?: string): Color {
  switch ((nodeType || "").toUpperCase()) {
    case "MEMORY":
      return Color.Blue;
    case "THREAD":
      return Color.Orange;
    case "PERSON":
      return Color.Green;
    case "ORGANIZATION":
      return Color.Purple;
    case "EVENT":
      return Color.Magenta;
    case "LOCATION":
      return Color.Red;
    case "CONCEPT":
      return Color.Yellow;
    default:
      return Color.SecondaryText;
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export function GraphNodeDetail({
  node,
  edges,
  nodes,
}: {
  node: GraphNode;
  edges: GraphEdge[];
  nodes: GraphNode[];
}) {
  const related = edges
    .filter((edge) => edge.source === node.id || edge.target === node.id)
    .map((edge) => {
      const otherId = edge.source === node.id ? edge.target : edge.source;
      const otherNode = nodes.find((candidate) => candidate.id === otherId);
      const direction = edge.source === node.id ? "→" : "←";
      const label = edge.label || edge.edge_type;
      return `${direction} **${label}** ${otherNode?.label || otherId}`;
    });

  const metadataLines = Object.entries(node.metadata || {})
    .slice(0, 8)
    .map(([key, value]) => `- **${key}**: ${String(value)}`);

  const markdown = [
    `# ${node.label}`,
    `**Type:** ${node.node_type}`,
    node.community ? `**Community:** ${node.community}` : "",
    typeof node.importance === "number"
      ? `**Importance:** ${(node.importance * 100).toFixed(0)}%`
      : "",
    metadataLines.length ? `## Metadata\n${metadataLines.join("\n")}` : "",
    related.length
      ? `## Connections\n${related
          .slice(0, 20)
          .map((line) => `- ${line}`)
          .join("\n")}`
      : "## Connections\n- No visible connections in this result set",
  ]
    .filter(Boolean)
    .join("\n\n");

  return (
    <Detail
      markdown={markdown}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label
            title="Type"
            text={node.node_type}
            icon={nodeIcon(node.node_type)}
          />
          <Detail.Metadata.Label
            title="Connections"
            text={String(related.length)}
            icon={Icon.Link}
          />
          {node.community && (
            <Detail.Metadata.Label
              title="Community"
              text={node.community}
              icon={Icon.TwoPeople}
            />
          )}
          <Detail.Metadata.Label
            title="Node ID"
            text={node.id}
            icon={Icon.Hashtag}
          />
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          {node.node_type?.toUpperCase() === "MEMORY" && (
            <Action.Open
              title="Open Memory in Nowledge Mem"
              target={`nowledgemem://memory/${node.id}`}
              icon={Icon.AppWindow}
            />
          )}
          <Action.CopyToClipboard title="Copy Node ID" content={node.id} />
          <Action.CopyToClipboard
            title="Copy Node Label"
            content={node.label}
          />
        </ActionPanel>
      }
    />
  );
}

interface GraphExplorerViewProps {
  initialQuery?: string;
  initialNodeId?: string;
  initialNodeLabel?: string;
}

export function GraphExplorerView({
  initialQuery = "",
  initialNodeId,
  initialNodeLabel,
}: GraphExplorerViewProps) {
  const [searchText, setSearchText] = useState(initialQuery);

  const { isLoading, data, error } = useCachedPromise(
    async (query: string, nodeId?: string): Promise<GraphResponse> => {
      if (query.trim()) return searchGraph(query.trim(), 40, 2);
      if (nodeId) return exploreGraphFromMemories([nodeId], 2, 100);
      return getGraphSample(80, 1);
    },
    [searchText, initialNodeId, initialNodeLabel],
    { keepPreviousData: true },
  );

  useEffect(() => {
    if (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Graph request failed",
        message: error.message,
      });
    }
  }, [error]);

  const sections = useMemo(() => {
    const byType = new Map<string, GraphNode[]>();
    for (const node of data?.nodes || []) {
      const key = (node.node_type || "Unknown").toUpperCase();
      const current = byType.get(key) || [];
      current.push(node);
      byType.set(key, current);
    }
    return [...byType.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data]);

  return (
    <List
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Explore the knowledge graph..."
      throttle
      searchText={searchText}
    >
      <List.EmptyView
        title="No graph results"
        description={
          searchText
            ? "Try a broader concept, person, project, or memory topic."
            : initialNodeId
              ? "No visible graph neighborhood for this memory yet."
              : "No graph data available yet."
        }
        icon={Icon.Network}
      />
      {!searchText && initialNodeId && initialNodeLabel && (
        <List.Section title="Starting Point" subtitle="Seed memory">
          <List.Item
            icon={{ source: Icon.MemoryChip, tintColor: Color.Blue }}
            title={initialNodeLabel}
            subtitle={initialNodeId}
            accessories={[{ text: "Seed" }]}
          />
        </List.Section>
      )}
      {sections.map(([type, nodes]) => (
        <List.Section
          key={type}
          title={type}
          subtitle={`${nodes.length} nodes`}
        >
          {nodes.map((node) => {
            const connections = (data?.edges || []).filter(
              (edge) => edge.source === node.id || edge.target === node.id,
            ).length;

            return (
              <List.Item
                key={node.id}
                icon={{
                  source: nodeIcon(node.node_type),
                  tintColor: nodeColor(node.node_type),
                }}
                title={node.label || node.id}
                subtitle={truncate(
                  String(
                    node.metadata?.summary ||
                      node.metadata?.description ||
                      node.metadata?.title ||
                      node.id,
                  ),
                  60,
                )}
                accessories={[
                  ...(node.community ? [{ text: node.community }] : []),
                  { icon: Icon.Link, text: String(connections) },
                ]}
                actions={
                  <ActionPanel>
                    <Action.Push
                      title="View Node"
                      icon={Icon.Eye}
                      target={
                        <GraphNodeDetail
                          node={node}
                          edges={data?.edges || []}
                          nodes={data?.nodes || []}
                        />
                      }
                    />
                    {node.node_type?.toUpperCase() === "MEMORY" && (
                      <Action.Push
                        title="Explore Connections"
                        icon={Icon.Network}
                        target={
                          <GraphExplorerView
                            initialNodeId={node.id}
                            initialNodeLabel={node.label}
                          />
                        }
                        shortcut={{ modifiers: ["cmd"], key: "g" }}
                      />
                    )}
                    {node.node_type?.toUpperCase() === "MEMORY" && (
                      <Action.Open
                        title="Open Memory in Nowledge Mem"
                        target={`nowledgemem://memory/${node.id}`}
                        icon={Icon.AppWindow}
                        shortcut={{ modifiers: ["cmd"], key: "o" }}
                      />
                    )}
                    <Action.CopyToClipboard
                      title="Copy Node Label"
                      content={node.label}
                    />
                    <Action.CopyToClipboard
                      title="Copy Node ID"
                      content={node.id}
                    />
                  </ActionPanel>
                }
              />
            );
          })}
        </List.Section>
      ))}
    </List>
  );
}

export default function ExploreGraph() {
  return <GraphExplorerView />;
}
