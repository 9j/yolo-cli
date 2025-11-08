/**
 * OpenRouter API data types
 * Based on OpenRouter API specification
 */

import type {ToolDefinition, ToolCall} from './tools.js';

// Request types

export interface ChatCompletionRequest {
	model: string; // OpenRouter model ID
	messages: APIMessage[]; // Conversation history
	stream?: boolean; // Enable streaming (default: true for interactive)
	max_tokens?: number; // Max tokens in response (optional)
	temperature?: number; // Sampling temperature (0-2)
	top_p?: number; // Nucleus sampling threshold
	tools?: ToolDefinition[]; // Function calling tools
	tool_choice?: 'auto' | 'none' | {type: 'function'; function: {name: string}};
}

export interface APIMessage {
	role: 'user' | 'assistant' | 'system' | 'tool';
	content: string | null;
	tool_calls?: ToolCall[];
	tool_call_id?: string; // For tool role messages
	name?: string; // Tool name for tool role messages
}

// Response types

export interface ChatCompletionResponse {
	id: string; // Completion ID
	object: 'chat.completion';
	created: number; // Unix timestamp
	model: string; // Model that generated response
	choices: ChatCompletionChoice[];
	usage?: TokenUsage;
}

export interface ChatCompletionChoice {
	index: number;
	message: {
		role: 'assistant';
		content: string | null;
		tool_calls?: ToolCall[];
	};
	finish_reason: 'stop' | 'length' | 'content_filter' | 'tool_calls';
}

export interface TokenUsage {
	prompt_tokens: number;
	completion_tokens: number;
	total_tokens: number;
}

// Streaming response types

export interface ChatCompletionChunk {
	id: string;
	object: 'chat.completion.chunk';
	created: number;
	model: string;
	choices: ChatCompletionChunkChoice[];
}

export interface ChatCompletionChunkChoice {
	index: number;
	delta: {
		role?: 'assistant';
		content?: string; // Partial content
		tool_calls?: ToolCall[];
	};
	finish_reason: null | 'stop' | 'length' | 'content_filter' | 'tool_calls';
}

// Models list types

export interface ModelsListResponse {
	data: ModelInfo[];
}

export interface ModelInfo {
	id: string;
	name: string;
	description?: string;
	context_length: number;
	pricing: {
		prompt: string;
		completion: string;
		image?: string;
		request?: string;
	};
	architecture?: {
		modality: 'text' | 'text+image' | 'text+audio';
		tokenizer: string;
		instruct_type?: string;
	};
	top_provider?: {
		max_completion_tokens?: number;
		is_moderated: boolean;
	};
}

// Error response types

export interface ErrorResponse {
	error: {
		message: string;
		type?: string;
		code: string;
		param?: string | null;
	};
}

// API key validation types

export interface ApiKeyValidationResponse {
	data: {
		label: string;
		usage: number;
		limit: number | null;
		is_free_tier: boolean;
		rate_limit: {
			requests: number;
			interval: string;
		};
	};
}
