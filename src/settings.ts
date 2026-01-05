/**
 * Settings tab and validation for Claude Code Context Syncer
 */

import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import { promises as fs } from 'fs';
import * as path from 'path';
import ClaudeContextSyncPlugin from './main';
import { ValidationResult } from './types';
import { expandHomePath, formatRelativeTime, getErrorMessage } from './utils';

export class ClaudeContextSyncSettingTab extends PluginSettingTab {
	plugin: ClaudeContextSyncPlugin;
	private validationStatusEl: HTMLElement | null = null;

	constructor(app: App, plugin: ClaudeContextSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Claude Context Syncer Settings' });

		containerEl.createEl('p', {
			text: 'Automatically sync Claude Code conversation contexts to your Obsidian vault for cross-device synchronization.'
		});

		// Claude Projects Path setting
		new Setting(containerEl)
			.setName('Claude Projects Path')
			.setDesc('Full path to your .claude/projects directory (e.g., /home/user/.claude/projects or ~/.claude/projects)')
			.addText(text => text
				.setPlaceholder('~/.claude/projects')
				.setValue(this.plugin.settings.claudeProjectsPath)
				.onChange(async (value) => {
					this.plugin.settings.claudeProjectsPath = value;
					await this.plugin.saveSettings();
				}));

		// Obsidian Storage Path setting
		new Setting(containerEl)
			.setName('Obsidian Storage Path')
			.setDesc('Folder within your vault where contexts will be stored (relative path)')
			.addText(text => text
				.setPlaceholder('Claude-Contexts')
				.setValue(this.plugin.settings.obsidianStoragePath)
				.onChange(async (value) => {
					this.plugin.settings.obsidianStoragePath = value;
					await this.plugin.saveSettings();
				}));

		// Test Connection button and status display
		const testConnectionSetting = new Setting(containerEl)
			.setName('Test Connection')
			.setDesc('Verify that the Claude projects path is valid and accessible')
			.addButton(button => button
				.setButtonText('Test Connection')
				.setCta()
				.onClick(async () => {
					await this.testConnection();
				}));

		// Add validation status display area
		this.validationStatusEl = containerEl.createDiv('validation-status');

		// Enable Auto-sync toggle
		new Setting(containerEl)
			.setName('Enable Auto-sync')
			.setDesc('Automatically sync when Claude Code creates or modifies conversation files')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableAutoSync)
				.onChange(async (value) => {
					this.plugin.settings.enableAutoSync = value;
					await this.plugin.saveSettings();

					// Restart syncer if needed
					if (value) {
						await this.plugin.initializeSyncer();
					} else {
						await this.plugin.syncer?.stopWatching();
					}
				}));

		// Sync on Startup toggle
		new Setting(containerEl)
			.setName('Sync on Startup')
			.setDesc('Automatically sync all existing conversations when Obsidian starts')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.syncOnStartup)
				.onChange(async (value) => {
					this.plugin.settings.syncOnStartup = value;
					await this.plugin.saveSettings();
				}));

		// Manual Sync Now button
		new Setting(containerEl)
			.setName('Manual Sync')
			.setDesc('Trigger a one-time sync of all Claude Code conversations')
			.addButton(button => button
				.setButtonText('Sync Now')
				.onClick(async () => {
					await this.triggerManualSync();
				}));

		// Last sync time display
		if (this.plugin.settings.lastSyncTime > 0) {
			const lastSyncText = formatRelativeTime(this.plugin.settings.lastSyncTime);
			containerEl.createEl('p', {
				text: `Last sync: ${lastSyncText}`,
				cls: 'setting-item-description'
			});
		}
	}

	/**
	 * Test the connection to Claude projects directory
	 */
	private async testConnection(): Promise<void> {
		if (!this.validationStatusEl) return;

		this.validationStatusEl.empty();
		this.validationStatusEl.createEl('p', { text: 'Testing connection...' });

		const result = await this.validateClaudePath(this.plugin.settings.claudeProjectsPath);

		this.validationStatusEl.empty();

		if (result.valid) {
			const successDiv = this.validationStatusEl.createDiv('validation-success');
			successDiv.createEl('span', { text: '✓ ', cls: 'validation-icon-success' });
			successDiv.createEl('span', {
				text: `Connected! Found ${result.sessionCount || 0} conversation(s) across ${result.projectCount || 0} project(s).`
			});

			new Notice('Connection successful!');
		} else {
			const errorDiv = this.validationStatusEl.createDiv('validation-error');
			errorDiv.createEl('span', { text: '✗ ', cls: 'validation-icon-error' });
			errorDiv.createEl('span', { text: result.message });

			new Notice(`Connection failed: ${result.message}`);
		}
	}

	/**
	 * Validate the Claude projects path
	 * @param inputPath - Path to validate
	 * @returns Validation result with project/session counts
	 */
	private async validateClaudePath(inputPath: string): Promise<ValidationResult> {
		if (!inputPath || inputPath.trim() === '') {
			return {
				valid: false,
				message: 'Path cannot be empty'
			};
		}

		try {
			// Expand home directory if needed
			const expandedPath = expandHomePath(inputPath.trim());

			// Check if path exists
			let stats;
			try {
				stats = await fs.stat(expandedPath);
			} catch (error: any) {
				if (error.code === 'ENOENT') {
					return {
						valid: false,
						message: 'Path does not exist'
					};
				}
				return {
					valid: false,
					message: getErrorMessage(error)
				};
			}

			// Check if it's a directory
			if (!stats.isDirectory()) {
				return {
					valid: false,
					message: 'Path is not a directory'
				};
			}

			// Check if readable
			try {
				await fs.access(expandedPath, fs.constants.R_OK);
			} catch {
				return {
					valid: false,
					message: 'Directory is not readable (permission denied)'
				};
			}

			// Count projects and sessions
			const { projectCount, sessionCount } = await this.countProjectsAndSessions(expandedPath);

			return {
				valid: true,
				message: 'Connection successful',
				projectCount,
				sessionCount
			};
		} catch (error: any) {
			return {
				valid: false,
				message: getErrorMessage(error)
			};
		}
	}

	/**
	 * Count the number of projects and sessions in the Claude directory
	 * @param projectsPath - Path to .claude/projects
	 * @returns Object with project and session counts
	 */
	private async countProjectsAndSessions(projectsPath: string): Promise<{ projectCount: number; sessionCount: number }> {
		let projectCount = 0;
		let sessionCount = 0;

		try {
			const entries = await fs.readdir(projectsPath, { withFileTypes: true });

			for (const entry of entries) {
				if (entry.isDirectory()) {
					projectCount++;

					// Count .jsonl files in this project directory
					const projectDir = path.join(projectsPath, entry.name);
					try {
						const files = await fs.readdir(projectDir);
						const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
						sessionCount += jsonlFiles.length;
					} catch {
						// Skip if we can't read the directory
					}
				}
			}
		} catch {
			// Return zeros if we can't read the directory
		}

		return { projectCount, sessionCount };
	}

	/**
	 * Trigger a manual sync of all conversations
	 */
	private async triggerManualSync(): Promise<void> {
		if (!this.plugin.syncer) {
			new Notice('Syncer not initialized. Please check your settings.');
			return;
		}

		new Notice('Starting manual sync...');

		try {
			const results = await this.plugin.syncer.syncAllExisting();

			const successCount = results.filter(r => r.success).length;
			const errorCount = results.filter(r => !r.success).length;

			if (errorCount === 0) {
				new Notice(`Sync complete! Synced ${successCount} conversation(s).`);
			} else {
				new Notice(`Sync complete with errors: ${successCount} succeeded, ${errorCount} failed.`);
			}

			// Update status bar
			this.plugin.updateStatusBar();
		} catch (error: any) {
			new Notice(`Sync failed: ${getErrorMessage(error)}`);
			console.error('Manual sync error:', error);
		}
	}
}
