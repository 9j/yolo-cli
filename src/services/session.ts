/**
 * Session and conversation history management
 */

import {randomUUID} from 'node:crypto';
import type {
	Session,
	Message,
	SessionMetadata,
	Configuration,
	ToolCall,
	SessionMetadataFile,
	SessionInfo,
	CompactionResult,
	CompactionConfig,
} from '../types/index.js';
import {SESSION_METADATA_VERSION} from '../types/index.js';
import {
	readHistory,
	appendToHistory,
	rotateHistory,
	clearHistory as clearHistoryFile,
	loadSessionMetadata,
	saveSessionMetadata,
} from '../utils/storage.js';
import {
	validateMessage,
	validateMessageAlternation,
	validateChronologicalOrder,
} from '../utils/validation.js';
import {estimateConversationTokens} from '../utils/formatting.js';

/**
 * Create a new session
 */
export function createSession(
	workingDirectory: string,
	currentModel: string,
	isContinuation = false,
): Session {
	return {
		id: randomUUID(),
		workingDirectory,
		createdAt: new Date().toISOString(),
		currentModel,
		messages: [],
		metadata: {
			isContinuation,
			totalMessages: 0,
			totalTokensEstimate: 0,
		},
	};
}

/**
 * Load session from history
 */
export async function loadSession(
	workingDirectory: string,
	currentModel: string,
	config: Configuration,
): Promise<Session> {
	const historyMessages = await readHistory(workingDirectory);

	// Validate messages
	const validMessages = historyMessages.filter((msg): msg is Message => {
		if (!validateMessage(msg)) {
			console.warn(`Skipping invalid message`);
			return false;
		}

		return true;
	});

	// Apply history limit
	const historyLimit = config.preferences.historyLimit;
	const messages =
		validMessages.length > historyLimit
			? validMessages.slice(-historyLimit)
			: validMessages;

	// Validate conversation structure
	if (!validateMessageAlternation(messages)) {
		console.warn('Message alternation validation failed, starting fresh session');
		return createSession(workingDirectory, currentModel, false);
	}

	if (!validateChronologicalOrder(messages)) {
		console.warn('Chronological order validation failed, starting fresh session');
		return createSession(workingDirectory, currentModel, false);
	}

	const session = createSession(workingDirectory, currentModel, true);
	session.messages = messages;
	session.metadata.totalMessages = messages.length;
	session.metadata.totalTokensEstimate = estimateConversationTokens(messages);

	return session;
}

/**
 * Add a user message to session
 */
export function addUserMessage(session: Session, content: string): Message {
	const message: Message = {
		id: randomUUID(),
		role: 'user',
		content,
		timestamp: new Date().toISOString(),
		metadata: {
			tokensEstimate: Math.ceil(content.length / 4),
		},
	};

	session.messages.push(message);
	session.metadata.totalMessages++;
	session.metadata.totalTokensEstimate += message.metadata?.tokensEstimate ?? 0;

	return message;
}

/**
 * Add an assistant message to session
 */
export function addAssistantMessage(
	session: Session,
	content: string,
	model: string,
	metadata?: {
		tokensUsed?: number;
		streamingDuration?: number;
		toolCalls?: ToolCall[];
	},
): Message {
	const message: Message = {
		id: randomUUID(),
		role: 'assistant',
		content,
		timestamp: new Date().toISOString(),
		model,
		metadata: {
			tokensEstimate: Math.ceil(content.length / 4),
			...metadata,
		},
	};

	session.messages.push(message);
	session.metadata.totalMessages++;
	session.metadata.totalTokensEstimate +=
		metadata?.tokensUsed ?? message.metadata?.tokensEstimate ?? 0;

	return message;
}

/**
 * Save message to history file
 */
export async function saveMessage(
	workingDirectory: string,
	message: Message,
): Promise<void> {
	await appendToHistory(workingDirectory, message);
}

/**
 * Save session messages to history
 */
export async function saveSession(session: Session, config: Configuration): Promise<void> {
	for (const message of session.messages) {
		await saveMessage(session.workingDirectory, message);
	}

	// Rotate history if needed
	await rotateHistory(session.workingDirectory, config.preferences.historyLimit);
}

/**
 * Clear session history
 */
export async function clearHistory(workingDirectory: string): Promise<void> {
	await clearHistoryFile(workingDirectory);
}

/**
 * Get recent messages (for display)
 */
export function getRecentMessages(session: Session, count = 10): Message[] {
	return session.messages.slice(-count);
}

/**
 * Get conversation messages for API (without metadata)
 */
export function getConversationForAPI(
	session: Session,
): Array<{role: string; content: string}> {
	return session.messages.map(msg => ({
		role: msg.role,
		content: msg.content,
	}));
}

/**
 * Update session model
 */
export function updateSessionModel(session: Session, modelId: string): Session {
	return {
		...session,
		currentModel: modelId,
	};
}

/**
 * Get session statistics
 */
