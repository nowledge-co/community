import { open, showToast, Toast } from "@raycast/api";
import { homedir } from "os";
import { join } from "path";
import { existsSync } from "fs";
import { getConnectionConfig, isLocalConnection } from "./api";

export default async function EditWorkingMemory() {
  if (!isLocalConnection()) {
    const { baseUrl } = getConnectionConfig();
    await showToast({
      style: Toast.Style.Failure,
      title: "Local File Editing Only",
      message: `This command edits the Default Working Memory file on the local machine. Current connection: ${baseUrl}`,
    });
    return;
  }

  const filePath = join(homedir(), "ai-now", "memory.md");

  if (!existsSync(filePath)) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Working Memory Not Found",
      message:
        "Enable Background Intelligence in Nowledge Mem to generate the Default-space daily briefing.",
    });
    return;
  }

  await open(filePath);
}
