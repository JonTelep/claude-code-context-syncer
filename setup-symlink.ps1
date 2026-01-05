# Claude Code Context Syncer - Symlink Setup Script (Windows)
# This script creates a symbolic link from %USERPROFILE%\.claude\projects to your Obsidian vault
# enabling bidirectional sync across devices.
#
# IMPORTANT: Run this script as Administrator in PowerShell

# Ensure script is running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator" -ForegroundColor Red
    Write-Host ""
    Write-Host "To run as Administrator:" -ForegroundColor Yellow
    Write-Host "  1. Right-click PowerShell" -ForegroundColor Yellow
    Write-Host "  2. Select 'Run as Administrator'" -ForegroundColor Yellow
    Write-Host "  3. Navigate to this directory and run the script again" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Claude Code Context Syncer Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get the Obsidian vault path from user
Write-Host "This script will create a symbolic link from:"
Write-Host "  $env:USERPROFILE\.claude\projects"
Write-Host "to your Obsidian vault's Claude-Contexts folder."
Write-Host ""
Write-Host "Note: This is typically inside your Obsidian vault." -ForegroundColor Yellow
Write-Host "Example: C:\Users\YourName\Documents\MyVault\Claude-Contexts"
Write-Host ""

$vaultPath = Read-Host "Enter the FULL path to your Obsidian vault's Claude-Contexts folder"

# Trim whitespace
$vaultPath = $vaultPath.Trim()

# Validate the path exists
if (-not (Test-Path -Path $vaultPath -PathType Container)) {
    Write-Host "ERROR: Directory does not exist: $vaultPath" -ForegroundColor Red
    Write-Host "Please ensure you've entered the correct path and try again."
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Target Obsidian path: $vaultPath"
Write-Host ""

# Check if .claude\projects already exists
$claudeProjects = Join-Path $env:USERPROFILE ".claude\projects"

if (Test-Path -Path $claudeProjects) {
    Write-Host "WARNING: .claude\projects already exists." -ForegroundColor Yellow

    # Check if it's already a symlink
    $item = Get-Item -Path $claudeProjects -Force
    if ($item.LinkType -eq "SymbolicLink") {
        $currentTarget = $item.Target
        Write-Host "It's currently a symbolic link pointing to: $currentTarget"

        if ($currentTarget -eq $vaultPath) {
            Write-Host "✓ Symbolic link is already set up correctly!" -ForegroundColor Green
            Read-Host "Press Enter to exit"
            exit 0
        }
        else {
            Write-Host ""
            $replace = Read-Host "Do you want to replace it with the new path? (y/N)"
            if ($replace -ne 'y' -and $replace -ne 'Y') {
                Write-Host "Aborted."
                Read-Host "Press Enter to exit"
                exit 0
            }
            Remove-Item -Path $claudeProjects -Force
        }
    }
    else {
        # It's a regular directory
        Write-Host "It's a regular directory (not a symlink)."
        Write-Host ""
        Write-Host "Options:"
        Write-Host "  1. Backup and replace (recommended)"
        Write-Host "  2. Merge contents into Obsidian vault then replace"
        Write-Host "  3. Abort"
        Write-Host ""
        $option = Read-Host "Choose an option (1/2/3)"

        switch ($option) {
            "1" {
                $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
                $backupPath = Join-Path $env:USERPROFILE ".claude\projects.backup.$timestamp"
                Write-Host "Creating backup at: $backupPath"
                Move-Item -Path $claudeProjects -Destination $backupPath
                Write-Host "✓ Backup created successfully" -ForegroundColor Green
            }
            "2" {
                Write-Host ""
                Write-Host "Please manually copy the contents of .claude\projects"
                Write-Host "to your Obsidian vault at: $vaultPath"
                Write-Host ""
                Write-Host "Then run this script again."
                Read-Host "Press Enter to exit"
                exit 0
            }
            "3" {
                Write-Host "Aborted."
                Read-Host "Press Enter to exit"
                exit 0
            }
            default {
                Write-Host "Invalid option. Aborted." -ForegroundColor Red
                Read-Host "Press Enter to exit"
                exit 1
            }
        }
    }
}

# Ensure .claude directory exists
$claudeDir = Join-Path $env:USERPROFILE ".claude"
if (-not (Test-Path -Path $claudeDir)) {
    New-Item -ItemType Directory -Path $claudeDir -Force | Out-Null
}

# Create the symbolic link
Write-Host ""
Write-Host "Creating symbolic link..."

try {
    New-Item -ItemType SymbolicLink -Path $claudeProjects -Target $vaultPath -Force | Out-Null

    # Verify the link was created
    if (Test-Path -Path $claudeProjects) {
        $link = Get-Item -Path $claudeProjects -Force
        if ($link.LinkType -eq "SymbolicLink") {
            Write-Host "✓ Successfully created symbolic link!" -ForegroundColor Green
            Write-Host ""
            Write-Host "  $claudeProjects → $($link.Target)"
            Write-Host ""
            Write-Host "Setup complete!" -ForegroundColor Green
            Write-Host ""
            Write-Host "What this means:"
            Write-Host "  • Claude Code will now read/write directly to your Obsidian vault"
            Write-Host "  • All conversations sync automatically via Obsidian Sync"
            Write-Host "  • You can use /resume on any device to continue conversations"
            Write-Host ""
            Write-Host "Next steps:"
            Write-Host "  1. Ensure the Obsidian plugin is installed on this device"
            Write-Host "  2. Make sure Obsidian Sync (or your sync method) is enabled"
            Write-Host "  3. Try creating a conversation in Claude Code"
            Write-Host "  4. Check your Obsidian vault - you should see the .jsonl files"
            Write-Host ""
        }
        else {
            throw "Created item is not a symbolic link"
        }
    }
    else {
        throw "Symbolic link was not created"
    }
}
catch {
    Write-Host "ERROR: Failed to create symbolic link" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Read-Host "Press Enter to exit"