export function getSessionStats(session: Session): SessionMetadata {
	return {
		...session.metadata,
		totalMessages: session.messages.length,
		totalTokensEstimate: estimateConversationTokens(session.messages),
	};
}

/**
 * Check if session has messages
 */
export function hasMessages(session: Session): boolean {
	return session.messages.length > 0;
}

/**
 * Get last user message
 */
export function getLastUserMessage(session: Session): Message | null {
	for (let i = session.messages.length - 1; i >= 0; i--) {
		if (session.messages[i].role === 'user') {
			return session.messages[i];
		}
	}

	return null;
}

/**
 * Get last assistant message
 */
export function getLastAssistantMessage(session: Session): Message | null {
	for (let i = session.messages.length - 1; i >= 0; i--) {
		if (session.messages[i].role === 'assistant') {
			return session.messages[i];
		}
	}

	return null;
}

// ============================================================================
// Multi-Session Support Functions (Feature: 004-slash-commands)
// ============================================================================

/**
 * Create a new session with multi-session support
 * Automatically creates session metadata and history file
 */
export async function createNewSession(
	workingDirectory: string,
	currentModel: string,
): Promise<Session> {
	const session: Session = {
		id: randomUUID(),
		workingDirectory,
		createdAt: new Date().toISOString(),
		currentModel,
		messages: [],
		metadata: {
			isContinuation: false,
			totalMessages: 0,
			totalTokensEstimate: 0,
		},
	};

	// Register session in metadata
	await registerSession(workingDirectory, {
		id: session.id,
		createdAt: session.createdAt,
		lastActivity: session.createdAt,
		messageCount: 0,
		model: currentModel,
		historyFile: `history-${session.id}.jsonl`,
	});

	return session;
}

/**
 * Load current session from metadata
 */
export async function loadCurrentSession(
	workingDirectory: string,
): Promise<Session | null> {
	const metadata = await loadSessionMetadata(workingDirectory);

	if (!metadata || !metadata.currentSessionId) {
		return null;
	}

	const sessionInfo = metadata.sessions.find(
		s => s.id === metadata.currentSessionId,
	);

	if (!sessionInfo) {
		return null;
	}

	// Load messages from session-specific history file
	const messages = await readHistory(workingDirectory, sessionInfo.id);

	const session: Session = {
		id: sessionInfo.id,
		workingDirectory,
		createdAt: sessionInfo.createdAt,
		currentModel: sessionInfo.model,
		messages,
		metadata: {
			isContinuation: messages.length > 0,
			totalMessages: messages.length,
			totalTokensEstimate: estimateConversationTokens(messages),
		},
	};

	return session;
}

/**
 * Register a new session in metadata
 */
export async function registerSession(
	workingDirectory: string,
	sessionInfo: SessionInfo,
): Promise<void> {
	let metadata = await loadSessionMetadata(workingDirectory);

	if (!metadata) {
		// Create new metadata file
		metadata = {
			version: SESSION_METADATA_VERSION,
			currentSessionId: sessionInfo.id,
			lastUpdated: new Date().toISOString(),
			sessions: [sessionInfo],
		};
	} else {
		// Add new session to existing metadata
		metadata.sessions.push(sessionInfo);
		metadata.currentSessionId = sessionInfo.id;
		metadata.lastUpdated = new Date().toISOString();
	}

	await saveSessionMetadata(workingDirectory, metadata);
}

/**
 * Save session to session-specific history file
 */
export async function saveSessionToHistory(session: Session): Promise<void> {
	// Write all messages to session-specific history file
	for (const message of session.messages) {
		await appendToHistory(session.workingDirectory, message, session.id);
	}

	// Update session metadata
	const metadata = await loadSessionMetadata(session.workingDirectory);
	if (metadata) {
		const sessionInfo = metadata.sessions.find(s => s.id === session.id);
		if (sessionInfo) {
			sessionInfo.lastActivity = new Date().toISOString();
			sessionInfo.messageCount = session.messages.length;
			metadata.lastUpdated = new Date().toISOString();
			await saveSessionMetadata(session.workingDirectory, metadata);
		}
	}
}

/**
 * Clear conversation history (reset messages to empty array)
 */
export async function clearConversationHistory(
	session: Session,
): Promise<Session> {
	const cleared: Session = {
		...session,
		messages: [],
		metadata: {
			...session.metadata,
			totalMessages: 0,
			totalTokensEstimate: 0,
		},
	};

	// Save empty session to history (overwrites file)
	await saveSessionToHistory(cleared);

	return cleared;
}

/**
 * Migrate from legacy single-file format to multi-session
 */
