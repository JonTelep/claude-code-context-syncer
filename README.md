# Claude Code Context Syncer for Obsidian

Automatically sync Claude Code conversation contexts to your Obsidian vault for cross-device synchronization.

## Overview

Claude Code stores conversation contexts as JSONL files in `~/.claude/projects/`. When you run `/resume` in Claude Code, it reads from these files. This plugin automatically copies these contexts to your Obsidian vault so they sync across devices via Obsidian Sync (or any other sync method you choose).

## Features

- **Bidirectional Cross-Device Sync**: Use symbolic links to enable seamless sync across all your devices
- **Automatic File Watching**: Detects when Claude Code creates or modifies conversation files
- **Debounced Syncing**: Intelligent debouncing ensures files are completely written before syncing
- **Cross-Platform**: Works on Windows, macOS, and Linux with automated setup scripts
- **Metadata Generation**: Creates metadata files with timestamps, message counts, and git info
- **Initial Sync**: Automatically syncs all existing conversations on first run
- **Manual Sync**: Trigger one-time syncs on demand
- **Status Bar**: Shows last sync time and project count
- **Smart Conflict Handling**: Only updates when source files are newer

## Installation

### Manual Installation

1. Download or clone this repository
2. Copy the following files to your vault's plugins folder:
   ```
   .obsidian/plugins/claude-context-syncer/
   ├── main.js
   ├── manifest.json
   └── styles.css (if created)
   ```
3. Reload Obsidian
4. Enable "Claude Context Syncer" in Settings → Community Plugins

### From Source

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/claude-code-context-syncer.git
   cd claude-code-context-syncer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the plugin:
   ```bash
   npm run build
   ```

4. Copy `main.js` and `manifest.json` to your vault's plugin folder:
   ```bash
   mkdir -p /path/to/your/vault/.obsidian/plugins/claude-context-syncer
   cp main.js manifest.json /path/to/your/vault/.obsidian/plugins/claude-context-syncer/
   ```

## Configuration

### Required Settings

1. **Claude Projects Path**: Full path to your `.claude/projects` directory
   - Examples:
     - Linux/macOS: `/home/username/.claude/projects` or `~/.claude/projects`
     - Windows: `C:\Users\username\.claude\projects`

2. **Obsidian Storage Path**: Folder within your vault where contexts will be stored
   - Example: `Claude-Contexts`
   - This is a relative path from your vault root

### Optional Settings

- **Enable Auto-sync**: Automatically sync when Claude Code creates/modifies files (default: enabled)
- **Sync on Startup**: Sync all existing conversations when Obsidian starts (default: enabled)

## Usage

### First Time Setup

1. Open Settings → Claude Context Syncer
2. Enter your Claude Projects Path (e.g., `~/.claude/projects`)
3. Enter your Obsidian Storage Path (e.g., `Claude-Contexts`)
4. Click "Test Connection" to verify the path is valid
5. The plugin will automatically sync all existing conversations

### Normal Operation

Once configured, the plugin works automatically in the background:

1. When you use Claude Code, conversations are saved to `~/.claude/projects/`
2. The plugin detects new or modified files within 2-3 seconds
3. Files are synced to your Obsidian vault
4. Your vault syncs across devices (via Obsidian Sync, iCloud, Dropbox, etc.)
5. On other devices, the synced contexts are available in `~/.claude/projects/`

### Manual Sync

You can trigger a one-time sync of all conversations:

1. Open Settings → Claude Context Syncer
2. Click "Sync Now"
3. Wait for the sync to complete

### Viewing Sync Status

- Check the status bar at the bottom of Obsidian
- Shows "Claude: 5m ago" for last sync time
- Shows "Claude: Not configured" if setup is incomplete
- Shows "Claude: Syncing... 45/123" during sync operations

### Viewing Synced Files

**Note:** Obsidian's file explorer only shows markdown files (`.md`) by default. Your `.jsonl` and `.meta.json` files are synced successfully but won't appear in the normal file browser.

**To view your synced conversations:**

