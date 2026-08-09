#!/usr/bin/env bash
#
# Installs the Nowledge Mem plugin and skill into Amp's per-user directories.
#
#   entry  -> ${XDG_CONFIG_HOME:-~/.config}/amp/plugins/nowledge-mem.ts
#   plugin -> ${XDG_CONFIG_HOME:-~/.config}/amp/plugins/nowledge-mem/
#   skill  -> ${XDG_CONFIG_HOME:-~/.config}/amp/skills/nowledge-mem/
#
# Amp discovers a single-file plugin from a root .ts/.js entry inside the
# plugins directory; the entry re-exports the bundle's default plugin so a
# bare bundle directory alone is not loadable. Re-running the script updates
# an existing installation. Restart Amp after installing or updating so the
# plugin and skill are picked up.

set -euo pipefail

PLUGIN_NAME="nowledge-mem"
AMP_CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/amp"
PLUGINS_DIR="$AMP_CONFIG_DIR/plugins"
SKILLS_DIR="$AMP_CONFIG_DIR/skills"
PLUGIN_DEST="$PLUGINS_DIR/$PLUGIN_NAME"
PLUGIN_ENTRY_DEST="$PLUGINS_DIR/$PLUGIN_NAME.ts"
SKILL_DEST="$SKILLS_DIR/$PLUGIN_NAME"

# Resolve the directory this script lives in, so the command works regardless
# of the caller's working directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_SRC="$(cd "$SCRIPT_DIR/.." && pwd)"

# Stage new files and old destinations outside the active installation. This
# makes failed replacement recoverable instead of leaving Amp partially installed.
mkdir -p "$PLUGINS_DIR" "$SKILLS_DIR"
STAGING_DIR="$(mktemp -d "$PLUGINS_DIR/.nowledge-mem-install.XXXXXX")"
cleanup() {
  rm -rf "$STAGING_DIR"
}
trap cleanup EXIT

STAGED_PLUGIN="$STAGING_DIR/plugin"
STAGED_SKILL="$STAGING_DIR/skill"
STAGED_ENTRY="$STAGING_DIR/entry.ts"
BACKUP_PLUGIN="$STAGING_DIR/old-plugin"
BACKUP_SKILL="$STAGING_DIR/old-skill"
BACKUP_ENTRY="$STAGING_DIR/old-entry.ts"

# Track which backups were created so restore_previous only removes/restores
# artifacts that have a valid backup. A failed backup leaves the live artifact
# in place (a failed mv keeps its source); the matching flag stays 0, so the
# live artifact is never deleted without a backup to restore from.
ENTRY_BACKED_UP=0
BUNDLE_BACKED_UP=0
SKILL_BACKED_UP=0

# Restore the previously active entry, bundle, and skill after a failed
# replacement. Only destinations whose backup succeeded are removed, and only
# those backups are restored, so the rm and restore sets always match.
restore_previous() {
  if [ "$ENTRY_BACKED_UP" -eq 1 ]; then
    rm -rf "$PLUGIN_ENTRY_DEST"
    mv "$BACKUP_ENTRY" "$PLUGIN_ENTRY_DEST"
  fi
  if [ "$BUNDLE_BACKED_UP" -eq 1 ]; then
    rm -rf "$PLUGIN_DEST"
    mv "$BACKUP_PLUGIN" "$PLUGIN_DEST"
  fi
  if [ "$SKILL_BACKED_UP" -eq 1 ]; then
    rm -rf "$SKILL_DEST"
    mv "$BACKUP_SKILL" "$SKILL_DEST"
  fi
}

install_staged() {
  if [ -e "$PLUGIN_ENTRY_DEST" ]; then
    if mv "$PLUGIN_ENTRY_DEST" "$BACKUP_ENTRY"; then
      ENTRY_BACKED_UP=1
    else
      return 1
    fi
  fi
  if [ -e "$PLUGIN_DEST" ]; then
    if mv "$PLUGIN_DEST" "$BACKUP_PLUGIN"; then
      BUNDLE_BACKED_UP=1
    else
      restore_previous
      return 1
    fi
  fi
  if [ -d "$STAGED_SKILL" ] && [ -e "$SKILL_DEST" ]; then
    if mv "$SKILL_DEST" "$BACKUP_SKILL"; then
      SKILL_BACKED_UP=1
    else
      restore_previous
      return 1
    fi
  fi
  if ! mv "$STAGED_PLUGIN" "$PLUGIN_DEST"; then
    restore_previous
    return 1
  fi
  if [ -d "$STAGED_SKILL" ] && ! mv "$STAGED_SKILL" "$SKILL_DEST"; then
    restore_previous
    return 1
  fi
  if ! mv "$STAGED_ENTRY" "$PLUGIN_ENTRY_DEST"; then
    restore_previous
    return 1
  fi
  rm -rf "$BACKUP_PLUGIN" "$BACKUP_SKILL" "$BACKUP_ENTRY"
}

echo "Installing Nowledge Mem for Amp"
echo "  source:  $PLUGIN_SRC"
echo "  entry:   $PLUGIN_ENTRY_DEST"
echo "  plugin:  $PLUGIN_DEST"
echo "  skill:   $SKILL_DEST"

# Stage the plugin, skill, and root entry before touching the active
# installation. The entry re-exports the bundle's default plugin so Amp
# discovers it as a single-file plugin (see the header comment).
cp -R "$PLUGIN_SRC" "$STAGED_PLUGIN"
if [ -d "$STAGED_PLUGIN/skills/$PLUGIN_NAME" ]; then
  cp -R "$STAGED_PLUGIN/skills/$PLUGIN_NAME" "$STAGED_SKILL"
fi
printf 'export { default } from "./nowledge-mem/src/index.ts"\n' > "$STAGED_ENTRY"

# Validate the staged bundle, skill, and entry before replacement.
if [ ! -f "$STAGED_PLUGIN/src/index.ts" ]; then
  echo "Error: staged plugin is missing src/index.ts" >&2
  exit 1
fi
if [ ! -f "$STAGED_PLUGIN/skills/$PLUGIN_NAME/SKILL.md" ]; then
  echo "Error: staged plugin is missing skills/$PLUGIN_NAME/SKILL.md" >&2
  exit 1
fi
if [ ! -f "$STAGED_ENTRY" ]; then
  echo "Error: staged root entry was not written" >&2
  exit 1
fi
if ! grep -q 'export { default } from "./nowledge-mem/src/index.ts"' "$STAGED_ENTRY"; then
  echo "Error: staged root entry does not re-export the bundle default" >&2
  exit 1
fi

if ! install_staged; then
  echo "Error: could not replace the active installation; previous files were restored." >&2
  exit 1
fi

echo
echo "Done. Restart Amp so the plugin and skill are loaded."
echo "Then verify with: nmem status"
