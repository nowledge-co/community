import { ActionPanel, Action, Form, showToast, Toast, Icon, useNavigation } from "@raycast/api";
import { useState } from "react";
import { useCachedPromise } from "@raycast/utils";
import { readWorkingMemory, writeWorkingMemory } from "./api";

export default function EditWorkingMemory() {
  const { pop } = useNavigation();
  const { isLoading, data: initialContent } = useCachedPromise(readWorkingMemory);
  const [content, setContent] = useState<string | undefined>(undefined);

  const displayContent = content ?? initialContent ?? "";

  async function handleSubmit() {
    try {
      await writeWorkingMemory(displayContent);
      await showToast({ style: Toast.Style.Success, title: "Working Memory updated" });
      pop();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to save",
        message: String(error),
      });
    }
  }

  if (isLoading && initialContent === undefined) {
    return <Form isLoading={true}><Form.TextArea id="content" title="Content" value="" /></Form>;
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Working Memory" icon={Icon.Check} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description text="Edit your Working Memory at ~/ai-now/memory.md. Changes are saved directly and respected by all connected AI tools." />
      <Form.TextArea
        id="content"
        title="Working Memory"
        value={displayContent}
        onChange={setContent}
        enableMarkdown
      />
    </Form>
  );
}