1. **Quick Switcher**: Press `Ctrl+O` (or `Cmd+O` on Mac) and type `.jsonl` to see all conversation files
2. **File Manager**: Use your system's file manager to browse the vault folder directly
3. **Terminal/Command Line**:
   ```bash
   ls -la "/path/to/vault/Claude-Contexts"
   ```

The files ARE there and syncing correctly - they're just hidden from Obsidian's default view since they're not markdown files.

## Vault Structure

Synced conversations are organized in your vault as follows:

```
Your Vault/
└── Claude-Contexts/              # Your configured storage path
    ├── home - user - project1/   # Decoded project name
    │   ├── session-uuid-1.jsonl
    │   ├── session-uuid-1.meta.json
    │   ├── session-uuid-2.jsonl
    │   └── session-uuid-2.meta.json
    └── home - user - project2/
        ├── session-uuid-3.jsonl
        └── session-uuid-3.meta.json
```

### Metadata Files

Each `.meta.json` file contains:

```json
{
  "sessionId": "abc-123",
  "projectName": "home - user - my-project",
  "projectPath": "home%2Fuser%2Fmy-project",
  "messageCount": 42,
  "firstTimestamp": 1704326400000,
  "lastTimestamp": 1704412800000,
  "gitBranch": "main",
  "version": "1.0.0",
  "syncedAt": 1704413000000,
  "sourceFilePath": "/home/user/.claude/projects/..."
}
```

## Cross-Device Bidirectional Sync

This plugin enables **true bidirectional synchronization** across all your devices through Obsidian Sync. Here's how it works:

### How Bidirectional Sync Works

**The Magic: Symbolic Links**

Instead of copying files back and forth, we use symbolic links to make Claude Code read/write **directly** to your Obsidian vault. This creates seamless bidirectional sync:

```
Device 1:                              Device 2:
~/.claude/projects/                    ~/.claude/projects/ (symlink)
      ↓                                       ↓
Obsidian/Claude-Contexts  ←→  [Obsidian Sync]  ←→  Obsidian/Claude-Contexts
```

**What This Means:**
- ✅ Create conversations on Device 1 → instantly available on Device 2
- ✅ Continue conversations on Device 2 → changes sync back to Device 1
- ✅ Use `/resume` on any device to access any conversation
- ✅ No manual copying or complex sync logic needed

### Setup Instructions

#### Device 1 (Primary Device)

1. **Install the plugin in Obsidian**
   - Follow the installation instructions above

2. **Configure the plugin**
   - Open Settings → Claude Context Syncer
   - Claude Projects Path: `~/.claude/projects`
   - Obsidian Storage Path: `Claude-Contexts` (or your preferred folder)
   - Click "Test Connection"

3. **Enable vault synchronization**
   - Set up Obsidian Sync, iCloud, Dropbox, Syncthing, or any sync service
   - Ensure the Claude-Contexts folder is included in sync

4. **Initial sync**
   - The plugin will automatically sync existing conversations
   - Your conversations will now sync via Obsidian

#### Device 2+ (Secondary Devices)

**Option A: Automated Setup (Recommended)**

We provide setup scripts that handle everything automatically:

**Linux/macOS:**
```bash
# From the plugin repository directory
./setup-symlink.sh
```

**Windows (PowerShell as Administrator):**
```powershell
# From the plugin repository directory
.\setup-symlink.ps1
```

The script will:
- ✅ Check if `~/.claude/projects` exists and offer to back it up
- ✅ Create the symbolic link to your Obsidian vault
- ✅ Verify the setup is correct
- ✅ Provide next steps

**Option B: Manual Setup**

If you prefer to set up manually:

**Linux/macOS:**
```bash
# 1. Backup existing projects (if any)
mv ~/.claude/projects ~/.claude/projects.backup

# 2. Create symbolic link
# Replace /path/to/vault with your actual vault path
ln -s "/path/to/vault/Claude-Contexts" ~/.claude/projects

# 3. Verify the link
ls -la ~/.claude/projects
```

