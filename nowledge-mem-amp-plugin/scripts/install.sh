#!/usr/bin/env bash
#
# Installs the Nowledge Mem plugin and skill into Amp's per-user directories.
#
#   plugin -> ~/.config/amp/plugins/nowledge-mem.ts
#   bundle -> ~/.config/amp/plugins/nowledge-mem/
#   skill  -> ~/.config/amp/skills/nowledge-mem/
#
# Re-running the script updates an existing installation. Restart Amp after
# installing or updating so the plugin and skill are picked up.

set -euo pipefail

PLUGIN_NAME="nowledge-mem"
AMP_CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/amp"
PLUGINS_DIR="$AMP_CONFIG_DIR/plugins"
SKILLS_DIR="$AMP_CONFIG_DIR/skills"
PLUGIN_BUNDLE_DEST="$PLUGINS_DIR/$PLUGIN_NAME"
PLUGIN_ENTRY_DEST="$PLUGINS_DIR/$PLUGIN_NAME.ts"
SKILL_DEST="$SKILLS_DIR/$PLUGIN_NAME"

# Resolve the directory this script lives in, so the command works regardless
# of the caller's working directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_SRC="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Installing Nowledge Mem for Amp"
echo "  source:  $PLUGIN_SRC"
echo "  plugin:  $PLUGIN_ENTRY_DEST"
echo "  bundle:  $PLUGIN_BUNDLE_DEST"
echo "  skill:   $SKILL_DEST"

mkdir -p "$PLUGINS_DIR" "$SKILLS_DIR"

TMP_BUNDLE="$(mktemp -d "$PLUGINS_DIR/.nowledge-mem.bundle.XXXXXX")"
TMP_SKILL="$(mktemp -d "$SKILLS_DIR/.nowledge-mem.skill.XXXXXX")"
TMP_ENTRY="$(mktemp "$PLUGINS_DIR/.nowledge-mem.entry.XXXXXX.ts")"

cleanup() {
  rm -rf "$TMP_BUNDLE" "$TMP_SKILL" "$TMP_ENTRY"
}
trap cleanup EXIT

cp -R "$PLUGIN_SRC"/. "$TMP_BUNDLE"/
printf 'export { default } from "./nowledge-mem/src/index.ts"\n' > "$TMP_ENTRY"

# The plugin source contains the skill under skills/nowledge-mem/. Install the
# skill directory separately into Amp's skills root so Amp discovers it as a
# standalone skill.
if [ -d "$TMP_BUNDLE/skills/$PLUGIN_NAME" ]; then
  cp -R "$TMP_BUNDLE/skills/$PLUGIN_NAME"/. "$TMP_SKILL"/
fi

test -f "$TMP_BUNDLE/src/index.ts"
test -f "$TMP_SKILL/SKILL.md"
grep -q 'export { default } from "./nowledge-mem/src/index.ts"' "$TMP_ENTRY"

# Stage first, then replace active files. A failed copy never leaves Amp with a
# half-written plugin.
rm -rf "$PLUGIN_BUNDLE_DEST" "$SKILL_DEST" "$PLUGIN_ENTRY_DEST"
mv "$TMP_BUNDLE" "$PLUGIN_BUNDLE_DEST"
mv "$TMP_SKILL" "$SKILL_DEST"
mv "$TMP_ENTRY" "$PLUGIN_ENTRY_DEST"
trap - EXIT

echo
echo "Done. Restart Amp so the plugin and skill are loaded."
echo "Then verify with: nmem status"
