/**
 * File syncer for Claude Code Context Syncer
 * Handles file watching, debouncing, and synchronization logic
 */

import * as chokidar from 'chokidar';
import { FSWatcher } from 'chokidar';
import * as path from 'path';
import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { Notice } from 'obsidian';
import ClaudeContextSyncPlugin from './main';
import { ClaudeMessage, SessionMetadata, SyncResult, PendingSync } from './types';
import { parseClaudePath, getTargetPaths, ensureDirectory, expandHomePath, getErrorMessage } from './utils';

export class ContextSyncer {
	private plugin: ClaudeContextSyncPlugin;
	private watcher: FSWatcher | null = null;
	private pendingSyncs: Map<string, PendingSync> = new Map();
	private syncInProgress: Set<string> = new Set();

	constructor(plugin: ClaudeContextSyncPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Initialize the syncer
	 */
	async initialize(): Promise<void> {
		console.log('Claude Context Syncer: Initializing...');

		// Start file watching if auto-sync is enabled
		if (this.plugin.settings.enableAutoSync) {
			await this.startWatching();
		}

		// Run initial sync if enabled
		if (this.plugin.settings.syncOnStartup) {
			console.log('Claude Context Syncer: Running initial sync...');
			// Run initial sync in background to not block plugin loading
			setTimeout(() => this.syncAllExisting(), 1000);
		}
	}

	/**
	 * Start watching the Claude projects directory for file changes
	 */
	async startWatching(): Promise<void> {
		if (this.watcher) {
			console.log('Claude Context Syncer: Watcher already running');
			return;
		}

		const claudePath = expandHomePath(this.plugin.settings.claudeProjectsPath);

		if (!claudePath) {
			console.warn('Claude Context Syncer: No Claude projects path configured');
			return;
		}

		try {
			// Verify path exists before watching
			await fs.access(claudePath);

			const watchPattern = path.join(claudePath, '**/*.jsonl');
			console.log(`Claude Context Syncer: Starting file watcher on ${watchPattern}`);

			this.watcher = chokidar.watch(watchPattern, {
				persistent: true,
				ignoreInitial: true,  // Don't fire events for existing files
				awaitWriteFinish: {
					stabilityThreshold: 500,  // Wait 500ms of no changes
					pollInterval: 100         // Check every 100ms
				},
				depth: 2,  // projects/{encoded}/{sessionId}.jsonl
				followSymlinks: true,
				alwaysStat: true
			});

			this.watcher
				.on('add', (filePath) => {
					console.log(`Claude Context Syncer: File added - ${filePath}`);
					this.scheduleSyncWithDebounce(filePath);
				})
				.on('change', (filePath) => {
					console.log(`Claude Context Syncer: File changed - ${filePath}`);
					this.scheduleSyncWithDebounce(filePath);
				})
				.on('error', (error) => {
					console.error('Claude Context Syncer: Watcher error', error);
					this.handleWatchError(error);
				})
				.on('ready', () => {
					console.log('Claude Context Syncer: File watcher ready');
				});

		} catch (error) {
			console.error('Claude Context Syncer: Failed to start watcher', error);
			new Notice(`Failed to start watching Claude directory: ${getErrorMessage(error)}`);
		}
	}

	/**
	 * Stop watching for file changes
	 */
	async stopWatching(): Promise<void> {
		if (this.watcher) {
			console.log('Claude Context Syncer: Stopping file watcher');
			await this.watcher.close();
			this.watcher = null;
		}

		// Cancel all pending syncs
		for (const [_, pending] of this.pendingSyncs) {
			clearTimeout(pending.timeoutId);
		}
		this.pendingSyncs.clear();
	}

	/**
	 * Schedule a sync with debouncing
	 * @param filePath - Path to the file that changed
	 */
	private scheduleSyncWithDebounce(filePath: string): void {
		// Cancel existing debounce for this file
		if (this.pendingSyncs.has(filePath)) {
			const existing = this.pendingSyncs.get(filePath)!;
			clearTimeout(existing.timeoutId);
		}

		// Schedule new sync after 1 second
		const timeoutId = setTimeout(() => {
			this.pendingSyncs.delete(filePath);
			this.executeSync(filePath);
		}, 1000);

		this.pendingSyncs.set(filePath, {
			filePath,
			scheduledTime: Date.now() + 1000,
			timeoutId
		});
	}

	/**
	 * Execute the sync for a single file
	 * @param filePath - Path to sync
	 */
	private async executeSync(filePath: string): Promise<void> {
		try {
			const result = await this.syncSingleFile(filePath);

			if (result.success) {
				console.log(`Claude Context Syncer: ${result.action} - ${result.projectName}/${result.sessionId}`);
			} else {
				console.error(`Claude Context Syncer: Sync failed - ${result.message}`, result.error);
			}

			// Update status bar
			this.plugin.updateStatusBar();
		} catch (error) {
			console.error(`Claude Context Syncer: Unexpected error syncing ${filePath}`, error);
		}
	}

	/**
	 * Sync all existing conversations in the Claude directory
	 * @returns Array of sync results
	 */
	async syncAllExisting(): Promise<SyncResult[]> {
		const results: SyncResult[] = [];
		const claudePath = expandHomePath(this.plugin.settings.claudeProjectsPath);

		if (!claudePath) {
			new Notice('Claude projects path not configured');
			return results;
		}

		try {
			// Find all .jsonl files
			const files = await this.findAllJsonlFiles(claudePath);

			if (files.length === 0) {
				new Notice('No Claude conversations found to sync');
				return results;
			}

			console.log(`Claude Context Syncer: Found ${files.length} conversation(s) to sync`);
			this.plugin.updateStatusBar(`Syncing... 0/${files.length}`);

			// Sync in batches of 10
			const batchSize = 10;
			for (let i = 0; i < files.length; i += batchSize) {
				const batch = files.slice(i, i + batchSize);
				const batchResults = await Promise.all(
					batch.map(f => this.syncSingleFile(f))
				);
				results.push(...batchResults);

				// Update progress
				const progress = Math.min(i + batch.length, files.length);
				this.plugin.updateStatusBar(`Syncing... ${progress}/${files.length}`);
			}

			// Update final status
			this.plugin.updateStatusBar();

			const successCount = results.filter(r => r.success).length;
			console.log(`Claude Context Syncer: Sync complete - ${successCount}/${files.length} succeeded`);

		} catch (error) {
			console.error('Claude Context Syncer: Error during full sync', error);
			new Notice(`Sync error: ${getErrorMessage(error)}`);
		}

		return results;
	}

	/**
	 * Sync a single JSONL file to the vault
	 * @param filePath - Path to the .jsonl file
	 * @returns Sync result
	 */
	async syncSingleFile(filePath: string): Promise<SyncResult> {
		// Check if sync already in progress for this file
		if (this.syncInProgress.has(filePath)) {
			return {
				success: false,
				sessionId: '',
				projectName: '',
				action: 'skipped',
				message: 'Sync already in progress'
			};
		}

		this.syncInProgress.add(filePath);

		try {
			// Parse the Claude path
			const parsedPath = parseClaudePath(filePath);

			// Get target paths in Obsidian vault
			const targetPaths = getTargetPaths(
				this.plugin.app.vault,
				this.plugin.settings.obsidianStoragePath,
				parsedPath
			);

			// Check if sync is needed
			const shouldSync = await this.shouldSync(filePath, targetPaths.metaFile);

			if (!shouldSync) {
				return {
					success: true,
					sessionId: parsedPath.sessionId,
					projectName: parsedPath.decodedProjectName,
					action: 'skipped',
					message: 'Already up to date'
				};
			}

			// Parse JSONL file
			const messages = await this.parseJsonlFile(filePath);

			if (messages.length === 0) {
				return {
					success: false,
					sessionId: parsedPath.sessionId,
					projectName: parsedPath.decodedProjectName,
					action: 'skipped',
					message: 'Empty JSONL file'
				};
			}

			// Generate metadata
			const metadata = await this.generateMetadata(messages, filePath, parsedPath);

			// Ensure target directory exists
			await ensureDirectory(targetPaths.projectDir);

			// Read the original file content to preserve it exactly
			const originalContent = await fs.readFile(filePath, 'utf-8');

			// Write JSONL file (original content)
			await fs.writeFile(targetPaths.jsonlFile, originalContent, 'utf-8');

			// Write metadata file
			await fs.writeFile(
				targetPaths.metaFile,
				JSON.stringify(metadata, null, 2),
				'utf-8'
			);

			// Update last sync time in settings
			this.plugin.settings.lastSyncTime = Date.now();
			await this.plugin.saveSettings();

			return {
				success: true,
				sessionId: parsedPath.sessionId,
				projectName: parsedPath.decodedProjectName,
				action: targetPaths.jsonlFile ? 'updated' : 'created'
			};

		} catch (error: any) {
			return {
				success: false,
				sessionId: '',
				projectName: '',
				action: 'error',
				message: getErrorMessage(error),
				error
			};
		} finally {
			this.syncInProgress.delete(filePath);
		}
	}

	/**
	 * Check if a file should be synced based on timestamps
	 * @param sourcePath - Path to source .jsonl file
	 * @param metaFilePath - Path to metadata file in vault
	 * @returns true if sync is needed
	 */
	private async shouldSync(sourcePath: string, metaFilePath: string): Promise<boolean> {
		try {
			// Check if metadata file exists
			await fs.access(metaFilePath);

			// Read metadata
			const metaContent = await fs.readFile(metaFilePath, 'utf-8');
			const metadata: SessionMetadata = JSON.parse(metaContent);

			// Get source file stats
			const sourceStats = await fs.stat(sourcePath);

			// Compare modification times
			// Sync if source is newer than when it was last synced
			return sourceStats.mtimeMs > metadata.syncedAt;

		} catch (error: any) {
			if (error.code === 'ENOENT') {
				// Metadata doesn't exist, need to sync
				return true;
			}
			// On any other error, try to sync anyway
			return true;
		}
	}

	/**
	 * Parse a JSONL file line by line
	 * @param filePath - Path to .jsonl file
	 * @returns Array of parsed messages
	 */
	private async parseJsonlFile(filePath: string): Promise<ClaudeMessage[]> {
		const messages: ClaudeMessage[] = [];

		try {
			const fileStream = createReadStream(filePath);
			const rl = createInterface({
				input: fileStream,
				crlfDelay: Infinity
			});

			let lineNumber = 0;
			for await (const line of rl) {
				lineNumber++;

				if (line.trim() === '') {
					continue;  // Skip empty lines
				}

				try {
					const message = JSON.parse(line) as ClaudeMessage;
					messages.push(message);
				} catch (error) {
					console.warn(`Claude Context Syncer: Failed to parse line ${lineNumber} in ${filePath}:`, error);
					// Continue parsing other lines
				}
			}
		} catch (error) {
			console.error(`Claude Context Syncer: Error reading file ${filePath}`, error);
			throw error;
		}

		return messages;
	}

	/**
	 * Generate metadata for a synced session
	 * @param messages - Parsed messages from JSONL
	 * @param sourcePath - Original file path
	 * @param parsedPath - Parsed Claude path components
	 * @returns Session metadata
	 */
	private async generateMetadata(
		messages: ClaudeMessage[],
		sourcePath: string,
		parsedPath: ReturnType<typeof parseClaudePath>
	): Promise<SessionMetadata> {
		// Extract timestamps
		const timestamps = messages
			.map(m => m.timestamp)
			.filter(t => t !== undefined && t !== null);

		// Find git branch and version from messages
		const gitBranch = messages.find(m => m.gitBranch)?.gitBranch;
		const version = messages.find(m => m.version)?.version;

		return {
			sessionId: parsedPath.sessionId,
			projectName: parsedPath.decodedProjectName,
			projectPath: parsedPath.encodedProjectName,
			messageCount: messages.length,
			firstTimestamp: timestamps.length > 0 ? Math.min(...timestamps) : Date.now(),
			lastTimestamp: timestamps.length > 0 ? Math.max(...timestamps) : Date.now(),
			gitBranch,
			version,
			syncedAt: Date.now(),
			sourceFilePath: sourcePath
		};
	}

	/**
	 * Find all .jsonl files in the Claude projects directory
	 * @param claudePath - Path to .claude/projects
	 * @returns Array of file paths
	 */
	private async findAllJsonlFiles(claudePath: string): Promise<string[]> {
		const files: string[] = [];

		try {
			const entries = await fs.readdir(claudePath, { withFileTypes: true });

			for (const entry of entries) {
				if (entry.isDirectory()) {
					const projectDir = path.join(claudePath, entry.name);

					try {
						const projectFiles = await fs.readdir(projectDir);
						const jsonlFiles = projectFiles
							.filter(f => f.endsWith('.jsonl'))
							.map(f => path.join(projectDir, f));

						files.push(...jsonlFiles);
					} catch (error) {
						console.warn(`Claude Context Syncer: Could not read directory ${projectDir}`, error);
					}
				}
			}
		} catch (error) {
			console.error(`Claude Context Syncer: Could not read Claude projects directory`, error);
			throw error;
		}

		return files;
	}

	/**
	 * Handle file watcher errors
	 * @param error - Error from chokidar
	 */
	private handleWatchError(error: any): void {
		console.error('Claude Context Syncer: File watcher error', error);

		// Attempt to restart watcher after 5 seconds
		setTimeout(async () => {
			console.log('Claude Context Syncer: Attempting to restart watcher...');
			await this.stopWatching();
			await this.startWatching();
		}, 5000);
	}
}
