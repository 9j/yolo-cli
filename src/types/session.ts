/**
 * Session and conversation data types for YOLO CLI
 */

export interface Session {
	id: string; // Unique session identifier (UUID v4)
	workingDirectory: string; // Absolute path to working directory
	createdAt: string; // ISO 8601 timestamp
	currentModel: string; // Currently selected model ID
	messages: Message[]; // Conversation history (in-memory)
	metadata: SessionMetadata;
}

export interface SessionMetadata {
	isContinuation: boolean; // Whether session continues previous history
	previousSessionId?: string; // ID of continued session (if applicable)
	totalMessages: number; // Running count across all sessions in directory
	totalTokensEstimate: number; // Estimated tokens used (rough calculation)
}

export interface Conversation {
	sessionId: string; // Parent session ID
	messages: Message[]; // Ordered list of messages
	startedAt: string; // ISO 8601 timestamp of first message
	lastActivity: string; // ISO 8601 timestamp of most recent message
	contextUsage: number; // Current context usage as decimal (0.0 - 1.0)
}

export interface Message {
	id: string; // Unique message identifier (UUID v4)
	role: 'user' | 'assistant' | 'system' | 'tool';
	content: string; // Message text content
	timestamp: string | number; // ISO 8601 timestamp or Unix timestamp
	model?: string; // Model ID (only for assistant messages)
	metadata?: MessageMetadata;
}

export interface MessageMetadata {
	tokensUsed?: number; // Actual tokens from API response (if provided)
	tokensEstimate?: number; // Client-side estimate (chars / 4)
	error?: ErrorInfo; // Error information (if message failed)
	streamingDuration?: number; // Milliseconds to complete streaming
	toolCalls?: ToolCall[]; // Tool calls made by assistant (if any)
	toolCallId?: string; // Tool call ID (for tool messages)
	toolName?: string; // Tool name (for tool messages)
}

// Import ToolCall from tools types
import type {ToolCall} from './tools.js';

export interface ErrorInfo {
	type: 'auth' | 'network' | 'rate_limit' | 'server' | 'timeout' | 'unknown';
	message: string; // Human-readable error description
	code?: string; // API error code (if applicable)
	retryCount?: number; // Number of retries attempted
}

// UI State Models

export interface AppState {
	mode: 'setup' | 'interactive' | 'non-interactive';
	session: Session | null; // null during setup
	isLoading: boolean; // API request in progress
	isStreamingResponse: boolean;
	currentInput: string; // User's current input text
	error: ErrorInfo | null; // Current error (if any)
	selectedModelIndex: number; // Index in enabled models array
}

export interface ModelSelectorState {
	enabledModels: ModelConfig[]; // Filtered list of enabled models
	currentIndex: number; // Currently selected index (0-based)
	totalModels: number; // Count of enabled models
}

// Import ModelConfig from config types
import type {ModelConfig} from './config.js';
