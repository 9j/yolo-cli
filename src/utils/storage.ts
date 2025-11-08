/**
 * File storage utilities for configuration and history management
 */

import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type {
	Configuration,
	Message,
	SessionMetadataFile,
} from '../types/index.js';

/**
 * Get the path to the configuration directory
 * Linux/macOS: ~/.config/yolo-cli/
 * Windows: ~/.yolo-cli/
 */
export function getConfigDir(): string {
	if (process.platform === 'win32') {
		return path.join(os.homedir(), '.yolo-cli');
	}

	const xdgConfigHome = process.env.XDG_CONFIG_HOME;
	if (xdgConfigHome) {
		return path.join(xdgConfigHome, 'yolo-cli');
	}

	return path.join(os.homedir(), '.config', 'yolo-cli');
}

/**
 * Get the path to the configuration file
 */
export function getConfigPath(): string {
	return path.join(getConfigDir(), 'config.json');
}

/**
 * Get the path to the history directory for a working directory
 */
export function getHistoryDir(workingDir: string): string {
	return path.join(workingDir, '.yolo');
}

/**
 * Get the path to the history file for a working directory
 * Supports multi-session with optional sessionId parameter
 */
export function getHistoryPath(
	workingDir: string,
	sessionId?: string,
): string {
	const historyDir = getHistoryDir(workingDir);
	if (sessionId) {
		return path.join(historyDir, `history-${sessionId}.jsonl`);
	}

	return path.join(historyDir, 'history.jsonl');
}

/**
 * Get the path to the session metadata file
 */
export function getSessionMetadataPath(workingDir: string): string {
	return path.join(getHistoryDir(workingDir), 'session-metadata.json');
}

/**
 * Ensure a directory exists, creating it if necessary
 */
export async function ensureDir(dirPath: string): Promise<void> {
	try {
		await fs.mkdir(dirPath, {recursive: true});
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
			throw error;
		}
	}
}

/**
 * Check if a file exists
 */
export function fileExists(filePath: string): boolean {
	return existsSync(filePath);
}

/**
 * Read and parse a JSON file
 */
export async function readJsonFile<T>(filePath: string): Promise<T> {
	const content = await fs.readFile(filePath, 'utf-8');
	return JSON.parse(content) as T;
}

/**
 * Write an object to a JSON file with atomic write
 */
export async function writeJsonFile<T>(
	filePath: string,
	data: T,
): Promise<void> {
	const dirPath = path.dirname(filePath);
	await ensureDir(dirPath);

	const tempPath = `${filePath}.tmp`;
	const content = JSON.stringify(data, null, 2);

	await fs.writeFile(tempPath, content, 'utf-8');
	await fs.rename(tempPath, filePath);
}

/**
 * Load configuration from file
 */
export async function loadConfig(): Promise<Configuration | null> {
	const configPath = getConfigPath();

	if (!fileExists(configPath)) {
		return null;
	}

	try {
		return await readJsonFile<Configuration>(configPath);
	} catch {
		return null;
	}
}

/**
 * Save configuration to file
 */
export async function saveConfig(config: Configuration): Promise<void> {
	const configPath = getConfigPath();
	await writeJsonFile(configPath, config);
}

/**
 * Load session metadata from file
 */
export async function loadSessionMetadata(
	workingDir: string,
): Promise<SessionMetadataFile | null> {
	const metadataPath = getSessionMetadataPath(workingDir);

	if (!fileExists(metadataPath)) {
		return null;
	}

	try {
		return await readJsonFile<SessionMetadataFile>(metadataPath);
	} catch {
		return null;
	}
}

/**
 * Save session metadata to file (atomic write)
 */
export async function saveSessionMetadata(
	workingDir: string,
	metadata: SessionMetadataFile,
): Promise<void> {
	const metadataPath = getSessionMetadataPath(workingDir);
	await writeJsonFile(metadataPath, metadata);
}

/**
 * Read messages from history file (JSONL format)
 * Supports multi-session with optional sessionId parameter
 */
export async function readHistory(
	workingDir: string,
	sessionId?: string,
): Promise<Message[]> {
	const historyPath = getHistoryPath(workingDir, sessionId);

	if (!fileExists(historyPath)) {
		return [];
	}

	try {
		const content = await fs.readFile(historyPath, 'utf-8');
		const lines = content.trim().split('\n');
		const messages: Message[] = [];

		for (const line of lines) {
			if (!line.trim()) {
				continue;
			}

			try {
				const message = JSON.parse(line) as Message;
				messages.push(message);
			} catch {
				// Skip malformed lines
				console.warn(`Skipping malformed history line: ${line.slice(0, 50)}...`);
			}
		}

		return messages;
	} catch {
		return [];
	}
}

/**
 * Append a message to the history file (JSONL format)
 * Supports multi-session with optional sessionId parameter
 */
export async function appendToHistory(
	workingDir: string,
	message: Message,
	sessionId?: string,
): Promise<void> {
	const historyPath = getHistoryPath(workingDir, sessionId);
	const historyDir = getHistoryDir(workingDir);

	await ensureDir(historyDir);

	const line = JSON.stringify(message) + '\n';
	await fs.appendFile(historyPath, line, 'utf-8');
}

/**
 * Rotate history file if it exceeds the message limit
 */
export async function rotateHistory(
	workingDir: string,
	maxMessages: number,
): Promise<void> {
	const messages = await readHistory(workingDir);

	if (messages.length <= maxMessages) {
		return;
	}

	// Keep only the most recent messages
	const recentMessages = messages.slice(-maxMessages);

	// Write to temporary file
	const historyPath = getHistoryPath(workingDir);
	const tempPath = `${historyPath}.tmp`;

	const content = recentMessages.map(msg => JSON.stringify(msg)).join('\n') + '\n';
	await fs.writeFile(tempPath, content, 'utf-8');

	// Atomic replace
	await fs.rename(tempPath, historyPath);
}

/**
 * Clear all history for a working directory
 */
export async function clearHistory(workingDir: string): Promise<void> {
	const historyPath = getHistoryPath(workingDir);

	if (fileExists(historyPath)) {
		await fs.unlink(historyPath);
	}
}
