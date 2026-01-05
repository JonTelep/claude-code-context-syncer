/**
 * TypeScript interfaces for Claude Code Context Syncer
 */

/**
 * Claude Code JSONL line structure
 * Represents a single message/event in a Claude Code conversation
 */
export interface ClaudeMessage {
	type: 'user' | 'assistant' | 'system' | 'tool_use' | 'tool_result' | 'file-history-snapshot';
	message?: any;
	uuid: string;
	timestamp: number;
	cwd?: string;
	sessionId: string;
	version?: string;
	gitBranch?: string;
	// Additional fields that may exist
	[key: string]: any;
}

/**
 * Plugin settings stored in Obsidian's data.json
 */
export interface ClaudeContextSyncSettings {
	claudeProjectsPath: string;      // Full path to .claude/projects directory
	obsidianStoragePath: string;     // Relative path within vault (e.g., "Claude-Contexts")
	lastSyncTime: number;            // Timestamp of last successful sync
	enableAutoSync: boolean;         // Enable/disable automatic file watching
	syncOnStartup: boolean;          // Auto-sync existing conversations on plugin load
}

/**
 * Default settings values
 */
export const DEFAULT_SETTINGS: ClaudeContextSyncSettings = {
	claudeProjectsPath: '',
	obsidianStoragePath: 'Claude-Contexts',
	lastSyncTime: 0,
	enableAutoSync: true,
	syncOnStartup: true,
};

/**
 * Metadata file structure for each synced session
 * Stored as {sessionId}.meta.json alongside the JSONL file
 */
export interface SessionMetadata {
	sessionId: string;
	projectName: string;            // Human-readable decoded project name
	projectPath: string;            // Original URL-encoded project path
	messageCount: number;
	firstTimestamp: number;
	lastTimestamp: number;
	gitBranch?: string;
	version?: string;
	syncedAt: number;               // When this file was synced to Obsidian
	sourceFilePath: string;         // Original .jsonl path in Claude projects
}

/**
 * Result of a single file sync operation
 */
export interface SyncResult {
	success: boolean;
	sessionId: string;
	projectName: string;
	action: 'created' | 'updated' | 'skipped' | 'error';
	message?: string;
	error?: Error;
}

/**
 * Parsed components of a Claude Code file path
 * Example: /home/user/.claude/projects/home%2Fuser%2Fproject/session-uuid.jsonl
 */
export interface ParsedClaudePath {
	projectsDir: string;            // Base projects directory
	encodedProjectName: string;     // URL-encoded project name (e.g., "home%2Fuser%2Fproject")
	decodedProjectName: string;     // Human-readable project name (e.g., "home - user - project")
	sessionId: string;              // Session UUID
	fullPath: string;               // Complete file path
}

/**
 * Target paths in Obsidian vault for synced files
 */
export interface TargetPaths {
	projectDir: string;             // Directory: {vault}/{storage}/{project}/
	jsonlFile: string;              // Full path: {projectDir}/{sessionId}.jsonl
	metaFile: string;               // Full path: {projectDir}/{sessionId}.meta.json
}

/**
 * Debounce tracking for pending sync operations
 */
export interface PendingSync {
	filePath: string;
	scheduledTime: number;
	timeoutId: NodeJS.Timeout;
}

/**
 * Path validation result
 */
export interface ValidationResult {
	valid: boolean;
	message: string;
	projectCount?: number;
	sessionCount?: number;
}
