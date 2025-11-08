/**
 * Configuration data types for YOLO CLI
 * Stored in ~/.config/yolo-cli/config.json
 */

export interface Configuration {
	version: string; // Config schema version (e.g., "1.0.0")
	apiKey: string; // OpenRouter API key
	models: ModelConfig[]; // User's enabled models
	defaultModel?: string; // Default model ID (optional)
	preferences: UserPreferences;
	modelCache?: ModelCache; // Cached model metadata
}

export interface ModelConfig {
	id: string; // OpenRouter model ID (e.g., "anthropic/claude-3-opus")
	name: string; // Display name (e.g., "Claude 3 Opus")
	enabled: boolean; // Whether model appears in Tab cycling
	lastUsed?: string; // ISO 8601 timestamp of last use
}

export interface UserPreferences {
	showContextUsage: boolean; // Display context % in status bar (default: true)
	historyLimit: number; // Max messages to keep in history (default: 100)
	autoApprove: boolean; // Auto-approve destructive operations (default: false)
	theme?: 'auto' | 'light' | 'dark'; // Terminal color scheme (future)
}

export interface ModelCache {
	lastUpdated: string; // ISO 8601 timestamp
	ttl: number; // Cache lifetime in milliseconds (default: 86400000 = 24h)
	models: Model[]; // Full model list from API
}

export interface Model {
	id: string; // Unique OpenRouter model identifier
	name: string; // Human-readable model name
	description?: string; // Model description
	context_length: number; // Maximum context window in tokens
	pricing: {
		prompt: string; // Cost per token (prompt)
		completion: string; // Cost per token (completion)
	};
	architecture?: {
		modality: 'text' | 'text+image' | 'text+audio';
		tokenizer: string; // Tokenizer used (e.g., "cl100k_base")
		instruct_type?: string; // Instruction format (e.g., "none", "alpaca")
	};
	top_provider?: {
		max_completion_tokens?: number;
		is_moderated: boolean;
	};
}

// Default values
export const DEFAULT_PREFERENCES: UserPreferences = {
	showContextUsage: true,
	historyLimit: 100,
	autoApprove: false, // Require approval for destructive operations by default
};

export const MODEL_CACHE_TTL = 86400000; // 24 hours in milliseconds
export const CURRENT_CONFIG_VERSION = '1.0.0';
