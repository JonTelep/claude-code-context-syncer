/**
 * Utility functions for Claude Code Context Syncer
 * Handles path parsing, URL encoding/decoding, and cross-platform operations
 */

import * as path from 'path';
import * as os from 'os';
import { promises as fs } from 'fs';
import { Vault } from 'obsidian';
import { ParsedClaudePath, TargetPaths } from './types';

/**
 * Parse a Claude Code JSONL file path to extract its components
 * Example: /home/user/.claude/projects/home%2Fuser%2Fproject/abc-123.jsonl
 * @param filePath - Full path to a .jsonl file in Claude projects directory
 * @returns Parsed path components
 */
export function parseClaudePath(filePath: string): ParsedClaudePath {
	const normalized = path.normalize(filePath);
	const parts = normalized.split(path.sep);

	// Get the filename (e.g., "abc-123.jsonl")
	const fileName = parts[parts.length - 1];

	// Get the encoded project directory name (second to last part)
	const encodedProjectName = parts[parts.length - 2];

	// Get the projects directory (everything before the last two parts)
	const projectsDir = parts.slice(0, -2).join(path.sep);

	// Extract session ID (filename without .jsonl extension)
	const sessionId = fileName.replace('.jsonl', '');

	return {
		projectsDir,
		encodedProjectName,
		decodedProjectName: decodeProjectName(encodedProjectName),
		sessionId,
		fullPath: normalized
	};
}

/**
 * Decode a URL-encoded project name into a human-readable format
 * Example: "home%2Fuser%2Fproject" -> "home - user - project"
 * @param encoded - URL-encoded project directory name
 * @returns Human-readable project name
 */
export function decodeProjectName(encoded: string): string {
	try {
		// Claude Code uses URL encoding for paths
		// Example: /home/user/project -> home%2Fuser%2Fproject
		const decoded = decodeURIComponent(encoded);

		// Clean up for display:
		// Remove leading slashes and convert path separators to dashes
		const cleaned = decoded
			.replace(/^[/\\]+/, '')           // Remove leading slashes
			.replace(/[/\\]+/g, ' - ');       // Convert path separators to " - "

		return cleaned || 'Unknown Project';
	} catch (error) {
		console.warn(`Failed to decode project name: ${encoded}`, error);
		return encoded;  // Fallback to encoded version
	}
}

/**
 * Get target paths in Obsidian vault for a synced session
 * @param vault - Obsidian vault instance
 * @param storagePath - Relative storage path within vault (from settings)
 * @param parsedPath - Parsed Claude path components
 * @returns Target paths for JSONL and metadata files
 */
export function getTargetPaths(
	vault: Vault,
	storagePath: string,
	parsedPath: ParsedClaudePath
): TargetPaths {
	const vaultBasePath = (vault.adapter as any).basePath;

	// Sanitize the project name for use in file system
	const sanitizedProjectName = sanitizeFileName(parsedPath.decodedProjectName);

	// Build the project directory path
	const projectDir = path.join(vaultBasePath, storagePath, sanitizedProjectName);

	return {
		projectDir,
		jsonlFile: path.join(projectDir, `${parsedPath.sessionId}.jsonl`),
		metaFile: path.join(projectDir, `${parsedPath.sessionId}.meta.json`)
	};
}

/**
 * Sanitize a filename to remove invalid characters
 * Removes characters that are invalid on Windows, macOS, or Linux
 * @param name - Input filename
 * @returns Sanitized filename
 */
export function sanitizeFileName(name: string): string {
	return name
		.replace(/[<>:"|?*]/g, '-')      // Replace invalid chars with dash
		.replace(/\s+/g, ' ')            // Normalize whitespace
		.trim()
		.substring(0, 255);              // Limit length for file systems
}

/**
 * Expand home directory path (~/...)
 * Converts ~ to the user's home directory for cross-platform compatibility
 * @param inputPath - Path that may contain ~/
 * @returns Expanded path
 */
export function expandHomePath(inputPath: string): string {
	if (inputPath.startsWith('~/') || inputPath === '~') {
		return path.join(os.homedir(), inputPath.slice(1));
	}
	return inputPath;
}

/**
 * Check if a path string is valid
 * @param inputPath - Path to validate
 * @returns true if valid path syntax
 */
export function isValidPath(inputPath: string): boolean {
	try {
		path.parse(inputPath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Ensure a directory exists, creating it recursively if needed
 * @param dirPath - Directory path to create
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
	try {
		await fs.mkdir(dirPath, { recursive: true });
	} catch (error: any) {
		if (error.code !== 'EEXIST') {
			throw error;
		}
		// Directory already exists, no error
	}
}

/**
 * Format a timestamp as a localized date/time string
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted date string
 */
export function formatTimestamp(timestamp: number): string {
	return new Date(timestamp).toLocaleString();
}

/**
 * Format a timestamp as a relative time string
 * Examples: "just now", "5m ago", "2h ago", "3d ago"
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Relative time string
 */
export function formatRelativeTime(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp;

	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (seconds < 60) return 'just now';
	if (minutes < 60) return `${minutes}m ago`;
	if (hours < 24) return `${hours}h ago`;
	return `${days}d ago`;
}

/**
 * Convert path to Unix-style (forward slashes)
 * Useful for storing paths in settings in a platform-independent way
 * @param p - Path to convert
 * @returns Unix-style path
 */
export function toUnixPath(p: string): string {
	return p.split(path.sep).join('/');
}

/**
 * Convert path to platform-specific format
 * @param p - Unix-style path
 * @returns Platform-specific path
 */
export function toPlatformPath(p: string): string {
	return p.split('/').join(path.sep);
}

/**
 * Get a user-friendly error message for common file system errors
 * @param error - Error object
 * @returns User-friendly error message
 */
export function getErrorMessage(error: any): string {
	if (!error) return 'Unknown error';

	// Handle Node.js file system error codes
	if (error.code) {
		switch (error.code) {
			case 'EACCES':
				return 'Permission denied';
			case 'ENOENT':
				return 'File or directory not found';
			case 'ENOSPC':
				return 'Disk full';
			case 'ENOTDIR':
				return 'Not a directory';
			case 'EISDIR':
				return 'Is a directory';
			case 'EEXIST':
				return 'File already exists';
			default:
				return `File system error: ${error.code}`;
		}
	}

	// Return error message or toString
	return error.message || error.toString();
}
