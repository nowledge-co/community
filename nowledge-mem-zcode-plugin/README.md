# Nowledge Mem for ZCode

> A ZCode Plugin package that adds guided Nowledge Mem MCP tools and reusable Skills.

## What it provides

After the plugin is enabled, ZCode can use the Nowledge Mem MCP server and these Skills:

- `read-working-memory` — read Context Bundle or Working Memory when starting or resuming work
- `search-memory` — proactively search memories and exact prior threads
- `distill-memory` — save durable decisions, procedures, learnings, and context
- `save-handoff` — save a structured, resumable summary when explicitly requested
- `status` — diagnose Nowledge Mem connectivity
- `check-integration` — verify setup and explain the capability contract

This is a guided `MCP + Skills` integration. MCP tools are available to the agent, while Skills teach when to use them. Version 0.1.0 does not claim automatic recall injection, automatic full-transcript capture, pre-compaction capture, or `save-thread`: ZCode's session/transcript lifecycle contract has not been verified for this connector.

## Manual installation

The plugin package includes `.zcode-plugin/plugin.json` and a `marketplace.json` catalog for the standalone repository `https://github.com/nowledge-co/zcode-plugin`. ZCode has not published a default marketplace directory. For normal installation, use the standalone repository's marketplace source; the community checkout instructions below are only a development/review mirror.

### macOS/Linux

For normal installation, add the standalone repository's marketplace source in ZCode using the repository URL:

```text
https://github.com/nowledge-co/zcode-plugin
```

For local development or review of this community checkout, choose a stable checkout location and clone the community repository:

```bash
COMMUNITY_DIR="$HOME/src/nowledge-community"
git clone https://github.com/nowledge-co/community.git "$COMMUNITY_DIR"
```

If you already cloned it, update it later with:

```bash
git -C "$HOME/src/nowledge-community" pull --ff-only
```

Create a persistent local marketplace directory under the user data directory. This is a project-recommended location, not a ZCode-defined default path:

```bash
COMMUNITY_DIR="$HOME/src/nowledge-community"
MARKETPLACE_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/nowledge/zcode-marketplace"
mkdir -p "$MARKETPLACE_DIR"
python3 - "$MARKETPLACE_DIR" "$COMMUNITY_DIR/nowledge-mem-zcode-plugin" <<'PY'
import json
import pathlib
import sys

marketplace_dir = pathlib.Path(sys.argv[1]).expanduser().resolve()
plugin_dir = pathlib.Path(sys.argv[2]).expanduser().resolve()
marketplace_dir.mkdir(parents=True, exist_ok=True)
marketplace = {
    "name": "nowledge-community-zcode-local",
    "description": "Local Nowledge Mem ZCode plugin source",
    "plugins": [{
        "name": "nowledge-mem-zcode",
        "version": "0.1.0",
        "description": "Guided cross-tool memory for ZCode through Nowledge Mem MCP and Skills.",
        "source": {"source": "directory", "path": str(plugin_dir)},
    }],
}
(marketplace_dir / "marketplace.json").write_text(
    json.dumps(marketplace, indent=2) + "\n", encoding="utf-8"
)
print(f"Add this local marketplace directory in ZCode: {marketplace_dir}")
PY
```

Then open a ZCode workspace and:

1. Go to **Settings → Plugins**.
2. Select **Create → Add marketplace**.
3. Choose the persistent directory printed by the command above.
4. In the **Personal** section, install and enable `nowledge-mem-zcode`.
5. Reload or restart the ZCode Agent runtime.

The standalone repository's `marketplace.json` is the catalog used by the ZCode marketplace flow; `.zcode-plugin/plugin.json` remains the plugin manifest. The development-only generated catalog above is not a replacement for the standalone repository catalog.

### Windows PowerShell

Clone or update the community repository:

```powershell
$CommunityDir = Join-Path $HOME "src\nowledge-community"
git clone https://github.com/nowledge-co/community.git $CommunityDir
# For an existing checkout instead:
# git -C $CommunityDir pull --ff-only
```

Create the persistent user-owned marketplace directory and its catalog:

