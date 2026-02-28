#!/bin/bash
# Nowledge Mem APT Repository Setup
# Usage: curl -fsSL https://nowledge-co.github.io/community/apt/install.sh | sudo bash
#
# This script adds the Nowledge Mem APT repository to your system,
# enabling automatic updates via apt upgrade.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Setting up Nowledge Mem APT repository...${NC}"
echo ""

# Check for root
if [ "$(id -u)" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root (use sudo)${NC}"
    echo "  curl -fsSL https://nowledge-co.github.io/community/apt/install.sh | sudo bash"
    exit 1
fi

# Check architecture
ARCH=$(dpkg --print-architecture 2>/dev/null || echo "unknown")
if [ "$ARCH" != "amd64" ]; then
    echo -e "${YELLOW}Warning: Nowledge Mem currently only provides amd64 packages.${NC}"
    echo "  Your architecture: $ARCH"
    echo "  Continuing anyway (the repo will be configured but packages may not be available)."
    echo ""
fi

# Check for required tools
for cmd in curl gpg; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo -e "${RED}Error: $cmd is required but not installed.${NC}"
        echo "  sudo apt-get install -y $cmd"
        exit 1
    fi
done

# Step 1: Install the GPG signing key
echo "1/3 Installing GPG signing key..."
install -m 0755 -d /usr/share/keyrings
curl -fsSL https://nowledge-co.github.io/community/apt/nowledge-mem-archive-keyring.gpg \
    -o /usr/share/keyrings/nowledge-mem-archive-keyring.gpg
chmod 644 /usr/share/keyrings/nowledge-mem-archive-keyring.gpg
echo -e "  ${GREEN}GPG key installed to /usr/share/keyrings/nowledge-mem-archive-keyring.gpg${NC}"

# Step 2: Add the APT repository
echo "2/3 Adding APT repository..."
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/nowledge-mem-archive-keyring.gpg] https://download-mem.nowledge.co/apt stable main" \
    > /etc/apt/sources.list.d/nowledge-mem.list
echo -e "  ${GREEN}Repository added to /etc/apt/sources.list.d/nowledge-mem.list${NC}"

# Step 3: Update package index
echo "3/3 Updating package index..."
apt-get update -o Dir::Etc::sourcelist="sources.list.d/nowledge-mem.list" \
               -o Dir::Etc::sourceparts="-" \
               -o APT::Get::List-Cleanup="0" \
               --quiet 2>/dev/null

echo ""
echo -e "${GREEN}Nowledge Mem APT repository configured successfully!${NC}"
echo ""
echo "You can now install Nowledge Mem with:"
echo "  sudo apt-get install nowledge-mem"
echo ""
echo "Future updates will be available via:"
echo "  sudo apt-get update && sudo apt-get upgrade"
echo ""
echo "To remove the repository:"
echo "  sudo rm /etc/apt/sources.list.d/nowledge-mem.list"
echo "  sudo rm /usr/share/keyrings/nowledge-mem-archive-keyring.gpg"
