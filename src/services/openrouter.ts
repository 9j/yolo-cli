/**
 * OpenRouter API client for chat completions
 */

import type {
	ChatCompletionRequest,
	ChatCompletionResponse,
	ChatCompletionChunk,
	ModelsListResponse,
	ApiKeyValidationResponse,
	ErrorResponse,
	APIMessage,
} from '../types/index.js';

const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';
const DEFAULT_TIMEOUT = 300000; // 5 minutes (increased for tool usage)
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

export interface OpenRouterClientOptions {
	apiKey: string;
	timeout?: number;
}

export class OpenRouterClient {
	private readonly apiKey: string;
	private readonly timeout: number;

	constructor(options: OpenRouterClientOptions) {
		this.apiKey = options.apiKey;
		this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
	}

	/**
	 * Create a chat completion (non-streaming)
	 */
	async createChatCompletion(
		request: ChatCompletionRequest,
	): Promise<ChatCompletionResponse> {
		const url = `${OPENROUTER_API_BASE}/chat/completions`;

		const response = await this.fetchWithRetry(url, {
			method: 'POST',
			headers: this.getHeaders(),
			body: JSON.stringify({
				...request,
				stream: false,
			}),
		});

		if (!response.ok) {
			throw await this.handleErrorResponse(response);
		}

		return (await response.json()) as ChatCompletionResponse;
	}

	/**
	 * Create a chat completion with streaming
	 */
	async *streamChatCompletion(
		request: ChatCompletionRequest,
		signal?: AbortSignal,
	): AsyncGenerator<ChatCompletionChunk> {
		const url = `${OPENROUTER_API_BASE}/chat/completions`;

		// Combine timeout signal with user-provided signal
		const signals = [AbortSignal.timeout(this.timeout)];
		if (signal) {
			signals.push(signal);
		}
		const combinedSignal = AbortSignal.any(signals);

		const response = await fetch(url, {
			method: 'POST',
			headers: this.getHeaders(),
			body: JSON.stringify({
				...request,
				stream: true,
			}),
			signal: combinedSignal,
		});

		if (!response.ok) {
			throw await this.handleErrorResponse(response);
		}

		if (!response.body) {
			throw new Error('Response body is null');
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';

		try {
			while (true) {
				const {done, value} = await reader.read();

				if (done) {
					break;
				}

				buffer += decoder.decode(value, {stream: true});
				const lines = buffer.split('\n');

				// Keep the last incomplete line in buffer
				buffer = lines.pop() || '';

				for (const line of lines) {
					const trimmed = line.trim();

					if (!trimmed || trimmed === 'data: [DONE]') {
						continue;
					}

					if (trimmed.startsWith('data: ')) {
						const data = trimmed.slice(6);

						try {
							const chunk = JSON.parse(data) as ChatCompletionChunk;
							yield chunk;
						} catch {
							// Skip malformed chunks
							console.warn('Skipping malformed chunk:', data);
						}
					}
				}
			}
		} finally {
			reader.releaseLock();
		}
	}

	/**
	 * List available models
	 */
	async listModels(): Promise<ModelsListResponse> {
		const url = `${OPENROUTER_API_BASE}/models`;

		const response = await this.fetchWithRetry(url, {
			method: 'GET',
			headers: this.getHeaders(),
		});

		if (!response.ok) {
			throw await this.handleErrorResponse(response);
		}

		return (await response.json()) as ModelsListResponse;
	}

	/**
	 * Validate API key
	 */
	async validateApiKey(): Promise<ApiKeyValidationResponse> {
		const url = `${OPENROUTER_API_BASE}/auth/key`;

		const response = await fetch(url, {
			method: 'GET',
			headers: this.getHeaders(),
			signal: AbortSignal.timeout(this.timeout),
		});

		if (!response.ok) {
			throw await this.handleErrorResponse(response);
		}

		return (await response.json()) as ApiKeyValidationResponse;
	}

	/**
	 * Convert internal messages to API format
	 */
	static toAPIMessages(messages: Array<{role: string; content: string}>): APIMessage[] {
		return messages.map(msg => ({
			role: msg.role as 'user' | 'assistant' | 'system',
			content: msg.content,
		}));
	}

	/**
	 * Get request headers
	 */
	private getHeaders(): Record<string, string> {
		return {
			'Authorization': `Bearer ${this.apiKey}`,
			'Content-Type': 'application/json',
			'HTTP-Referer': 'https://github.com/your-org/yolo-cli',
			'X-Title': 'YOLO CLI',
		};
	}

	/**
	 * Fetch with retry logic
	 */
	private async fetchWithRetry(
		url: string,
		options: RequestInit,
		retryCount = 0,
	): Promise<Response> {
		try {
			const response = await fetch(url, {
				...options,
				signal: AbortSignal.timeout(this.timeout),
			});

			// Retry on rate limit or server errors
			if (
				(response.status === 429 || response.status >= 500) &&
				retryCount < MAX_RETRIES
			) {
				const delay = RETRY_DELAYS[retryCount];
				await this.sleep(delay);
				return this.fetchWithRetry(url, options, retryCount + 1);
			}

			return response;
		} catch (error) {
			// Retry on network errors
			if (retryCount < MAX_RETRIES) {
				const delay = RETRY_DELAYS[retryCount];
				await this.sleep(delay);
				return this.fetchWithRetry(url, options, retryCount + 1);
			}

			throw error;
		}
	}

	/**
	 * Handle error response
	 */
	private async handleErrorResponse(response: Response): Promise<Error> {
		let errorMessage = `API error: ${response.status} ${response.statusText}`;

		try {
			const errorData = (await response.json()) as ErrorResponse;
			if (errorData.error?.message) {
				errorMessage = errorData.error.message;
			}
		} catch {
			// Use default error message
		}

		const error = new Error(errorMessage);
		(error as Error & {status: number}).status = response.status;
		return error;
	}

	/**
	 * Sleep for a specified duration
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => {
			setTimeout(resolve, ms);
		});
	}
}
