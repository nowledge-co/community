#!/usr/bin/env bash
#
# Installs the Nowledge Mem plugin and skill into Amp's per-user directories.
#
#   plugin -> ${XDG_CONFIG_HOME:-~/.config}/amp/plugins/nowledge-mem/
#   skill  -> ${XDG_CONFIG_HOME:-~/.config}/amp/skills/nowledge-mem/
#
# Re-running the script updates an existing installation. Restart Amp after
# installing or updating so the plugin and skill are picked up.

set -euo pipefail

PLUGIN_NAME="nowledge-mem"
AMP_CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/amp"
PLUGINS_DIR="$AMP_CONFIG_DIR/plugins"
SKILLS_DIR="$AMP_CONFIG_DIR/skills"
PLUGIN_DEST="$PLUGINS_DIR/$PLUGIN_NAME"
SKILL_DEST="$SKILLS_DIR/$PLUGIN_NAME"

# Resolve the directory this script lives in, so the command works regardless
# of the caller's working directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_SRC="$(cd "$SCRIPT_DIR/.." && pwd)"

# Use a temporary staging directory so a failed copy never leaves Amp without
# the plugin or skill. The active installation is replaced only after staging
# succeeds.
STAGING_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$STAGING_DIR"
}
trap cleanup EXIT

STAGED_PLUGIN="$STAGING_DIR/plugin"
STAGED_SKILL="$STAGING_DIR/skill"

echo "Installing Nowledge Mem for Amp"
echo "  source:  $PLUGIN_SRC"
echo "  plugin:  $PLUGIN_DEST"
echo "  skill:   $SKILL_DEST"

mkdir -p "$PLUGINS_DIR" "$SKILLS_DIR"

# Stage the plugin and skill into the temporary directory first.
cp -R "$PLUGIN_SRC" "$STAGED_PLUGIN"

# The plugin source contains the skill under skills/nowledge-mem/. Stage the
# skill directory separately so Amp discovers it as a standalone skill.
if [ -d "$STAGED_PLUGIN/skills/$PLUGIN_NAME" ]; then
  cp -R "$STAGED_PLUGIN/skills/$PLUGIN_NAME" "$STAGED_SKILL"
fi

# Validate the staged plugin entrypoint exists before replacing the active
# installation.
if [ ! -f "$STAGED_PLUGIN/src/index.ts" ]; then
  echo "Error: staged plugin is missing src/index.ts" >&2
  exit 1
fi

# Replace the active installation atomically.
rm -rf "$PLUGIN_DEST" "$SKILL_DEST"
mv "$STAGED_PLUGIN" "$PLUGIN_DEST"

if [ -d "$STAGED_SKILL" ]; then
  mv "$STAGED_SKILL" "$SKILL_DEST"
fi

echo
echo "Done. Restart Amp so the plugin and skill are loaded."
echo "Then verify with: nmem status"