**Windows (PowerShell as Administrator):**
```powershell
# 1. Backup existing projects (if any)
Move-Item $env:USERPROFILE\.claude\projects $env:USERPROFILE\.claude\projects.backup

# 2. Create symbolic link
# Replace C:\path\to\vault with your actual vault path
New-Item -ItemType SymbolicLink -Path "$env:USERPROFILE\.claude\projects" -Target "C:\path\to\vault\Claude-Contexts"

# 3. Verify the link
Get-Item $env:USERPROFILE\.claude\projects
```

**Important Notes for Secondary Devices:**
- ⚠️ **DO NOT** configure the plugin with `~/.claude/projects` on secondary devices
- The symlink makes Claude Code read/write directly to your Obsidian vault
- The plugin on Device 1 handles the syncing; Device 2+ just reads/writes through the symlink
- If you want, you can skip installing the plugin entirely on secondary devices

### Verification

After setup, verify bidirectional sync is working:

1. **On Device 1**: Start a new Claude Code conversation
2. **Wait a few seconds** for Obsidian to sync
3. **On Device 2**: Check `~/.claude/projects` - you should see the new `.jsonl` file
4. **On Device 2**: Open Claude Code and run `/resume` - your conversation should be available
5. **On Device 2**: Continue the conversation
6. **On Device 1**: Run `/resume` - you should see the updates from Device 2

🎉 **You now have bidirectional sync across all devices!**

## Development

### Project Structure

```
src/
├── main.ts          # Plugin entry point and lifecycle
├── settings.ts      # Settings UI and validation
├── syncer.ts        # File watching and sync logic
├── utils.ts         # Path parsing and utilities
└── types.ts         # TypeScript interfaces
```

### Building

```bash
# Development build with watch mode
npm run dev

# Production build
npm run build

# Type checking only
tsc -noEmit -skipLibCheck
```

### Testing

Manual testing checklist:

- [ ] Settings validation with valid/invalid paths
- [ ] Test connection shows correct project count
- [ ] New .jsonl file triggers sync within 2-3 seconds
- [ ] Modified file triggers update
- [ ] Rapid changes are debounced
- [ ] Initial sync processes all existing files
- [ ] Metadata is accurate
- [ ] Works on all platforms (Windows/macOS/Linux)
- [ ] Home directory expansion works
- [ ] Paths with spaces handled correctly
- [ ] Empty/malformed JSONL handled gracefully
- [ ] Permission errors show user-friendly messages
- [ ] Status bar updates correctly
- [ ] Plugin reload doesn't lose data

## Troubleshooting

### Plugin doesn't start syncing

1. Check Settings → Claude Context Syncer
2. Verify "Enable Auto-sync" is enabled
3. Click "Test Connection" to validate your Claude Projects Path
4. Check the Developer Console (Ctrl+Shift+I) for error messages

### Files aren't syncing

1. Verify the source files exist in `~/.claude/projects/`
2. Check file permissions on the Claude directory
3. Look for errors in the Developer Console
4. Try clicking "Sync Now" to trigger a manual sync

### "Permission denied" errors

- Ensure you have read access to the Claude projects directory
- On Linux/macOS, check file permissions: `ls -la ~/.claude/projects`
- On Windows, check folder permissions in Properties → Security

### Sync is slow

- The plugin syncs in batches of 10 files
- Large JSONL files (>10MB) may take longer
- Check your disk I/O if syncing is very slow

## Privacy & Security

- All data stays local - no network requests are made
- JSONL files may contain sensitive conversations
- Be aware of what you're syncing if using cloud sync services
- The plugin only reads from Claude directory (no writes)
- All file operations use Obsidian's secure APIs

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

For issues, questions, or feature requests:

- Open an issue on GitHub
- Check existing issues for solutions
- Include error messages from Developer Console

## Acknowledgments

- Built for [Obsidian](https://obsidian.md)
- Syncs [Claude Code](https://claude.com/claude-code) conversations
- Uses [chokidar](https://github.com/paulmillr/chokidar) for file watching

## Changelog

### v1.0.0 (Initial Release)

- Automatic file watching and syncing
- Cross-platform support (Windows, macOS, Linux)
- Metadata generation
- Initial sync of existing conversations
- Manual sync trigger
- Status bar integration
- Settings UI with path validation
