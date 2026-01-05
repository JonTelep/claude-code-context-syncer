/**
 * Main plugin entry point for Claude Code Context Syncer
 */

import { Plugin } from 'obsidian';
import { ClaudeContextSyncSettings, DEFAULT_SETTINGS } from './types';
import { ClaudeContextSyncSettingTab } from './settings';
import { ContextSyncer } from './syncer';
import { formatRelativeTime } from './utils';

export default class ClaudeContextSyncPlugin extends Plugin {
	settings: ClaudeContextSyncSettings;
	syncer: ContextSyncer | null = null;
	statusBarItem: HTMLElement;

	async onload() {
		console.log('Loading Claude Context Syncer plugin');

		// Load settings
		await this.loadSettings();

		// Add settings tab
		this.addSettingTab(new ClaudeContextSyncSettingTab(this.app, this));

		// Create status bar item
		this.statusBarItem = this.addStatusBarItem();
		this.updateStatusBar();

		// Initialize syncer
		await this.initializeSyncer();
	}

	async onunload() {
		console.log('Unloading Claude Context Syncer plugin');

		// Stop file watcher and cleanup
		if (this.syncer) {
			await this.syncer.stopWatching();
		}
	}

	/**
	 * Initialize the context syncer
	 */
	async initializeSyncer(): Promise<void> {
		// Clean up existing syncer if any
		if (this.syncer) {
			await this.syncer.stopWatching();
		}

		// Only initialize if we have a valid Claude path
		if (this.settings.claudeProjectsPath) {
			this.syncer = new ContextSyncer(this);
			await this.syncer.initialize();
		} else {
			console.log('Claude Context Syncer: No Claude projects path configured, skipping initialization');
			this.updateStatusBar('Not configured');
		}
	}

	/**
	 * Update the status bar display
	 * @param customStatus - Optional custom status message
	 */
	updateStatusBar(customStatus?: string): void {
		if (!this.statusBarItem) {
			return;
		}

		if (customStatus) {
			// Custom status (e.g., "Syncing... 45/123")
			this.statusBarItem.setText(`Claude: ${customStatus}`);
			return;
		}

		if (!this.settings.claudeProjectsPath) {
			// Not configured
			this.statusBarItem.setText('Claude: Not configured');
			this.statusBarItem.removeClass('claude-syncer-success');
			this.statusBarItem.removeClass('claude-syncer-error');
			return;
		}

		if (this.settings.lastSyncTime === 0) {
			// Never synced
			this.statusBarItem.setText('Claude: Ready');
			this.statusBarItem.removeClass('claude-syncer-success');
			this.statusBarItem.removeClass('claude-syncer-error');
			return;
		}

		// Show last sync time
		const relativeTime = formatRelativeTime(this.settings.lastSyncTime);
		this.statusBarItem.setText(`Claude: ${relativeTime}`);
		this.statusBarItem.addClass('claude-syncer-success');
		this.statusBarItem.removeClass('claude-syncer-error');
	}

	/**
	 * Load plugin settings from disk
	 */
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	/**
	 * Save plugin settings to disk
	 */
	async saveSettings() {
		await this.saveData(this.settings);
	}
}
