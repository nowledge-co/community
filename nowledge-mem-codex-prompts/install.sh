#!/bin/bash
set -e

# Nowledge Mem Codex Custom Prompts Installer
# Installs custom prompts for Codex

PROMPTS_DIR="$HOME/.codex/prompts"
BACKUP_SUFFIX=".backup.$(date +%Y%m%d_%H%M%S)"
BASE_URL="https://raw.githubusercontent.com/nowledge-co/community/main/nowledge-mem-codex-prompts"

# Parse command line arguments
FORCE_OVERWRITE=false
# Check for --force in all arguments (handles both direct execution and curl pipe)
for arg in "$@"; do
    if [ "$arg" = "--force" ]; then
        FORCE_OVERWRITE=true
        break
    fi
done

echo "🚀 Installing Nowledge Mem custom prompts for Codex..."
if [ "$FORCE_OVERWRITE" = true ]; then
    echo "🔄 Force mode: Will overwrite existing files"
fi
echo ""

# Create prompts directory if it doesn't exist
if [ ! -d "$PROMPTS_DIR" ]; then
    echo "📁 Creating prompts directory: $PROMPTS_DIR"
    mkdir -p "$PROMPTS_DIR"
else
    echo "📁 Found existing prompts directory: $PROMPTS_DIR"
fi

# Function to install a prompt file
install_prompt() {
    local filename=$1
    local target_path="$PROMPTS_DIR/$filename"
    
    echo ""
    echo "📥 Installing: $filename"
    
    # Check if file already exists
    if [ -f "$target_path" ]; then
        if [ "$FORCE_OVERWRITE" = true ]; then
            echo "   🔄 Overwriting existing file"
        else
            local backup_path="${target_path}${BACKUP_SUFFIX}"
            echo "   ⚠️  File exists, backing up to: $(basename "$backup_path")"
            mv "$target_path" "$backup_path"
        fi
    fi
    
    # Download the file
    if curl -fsSL --retry 3 --retry-delay 2 "${BASE_URL}/${filename}" -o "$target_path"; then
        if [ -s "$target_path" ]; then
            echo "   ✅ Installed successfully"
            return 0
        else
            echo "   ❌ Downloaded file is empty"
            rm -f "$target_path"
            return 1
        fi
    else
        echo "   ❌ Failed to download $filename"
        # Remove empty/partial file if download failed
        rm -f "$target_path"
        return 1
    fi
}

# Install prompts with error handling
failed=0
for prompt in "save_session.md" "distill.md"; do
    if ! install_prompt "$prompt"; then
        failed=1
    fi
done

echo ""
if [ $failed -eq 1 ]; then
    echo "⚠️  Some prompts failed to install. Please check your internet connection and try again."
    echo "   You can also manually download the prompts from:"
    echo "   $BASE_URL"
    exit 1
else
    echo "🎉 Installation complete!"
fi

echo ""
echo "📚 Available commands in Codex:"
echo "   /prompts:save_session  - Save current session to Nowledge"
echo "   /prompts:distill       - Create memory entries from conversation"
echo ""
echo "💡 Tip: Make sure the nowledge_mem MCP server is configured in Codex"
echo ""

# List all prompts
echo "📋 Installed prompts:"
ls -lh "$PROMPTS_DIR"/*.md 2>/dev/null | awk '{print "   " $9}' | sed "s|$PROMPTS_DIR/|   |" || echo "   No prompts installed"
echo ""
