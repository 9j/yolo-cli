/**
 * Input validation utilities
 */

import type {Configuration, Message, ModelConfig} from '../types/index.js';

/**
 * Validate OpenRouter API key format
 * Format: sk-or-v1-{random_string}
 */
export function validateApiKey(apiKey: string): boolean {
	const apiKeyRegex = /^sk-or-v1-[a-zA-Z0-9_-]+$/;
	return apiKeyRegex.test(apiKey);
}

/**
 * Validate configuration object
 */
export function validateConfig(config: unknown): config is Configuration {
	if (!config || typeof config !== 'object') {
		return false;
	}

	const cfg = config as Partial<Configuration>;

	// Check required fields
	if (!cfg.version || typeof cfg.version !== 'string') {
		return false;
	}

	if (!cfg.apiKey || typeof cfg.apiKey !== 'string') {
		return false;
	}

	if (!validateApiKey(cfg.apiKey)) {
		return false;
	}

	if (!Array.isArray(cfg.models)) {
		return false;
	}

	if (cfg.models.length === 0) {
		return false;
	}

	// At least one model must be enabled
	if (!cfg.models.some(m => m.enabled)) {
		return false;
	}

	// Validate each model config
	for (const model of cfg.models) {
		if (!validateModelConfig(model)) {
			return false;
		}
	}

	// Validate defaultModel if set
	if (cfg.defaultModel) {
		const modelIds = cfg.models.map(m => m.id);
		if (!modelIds.includes(cfg.defaultModel)) {
			return false;
		}
	}

	// Validate preferences
	if (!cfg.preferences || typeof cfg.preferences !== 'object') {
		return false;
	}

	if (typeof cfg.preferences.showContextUsage !== 'boolean') {
		return false;
	}

	if (
		typeof cfg.preferences.historyLimit !== 'number' ||
		cfg.preferences.historyLimit < 10
	) {
		return false;
	}

	return true;
}

/**
 * Validate model configuration object
 */
export function validateModelConfig(model: unknown): model is ModelConfig {
	if (!model || typeof model !== 'object') {
		return false;
	}

	const m = model as Partial<ModelConfig>;

	if (!m.id || typeof m.id !== 'string') {
		return false;
	}

	if (!m.name || typeof m.name !== 'string') {
		return false;
	}

	if (typeof m.enabled !== 'boolean') {
		return false;
	}

	// Validate model ID format (provider/model-name or provider/model-name:variant)
	if (!/^[a-z0-9-]+\/[a-z0-9.:_-]+$/i.test(m.id)) {
		return false;
	}

	return true;
}

/**
 * Validate message object
 */
export function validateMessage(message: unknown): message is Message {
	if (!message || typeof message !== 'object') {
		return false;
	}

	const msg = message as Partial<Message>;

	if (!msg.id || typeof msg.id !== 'string') {
		return false;
	}

	if (!msg.role || !['user', 'assistant', 'system'].includes(msg.role)) {
		return false;
	}

	if (!msg.content || typeof msg.content !== 'string') {
		return false;
	}

	if (msg.content.length === 0 || msg.content.length > 100000) {
		return false;
	}

	if (!msg.timestamp || typeof msg.timestamp !== 'string') {
		return false;
	}

	// Validate ISO 8601 timestamp
	if (!isValidISODate(msg.timestamp)) {
		return false;
	}

	// Assistant messages must have model field
	if (msg.role === 'assistant' && !msg.model) {
		return false;
	}

	// User messages should not have model field
	if (msg.role === 'user' && msg.model) {
		return false;
	}

	return true;
}

/**
 * Validate ISO 8601 date string
 */
export function isValidISODate(dateString: string): boolean {
	const date = new Date(dateString);
	return !isNaN(date.getTime()) && date.toISOString() === dateString;
}

/**
 * Validate UUID v4 format
 */
export function isValidUUID(uuid: string): boolean {
	const uuidRegex =
		/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	return uuidRegex.test(uuid);
}

/**
 * Validate message role alternation in conversation
 * After first user message, messages must alternate between user/assistant
 */
export function validateMessageAlternation(messages: Message[]): boolean {
	if (messages.length === 0) {
		return true;
	}

	// First message must be from user
	if (messages[0].role !== 'user') {
		return false;
	}

	// Check alternation
	for (let i = 1; i < messages.length; i++) {
		const prev = messages[i - 1];
		const curr = messages[i];

		// System messages can appear anywhere
		if (curr.role === 'system') {
			continue;
		}

		// Skip if previous was system
		if (prev.role === 'system') {
			continue;
		}

		// User and assistant must alternate
		if (prev.role === curr.role) {
			return false;
		}
	}

	return true;
}

/**
 * Validate chronological order of message timestamps
 */
export function validateChronologicalOrder(messages: Message[]): boolean {
	for (let i = 1; i < messages.length; i++) {
		const prevTime = new Date(messages[i - 1].timestamp).getTime();
		const currTime = new Date(messages[i].timestamp).getTime();

		if (currTime < prevTime) {
			return false;
		}
	}

	return true;
}

/**
 * Sanitize user input to prevent injection attacks
 */
export function sanitizeInput(input: string): string {
	// Remove null bytes
	let sanitized = input.replace(/\0/g, '');

	// Trim whitespace
	sanitized = sanitized.trim();

	return sanitized;
}

/**
 * Validate working directory path
 */
export function isValidPath(dirPath: string): boolean {
	// Check for null bytes
	if (dirPath.includes('\0')) {
		return false;
	}

	// Must be absolute path
	if (!dirPath.startsWith('/') && !dirPath.match(/^[A-Z]:\\/i)) {
		return false;
	}

	return true;
}