export async function migrateToMultiSession(
	workingDirectory: string,
): Promise<boolean> {
	const legacyHistoryPath = `${workingDirectory}/.yolo/history.jsonl`;
	const {fileExists} = await import('../utils/storage.js');

	if (!fileExists(legacyHistoryPath)) {
		return false; // No migration needed
	}

	// Check if already migrated
	const metadata = await loadSessionMetadata(workingDirectory);
	if (metadata) {
		return false; // Already migrated
	}

	// Read legacy messages
	const messages = await readHistory(workingDirectory);

	if (messages.length === 0) {
		return false; // No messages to migrate
	}

	// Create new session with migrated messages
	const newSessionId = randomUUID();
	const createdAt = messages[0].timestamp.toString();
	const lastActivity = messages[messages.length - 1].timestamp.toString();

	const sessionInfo: SessionInfo = {
		id: newSessionId,
		createdAt,
		lastActivity,
		messageCount: messages.length,
		model: 'unknown', // Model not tracked in legacy format
		historyFile: `history-${newSessionId}.jsonl`,
	};

	// Write messages to new session-specific file
	for (const message of messages) {
		await appendToHistory(workingDirectory, message, newSessionId);
	}

	// Create metadata
	await registerSession(workingDirectory, sessionInfo);

	// Rename legacy file as backup
	const fs = await import('node:fs/promises');
	await fs.rename(legacyHistoryPath, `${legacyHistoryPath}.migrated`);

	return true;
}

/**
 * Estimate token count for conversation
 */
export function estimateConversationTokensLocal(messages: Message[]): number {
	return estimateConversationTokens(messages);
}

/**
 * Compact conversation using AI summarization
 */
export async function compactConversation(
	session: Session,
	config: CompactionConfig,
	apiKey: string,
): Promise<CompactionResult> {
	const {messages} = session;

	// Validate minimum message count
	if (messages.length < config.minimumMessagesToCompact) {
		throw new Error(
			`Cannot compact: conversation has only ${messages.length} messages (minimum: ${config.minimumMessagesToCompact})`,
		);
	}

	// Separate system, older, and recent messages
	const systemMessage = messages[0]?.role === 'system' ? messages[0] : null;
	const startIndex = systemMessage ? 1 : 0;
	const recentMessages = messages.slice(-config.preserveRecentCount);
	const olderMessages = messages.slice(
		startIndex,
		messages.length - config.preserveRecentCount,
	);

	// Build summarization prompt
	const conversationText = olderMessages
		.map(m => `${m.role}: ${m.content}`)
		.join('\n\n');

	const summaryPrompt = `You are compacting a conversation history to reduce context size while preserving key information.

**Compression Priorities:**
1. Current topic/question being discussed
2. Important facts, decisions, or conclusions reached
3. Key context about the user's goals or project
4. Unresolved questions or ongoing tasks
5. Critical information that affects future responses

**Compression Rules:**
- KEEP: Current topic, user goals, important facts, unresolved issues
- MERGE: Similar topics into summary points
- REMOVE: Redundant explanations, verbose examples, casual chat
- CONDENSE: Long explanations → key points only

**Output format:**
<conversation_summary>
**Current Focus:** [What we're discussing now]

**Key Points:**
- [Important fact/decision 1]
- [Important fact/decision 2]

**Context:**
- [Relevant background information]

**Unresolved:**
- [Open questions or pending tasks]
</conversation_summary>

Keep the summary under 500 tokens.

**Conversation to summarize:**
${conversationText}`;

	// Call OpenRouter API for summarization
	const {OpenRouterClient} = await import('./openrouter.js');
	const client = new OpenRouterClient({apiKey});

	try {
		const response = await client.createChatCompletion({
			model: session.currentModel,
			messages: [{role: 'user', content: summaryPrompt}],
		});

		const summaryContent =
			response.choices[0]?.message?.content ?? 'Summary generation failed';

		// Validate summary length
		const summaryTokens = Math.ceil(summaryContent.length / 4);
		if (summaryTokens > config.summaryTokenLimit) {
			throw new Error(
				`Summary exceeds token limit: ${summaryTokens} > ${config.summaryTokenLimit}`,
			);
		}

		const summaryMessage: Message = {
			id: randomUUID(),
			role: 'assistant',
			content: summaryContent,
			timestamp: new Date().toISOString(),
			metadata: {
				tokensEstimate: summaryTokens,
			},
		};

		// Calculate metrics
		const originalTokens = estimateConversationTokens(messages);
		const compactedMessages = [
			...(systemMessage ? [systemMessage] : []),
			summaryMessage,
			...recentMessages,
		];
		const compactedTokens = estimateConversationTokens(compactedMessages);
		const reduction =
			((originalTokens - compactedTokens) / originalTokens) * 100;

		return {
			originalMessageCount: messages.length,
			compactedMessageCount: compactedMessages.length,
			originalTokenEstimate: originalTokens,
			compactedTokenEstimate: compactedTokens,
			reductionPercentage: reduction,
			summaryMessage,
			preservedMessages: recentMessages,
		};
	} catch (error) {
		throw new Error(
			`Failed to compact conversation: ${error instanceof Error ? error.message : 'Unknown error'}`,
		);
	}
}
