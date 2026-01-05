#!/bin/bash

# Claude Code Context Syncer - Symlink Setup Script
# This script creates a symbolic link from ~/.claude/projects to your Obsidian vault
# enabling bidirectional sync across devices.

set -e  # Exit on error

echo "========================================"
echo "Claude Code Context Syncer Setup"
echo "========================================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     PLATFORM=Linux;;
    Darwin*)    PLATFORM=macOS;;
    CYGWIN*|MINGW*|MSYS*) PLATFORM=Windows;;
    *)          PLATFORM=Unknown;;
esac

echo "Detected platform: ${PLATFORM}"
echo ""

if [ "$PLATFORM" = "Windows" ]; then
    echo -e "${RED}ERROR: This script is for Linux/macOS only.${NC}"
    echo "For Windows, please run setup-symlink.ps1 in PowerShell as Administrator."
    exit 1
fi

# Get the Obsidian vault path from user
echo "This script will create a symbolic link from:"
echo "  ~/.claude/projects"
echo "to your Obsidian vault's Claude-Contexts folder."
echo ""
echo -e "${YELLOW}Note: This is typically inside your Obsidian vault.${NC}"
echo "Example: /home/user/Documents/MyVault/Claude-Contexts"
echo ""

read -p "Enter the FULL path to your Obsidian vault's Claude-Contexts folder: " VAULT_PATH

# Trim whitespace
VAULT_PATH=$(echo "$VAULT_PATH" | xargs)

# Expand tilde if present
VAULT_PATH="${VAULT_PATH/#\~/$HOME}"

# Validate the path exists
if [ ! -d "$VAULT_PATH" ]; then
    echo -e "${RED}ERROR: Directory does not exist: $VAULT_PATH${NC}"
    echo "Please ensure you've entered the correct path and try again."
    exit 1
fi

echo ""
echo "Target Obsidian path: $VAULT_PATH"
echo ""

# Check if ~/.claude/projects already exists
CLAUDE_PROJECTS="$HOME/.claude/projects"

if [ -e "$CLAUDE_PROJECTS" ]; then
    echo -e "${YELLOW}WARNING: ~/.claude/projects already exists.${NC}"

    # Check if it's already a symlink
    if [ -L "$CLAUDE_PROJECTS" ]; then
        CURRENT_TARGET=$(readlink "$CLAUDE_PROJECTS")
        echo "It's currently a symbolic link pointing to: $CURRENT_TARGET"

        if [ "$CURRENT_TARGET" = "$VAULT_PATH" ]; then
            echo -e "${GREEN}✓ Symbolic link is already set up correctly!${NC}"
            exit 0
        else
            echo ""
            read -p "Do you want to replace it with the new path? (y/N): " REPLACE
            if [[ ! "$REPLACE" =~ ^[Yy]$ ]]; then
                echo "Aborted."
                exit 0
            fi
            rm "$CLAUDE_PROJECTS"
        fi
    else
        # It's a regular directory
        echo "It's a regular directory (not a symlink)."
        echo ""
        echo "Options:"
        echo "  1. Backup and replace (recommended)"
        echo "  2. Merge contents into Obsidian vault then replace"
        echo "  3. Abort"
        echo ""
        read -p "Choose an option (1/2/3): " OPTION

        case "$OPTION" in
            1)
                BACKUP_PATH="$HOME/.claude/projects.backup.$(date +%Y%m%d_%H%M%S)"
                echo "Creating backup at: $BACKUP_PATH"
                mv "$CLAUDE_PROJECTS" "$BACKUP_PATH"
                echo -e "${GREEN}✓ Backup created successfully${NC}"
                ;;
            2)
                echo ""
                echo "Please manually copy the contents of ~/.claude/projects"
                echo "to your Obsidian vault at: $VAULT_PATH"
                echo ""
                echo "Then run this script again."
                exit 0
                ;;
            3)
                echo "Aborted."
                exit 0
                ;;
            *)
                echo -e "${RED}Invalid option. Aborted.${NC}"
                exit 1
                ;;
        esac
    fi
fi

# Ensure ~/.claude directory exists
mkdir -p "$HOME/.claude"

# Create the symbolic link
echo ""
echo "Creating symbolic link..."
ln -s "$VAULT_PATH" "$CLAUDE_PROJECTS"

# Verify the link was created
if [ -L "$CLAUDE_PROJECTS" ]; then
    LINK_TARGET=$(readlink "$CLAUDE_PROJECTS")
    echo -e "${GREEN}✓ Successfully created symbolic link!${NC}"
    echo ""
    echo "  ~/.claude/projects → $LINK_TARGET"
    echo ""
    echo -e "${GREEN}Setup complete!${NC}"
    echo ""
    echo "What this means:"
    echo "  • Claude Code will now read/write directly to your Obsidian vault"
    echo "  • All conversations sync automatically via Obsidian Sync"
    echo "  • You can use /resume on any device to continue conversations"
    echo ""
    echo "Next steps:"
    echo "  1. Ensure the Obsidian plugin is installed on this device"
    echo "  2. Make sure Obsidian Sync (or your sync method) is enabled"
    echo "  3. Try creating a conversation in Claude Code"
    echo "  4. Check your Obsidian vault - you should see the .jsonl files"
    echo ""
else
    echo -e "${RED}ERROR: Failed to create symbolic link${NC}"
    exit 1
fi
