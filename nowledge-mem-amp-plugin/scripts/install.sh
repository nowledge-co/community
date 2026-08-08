#!/usr/bin/env bash
#
# Installs the Nowledge Mem plugin and skill into Amp's per-user directories.
#
#   plugin -> ~/.config/amp/plugins/nowledge-mem/
#   skill  -> ~/.config/amp/skills/nowledge-mem/
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

echo "Installing Nowledge Mem for Amp"
echo "  source:  $PLUGIN_SRC"
echo "  plugin:  $PLUGIN_DEST"
echo "  skill:   $SKILL_DEST"

mkdir -p "$PLUGINS_DIR" "$SKILLS_DIR"

# Remove a previous installation so a re-run is a clean update rather than a
# merge with stale files.
rm -rf "$PLUGIN_DEST" "$SKILL_DEST"

cp -R "$PLUGIN_SRC" "$PLUGIN_DEST"

# The plugin source contains the skill under skills/nowledge-mem/. Install the
# skill directory separately into Amp's skills root so Amp discovers it as a
# standalone skill.
if [ -d "$PLUGIN_DEST/skills/$PLUGIN_NAME" ]; then
  cp -R "$PLUGIN_DEST/skills/$PLUGIN_NAME" "$SKILL_DEST"
fi

echo
echo "Done. Restart Amp so the plugin and skill are loaded."
echo "Then verify with: nmem status"
