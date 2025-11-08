/**
 * Slash command system types for YOLO CLI
 * Feature: 004-slash-commands
 */

import type {Session} from './session.js';
import type {ErrorInfo} from './session.js';

// Slash Command System

export interface SlashCommand {
	name: string; // Primary command name (lowercase, alphanumeric)
	aliases: string[]; // Alternative names for this command
	description: string; // Human-readable description for help text
	requiresConfirmation: boolean; // Whether command requires confirmation before execution
	handler: (context: CommandContext) => Promise<void>; // Async handler function
}

export interface CommandContext {
	session: Session; // Current active session
	setSession: (session: Session) => void; // Update session state
	setInput: (text: string) => void; // Clear or update input field
	setError: (error: ErrorInfo) => void; // Display feedback/error message to user
	exit: () => void; // Exit the CLI application
}

// Multi-Session Support

export interface SessionMetadataFile {
	version: string; // Schema version (e.g., "1.0.0")
	currentSessionId: string; // UUID of active session
	lastUpdated: string; // ISO 8601 timestamp
	sessions: SessionInfo[]; // All session metadata
}

export interface SessionInfo {
	id: string; // Session UUID
	createdAt: string; // ISO 8601 timestamp
	lastActivity: string; // ISO 8601 timestamp
	messageCount: number; // Cached count
	model: string; // Model used
	historyFile: string; // e.g., "history-{id}.jsonl"
}

// Conversation Compaction

export interface CompactionResult {
	originalMessageCount: number;
	compactedMessageCount: number;
	originalTokenEstimate: number;
	compactedTokenEstimate: number;
	reductionPercentage: number;
	summaryMessage: Message;
	preservedMessages: Message[];
}

export interface CompactionConfig {
	preserveRecentCount: number; // Number of recent messages to keep verbatim
	minimumMessagesToCompact: number; // Minimum messages required before compaction
	contextThreshold: number; // Fraction of context window to trigger warning
	summaryTokenLimit: number; // Maximum tokens allowed in summary
}

// Import Message from session types
import type {Message} from './session.js';

// Configuration Constants

export const COMPACTION_CONFIG: CompactionConfig = {
	preserveRecentCount: 12, // Keep last 12 messages (6 exchanges)
	minimumMessagesToCompact: 20, // Minimum threshold
	contextThreshold: 0.8, // Compact at 80% context
	summaryTokenLimit: 500, // Max tokens in summary
};

export const SESSION_METADATA_VERSION = '1.0.0';
