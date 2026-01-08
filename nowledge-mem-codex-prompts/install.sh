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

# Function to install uv if not present
install_uv() {
    echo "📦 Installing uv (Python package manager)..."
    if curl -LsSf https://astral.sh/uv/install.sh | sh; then
        echo "✅ uv installed successfully"
        # Add to PATH for current session
        export PATH="$HOME/.cargo/bin:$PATH"
        return 0
    else
        echo "❌ Failed to install uv"
        return 1
    fi
}

# Check nmem CLI availability
echo "🔍 Checking nmem CLI availability..."
echo ""

# First check if nmem is directly available (bundled or installed)
if command -v nmem &> /dev/null; then
    NMEM_VERSION=$(nmem --version 2>&1 | head -n1)
    echo "✅ nmem CLI is installed: $NMEM_VERSION"
else
    # nmem not found - suggest installation options
    echo "⚠️  nmem CLI not found."
    echo ""
    echo "📋 Installation options:"
    echo ""
    
    # Check if uv is available for uvx option
    if command -v uv &> /dev/null; then
        echo "   Option 1 (Recommended): Use uvx (no installation needed)"
        echo "   --------------------------------------------------------"
        echo "   uvx nmem --version"
        echo ""
        echo "   Option 2: Install nmem with pip"
        echo "   --------------------------------"
        echo "   pip install nmem"
        echo ""
        echo "   Option 3: Install nmem with pipx (isolated)"
        echo "   -------------------------------------------"
        echo "   pipx install nmem"
    else
        # uv not available either - offer to install it
        echo "   Option 1 (Recommended): Use uvx (no installation needed)"
        echo "   --------------------------------------------------------"
        
        # Offer to install uv automatically
        if [ -t 1 ]; then
            # Interactive mode - check stdout (works when script is piped)
            read -p "   Install uv now? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                if install_uv; then
                    echo "   Now you can run: uvx nmem --version"
                fi
            else
                echo "   To install uv later, run:"
                echo "   curl -LsSf https://astral.sh/uv/install.sh | sh"
                echo ""
                echo "   Then use: uvx nmem <command>"
            fi
        else
            # Non-interactive mode (piped install)
            echo "   Install uv with:"
            echo "   curl -LsSf https://astral.sh/uv/install.sh | sh"
            echo ""
            echo "   Then use: uvx nmem <command>"
        fi
        
        echo ""
        echo "   Option 2: Install nmem with pip"
        echo "   --------------------------------"
        echo "   pip install nmem"
        echo ""
        echo "   Option 3: Install nmem with pipx (isolated)"
        echo "   -------------------------------------------"
        echo "   pipx install nmem"
    fi
fi

echo ""

# List all prompts
echo "📋 Installed prompts:"
ls -lh "$PROMPTS_DIR"/*.md 2>/dev/null | awk '{print "   " $9}' | sed "s|$PROMPTS_DIR/|   |" || echo "   No prompts installed"
echo ""
