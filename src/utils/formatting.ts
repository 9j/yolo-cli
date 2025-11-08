/**
 * Text formatting utilities for display and context estimation
 */

import type {Message, Model} from '../types/index.js';

/**
 * Estimate token count from text using character-based approximation
 * Rule: ~4 characters per token (conservative estimate)
 */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

/**
 * Estimate total tokens in a conversation
 */
export function estimateConversationTokens(messages: Message[]): number {
	let total = 0;

	for (const message of messages) {
		// Add message content tokens
		total += estimateTokens(message.content);

		// Add overhead for role and formatting (~10 tokens per message)
		total += 10;
	}

	return total;
}

/**
 * Calculate context usage percentage for a model
 */
export function calculateContextUsage(
	messages: Message[],
	model: Model,
): number {
	const tokensUsed = estimateConversationTokens(messages);
	const contextLength = model.context_length;

	if (contextLength === 0) {
		return 0;
	}

	return Math.min(1, tokensUsed / contextLength);
}

/**
 * Format context usage as percentage string
 */
export function formatContextUsage(usage: number): string {
	const percentage = Math.round(usage * 100);
	return `${percentage}%`;
}

/**
 * Format model name for display
 * Example: "anthropic/claude-3-opus" -> "Claude 3 Opus"
 */
export function formatModelName(modelId: string): string {
	// Extract model name part (after /)
	const parts = modelId.split('/');
	if (parts.length < 2) {
		return modelId;
	}

	const modelPart = parts[1];

	// Convert hyphens to spaces and title case
	return modelPart
		.split('-')
		.map(word => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

/**
 * Format timestamp for display
 * Example: "2025-11-08T10:00:00Z" -> "10:00 AM"
 */
export function formatTimestamp(timestamp: string | number): string {
	const date = new Date(timestamp);

	return date.toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true,
	});
}

/**
 * Format date and time for display
 * Example: "2025-11-08T10:00:00Z" -> "Nov 8, 10:00 AM"
 */
export function formatDateTime(isoTimestamp: string): string {
	const date = new Date(isoTimestamp);

	return date.toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hour12: true,
	});
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(milliseconds: number): string {
	if (milliseconds < 1000) {
		return `${milliseconds}ms`;
	}

	const seconds = Math.round(milliseconds / 1000);
	if (seconds < 60) {
		return `${seconds}s`;
	}

	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}

	return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format price from string to human-readable format
 * Example: "0.000015" -> "$0.000015"
 */
export function formatPrice(priceString: string): string {
	const price = Number.parseFloat(priceString);

	if (price === 0) {
		return 'Free';
	}

	if (price >= 1) {
		return `$${price.toFixed(2)}`;
	}

	// For very small prices, use scientific notation
	if (price < 0.000001) {
		return `$${price.toExponential(2)}`;
	}

	return `$${price.toFixed(6)}`;
}

/**
 * Format token count with thousands separator
 * Example: 150000 -> "150,000"
 */
export function formatTokenCount(tokens: number): string {
	return tokens.toLocaleString('en-US');
}

/**
 * Pluralize a word based on count
 */
export function pluralize(word: string, count: number): string {
	return count === 1 ? word : `${word}s`;
}

/**
 * Format message count
 * Example: 5 -> "5 messages", 1 -> "1 message"
 */
export function formatMessageCount(count: number): string {
	return `${count} ${pluralize('message', count)}`;
}

/**
 * Word wrap text to a maximum line width
 */
export function wordWrap(text: string, maxWidth: number): string {
	const words = text.split(' ');
	const lines: string[] = [];
	let currentLine = '';

	for (const word of words) {
		if (currentLine.length + word.length + 1 <= maxWidth) {
			currentLine += (currentLine.length > 0 ? ' ' : '') + word;
		} else {
			if (currentLine.length > 0) {
				lines.push(currentLine);
			}

			currentLine = word;
		}
	}

	if (currentLine.length > 0) {
		lines.push(currentLine);
	}

	return lines.join('\n');
}

/**
 * Strip ANSI color codes from text
 */
export function stripAnsi(text: string): string {
	// eslint-disable-next-line no-control-regex
	return text.replace(/\x1B\[[0-9;]*m/g, '');
}

/**
 * Get display width of text (accounting for multi-byte characters)
 */
export function getDisplayWidth(text: string): number {
	// Simple approximation: count characters without ANSI codes
	return stripAnsi(text).length;
}
