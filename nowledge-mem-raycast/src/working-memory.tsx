import { Detail, ActionPanel, Action, Icon } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { readWorkingMemory } from "./api";

export default function WorkingMemory() {
  const { isLoading, data: content } = useCachedPromise(readWorkingMemory);

  if (!content) {
    return (
      <Detail
        isLoading={isLoading}
        markdown={
          isLoading
            ? "Loading Working Memory..."
            : "# Working Memory not available\n\nEnsure Nowledge Mem is running with Background Intelligence enabled.\n\nThe daily briefing is generated each morning and saved to `~/ai-now/memory.md`."
        }
      />
    );
  }

  return (
    <Detail
      isLoading={isLoading}
      markdown={content}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copy Working Memory" content={content} />
          <Action.Open
            title="Open File"
            target={`${process.env.HOME}/ai-now/memory.md`}
            icon={Icon.Document}
          />
        </ActionPanel>
      }
    />
  );
}
