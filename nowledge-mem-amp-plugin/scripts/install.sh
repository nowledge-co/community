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

# Stage new files and old destinations outside the active installation. This
# makes failed replacement recoverable instead of leaving Amp partially installed.
STAGING_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$STAGING_DIR"
}
trap cleanup EXIT

STAGED_PLUGIN="$STAGING_DIR/plugin"
STAGED_SKILL="$STAGING_DIR/skill"
BACKUP_PLUGIN="$STAGING_DIR/old-plugin"
BACKUP_SKILL="$STAGING_DIR/old-skill"

restore_previous() {
  rm -rf "$PLUGIN_DEST" "$SKILL_DEST"
  if [ -e "$BACKUP_PLUGIN" ]; then
    mv "$BACKUP_PLUGIN" "$PLUGIN_DEST"
  fi
  if [ -e "$BACKUP_SKILL" ]; then
    mv "$BACKUP_SKILL" "$SKILL_DEST"
  fi
}

install_staged() {
  if [ -e "$PLUGIN_DEST" ] && ! mv "$PLUGIN_DEST" "$BACKUP_PLUGIN"; then
    return 1
  fi
  if [ -e "$SKILL_DEST" ] && ! mv "$SKILL_DEST" "$BACKUP_SKILL"; then
    restore_previous
    return 1
  fi
  if ! mv "$STAGED_PLUGIN" "$PLUGIN_DEST"; then
    restore_previous
    return 1
  fi
  if [ -d "$STAGED_SKILL" ] && ! mv "$STAGED_SKILL" "$SKILL_DEST"; then
    restore_previous
    return 1
  fi
  rm -rf "$BACKUP_PLUGIN" "$BACKUP_SKILL"
}

echo "Installing Nowledge Mem for Amp"
echo "  source:  $PLUGIN_SRC"
echo "  plugin:  $PLUGIN_DEST"
echo "  skill:   $SKILL_DEST"

mkdir -p "$PLUGINS_DIR" "$SKILLS_DIR"

# Stage the plugin and skill before touching the active installation.
cp -R "$PLUGIN_SRC" "$STAGED_PLUGIN"
if [ -d "$STAGED_PLUGIN/skills/$PLUGIN_NAME" ]; then
  cp -R "$STAGED_PLUGIN/skills/$PLUGIN_NAME" "$STAGED_SKILL"
fi

# Validate the staged plugin entrypoint exists before replacement.
if [ ! -f "$STAGED_PLUGIN/src/index.ts" ]; then
  echo "Error: staged plugin is missing src/index.ts" >&2
  exit 1
fi

if ! install_staged; then
  echo "Error: could not replace the active installation; previous files were restored." >&2
  exit 1
fi

echo
echo "Done. Restart Amp so the plugin and skill are loaded."
echo "Then verify with: nmem status"
