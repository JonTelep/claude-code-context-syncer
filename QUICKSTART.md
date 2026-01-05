# Quick Start Guide: Bidirectional Claude Code Sync

Get your Claude Code conversations syncing across all devices in 5 minutes.

## What You'll Achieve

After following this guide:
- ✅ All Claude Code conversations automatically sync to Obsidian
- ✅ Use `/resume` on any device to continue any conversation
- ✅ Conversations created on Device A appear instantly on Device B
- ✅ True bidirectional sync with zero manual effort

## Prerequisites

- Obsidian installed on all devices
- Obsidian Sync (or iCloud/Dropbox/Syncthing)
- Claude Code installed on all devices

## Device 1: Primary Setup (5 minutes)

### Step 1: Install the Plugin

1. Copy these files to your Obsidian vault:
   ```
   .obsidian/plugins/claude-context-syncer/
   ├── main.js
   ├── manifest.json
   └── styles.css
   ```

2. Reload Obsidian (Ctrl+R or Cmd+R)

3. Go to Settings → Community Plugins

4. Enable "Claude Context Syncer"

### Step 2: Configure the Plugin

1. Go to Settings → Claude Context Syncer

2. Fill in two settings:
   - **Claude Projects Path**: `~/.claude/projects`
   - **Obsidian Storage Path**: `Claude-Contexts`

3. Click "Test Connection"
   - Should show: "Found X conversations across Y projects"

4. Click "Sync Now"
   - Syncs all existing conversations to your vault

### Step 3: Enable Vault Sync

Make sure Obsidian Sync (or your chosen sync service) is enabled and the `Claude-Contexts` folder is syncing.

**Done!** Device 1 is now syncing conversations to your Obsidian vault.

---

## Device 2+: Secondary Setup (2 minutes)

### Step 1: Wait for Sync

Let Obsidian Sync download your vault to the new device, including the `Claude-Contexts` folder.

### Step 2: Create Symbolic Link

**Option A: Automated (Recommended)**

Download the setup script from the plugin repository, then run:

**Linux/macOS:**
```bash
./setup-symlink.sh
```

**Windows (PowerShell as Admin):**
```powershell
.\setup-symlink.ps1
```

Follow the prompts and enter your vault's Claude-Contexts path.

**Option B: Manual**

**Linux/macOS:**
```bash
# Backup existing (if any)
mv ~/.claude/projects ~/.claude/projects.backup

# Create symlink (adjust path to your vault)
ln -s "/path/to/vault/Claude-Contexts" ~/.claude/projects
```

**Windows (PowerShell as Admin):**
```powershell
# Backup existing (if any)
Move-Item $env:USERPROFILE\.claude\projects $env:USERPROFILE\.claude\projects.backup

# Create symlink (adjust path to your vault)
New-Item -ItemType SymbolicLink -Path "$env:USERPROFILE\.claude\projects" -Target "C:\path\to\vault\Claude-Contexts"
```

**Done!** Device 2 is now using the synced conversations.

---

## Testing Bidirectional Sync

1. **On Device 1**: Start a new Claude Code conversation
   ```
   Ask Claude a question, like "What is 2+2?"
   ```

2. **Wait 5-10 seconds** for Obsidian to sync

3. **On Device 2**: Open Claude Code and run:
   ```
   /resume
   ```

4. **On Device 2**: You should see the conversation from Device 1!
   - Continue the conversation on Device 2

5. **On Device 1**: Run `/resume` again
   - You should see the updates from Device 2!

🎉 **Bidirectional sync is working!**

---

## Troubleshooting

### "Syncer not initialized" error
- Toggle "Enable Auto-sync" OFF then ON in settings
- Or restart Obsidian

### Can't see files in Obsidian
- Files ARE there! Obsidian hides non-markdown files by default
- Verify with: `ls ~/.claude/projects` (or check file manager)
- Use Quick Switcher (Ctrl+O) and type `.jsonl`

### Conversations not appearing on Device 2
1. Check Obsidian Sync status - is the vault fully synced?
2. Verify the symlink: `ls -la ~/.claude/projects` (should show symlink arrow)
3. Check the actual vault folder - are `.jsonl` files there?

### Permission errors on Windows
- Run PowerShell as Administrator when creating symlinks
- Developer Mode may need to be enabled in Windows Settings

---

## Understanding the Setup

### Device 1 (Primary)
```
Claude Code writes → ~/.claude/projects/
                          ↓ (plugin copies)
                   Obsidian vault/Claude-Contexts
                          ↓ (Obsidian Sync)
                       Cloud storage
```

### Device 2+ (Secondary)
```
Cloud storage
     ↓ (Obsidian Sync)
Obsidian vault/Claude-Contexts
     ↑ (symlink points here)
~/.claude/projects/ ← Claude Code reads/writes
```

Both devices ultimately read/write the same location (your Obsidian vault), just through different mechanisms. This creates true bidirectional sync!

---

## What's Actually Happening?

1. **Device 1**: Plugin watches `~/.claude/projects` and copies changes to vault
2. **Obsidian Sync**: Syncs vault files across all devices
3. **Device 2+**: Symlink makes `~/.claude/projects` point to vault
4. **Result**: All devices share the same conversation files

The beauty of this approach:
- No complex sync logic
- No conflicts (Obsidian handles file sync)
- Works with any Obsidian sync method
- Completely transparent to Claude Code

---

## Next Steps

- Set up on all your devices
- Try `/resume` to continue conversations anywhere
- Share specific conversations by sharing the `.jsonl` files
- Use metadata files to track conversation history

**Questions?** Check the full README.md for detailed documentation.