```powershell
$CommunityDir = Join-Path $HOME "src\nowledge-community"
$MarketplaceDir = Join-Path $env:LOCALAPPDATA "Nowledge\ZCode\marketplace"
$PluginDir = (Join-Path $CommunityDir "nowledge-mem-zcode-plugin")
New-Item -ItemType Directory -Force -Path $MarketplaceDir | Out-Null
@{
  name = "nowledge-community-zcode-local"
  description = "Local Nowledge Mem ZCode plugin source"
  plugins = @(@{
    name = "nowledge-mem-zcode"
    version = "0.1.0"
    description = "Guided cross-tool memory for ZCode through Nowledge Mem MCP and Skills."
    source = @{
      source = "directory"
      path = (Resolve-Path $PluginDir).Path
    }
  })
} | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 (Join-Path $MarketplaceDir "marketplace.json")
Write-Host "Add this local marketplace directory in ZCode: $MarketplaceDir"
```

In ZCode, use **Settings → Plugins → Create → Add marketplace**, choose `$MarketplaceDir`, install and enable `nowledge-mem-zcode`, and reload the Agent runtime.

### Updating the plugin and adding future plugins

Keep both the community checkout and the user-owned marketplace directory at stable, accessible paths. ZCode does not document whether local marketplace sources are copied, cached, watched, or referenced directly, nor does it document a default storage path. Do not delete or move the source if you want the documented refresh workflow to keep working.

To update this plugin:

```bash
git -C "$HOME/src/nowledge-community" pull --ff-only
```

Then open **Settings → Plugins → Marketplace sources** and choose **Refresh this marketplace**. Use **Manage installed → Check for updates** when ZCode offers that action, and reload the Agent runtime if components do not appear immediately.

To add another local plugin in the future, edit the persistent marketplace's `marketplace.json` and append another `plugins[]` entry with a unique `name`, version, description, and a valid absolute `directory` source path. Refresh the marketplace, then install and enable the new plugin from the Personal section. ZCode's documentation does not promise that a newly listed local plugin is automatically installed or that an existing install is automatically upgraded.

For remote SSH/WSL workspaces, local plugins do not automatically move with the workspace. ZCode documents that marketplace plugins are reinstalled remotely and that the remote environment must be able to reach the marketplace source. Keep the source available on the remote side or use a reachable GitHub/Git source instead.

## Mem connection

The package's default `.mcp.json` uses the local Nowledge Mem Desktop endpoint:

```text
http://127.0.0.1:14242/mcp/
```

Start Nowledge Mem Desktop and verify the CLI when using local mode:

```bash
nmem --json status
```

For Cloud, Access Anywhere, self-hosted, or another remote endpoint, configure the ZCode-owned MCP settings rather than editing the installed package:

```bash
nmem config client set url https://mem.example.com
nmem config client set api-key nmem_your_key
nmem config mcp show --host zcode
```

Paste the generated MCP block into ZCode's own MCP settings and reload the Agent runtime. API keys are intentionally absent from this repository and must not be passed as command-line arguments or written to logs. Direct MCP clients do not automatically inherit `~/.nowledge-mem/config.json`.

## Capability contract

| Capability | ZCode behavior in 0.1.0 |
|---|---|
| Context Bundle / Working Memory | Guided by Skills and MCP |
| Memory and thread search | Guided and proactive when relevant |
| Distillation | Guided; search before update/add |
| Status | CLI fallback plus MCP server tools |
| Handoff | Explicit structured summary only |
| Automatic recall injection | Not provided |
| Automatic transcript capture | Not provided |
| Pre-compaction capture | Not provided |
| Full `save-thread` import | Not provided |

A handoff is not a transcript. Do not describe `save-handoff` as lossless session capture.

## Customize without editing the plugin

Do not modify files under ZCode's installed plugin cache. Put project-specific memory guidance in the host's user/project instruction surface when available, or use ZCode's own settings and prompt customization. This keeps changes durable across plugin updates.

## Permissions and security

Enabling a third-party ZCode plugin grants it the permissions provided by its declared components. Review the manifest, `.mcp.json`, and Skills before enabling it. This package contains no executable hook or custom runtime process; its MCP server still has the access granted by the ZCode MCP client and the endpoint you configure.

## Development

Validate the self-contained package without credentials or a running ZCode UI:

```bash
node scripts/validate-plugin.mjs
```

The repository also has a static integration contract test. There is currently no verified headless ZCode plugin harness, so a successful static test is not a claim of live UI verification.
