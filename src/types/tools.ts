/**
 * Tool/Function calling types for OpenRouter API
 */

export interface ToolDefinition {
	type: 'function';
	function: {
		name: string;
		description: string;
		parameters: {
			type: 'object';
			properties: Record<string, ToolParameter>;
			required: string[];
		};
	};
}

export interface ToolParameter {
	type: 'string' | 'number' | 'boolean' | 'object' | 'array';
	description: string;
	enum?: string[];
	items?: ToolParameter;
	properties?: Record<string, ToolParameter>;
}

export interface ToolCall {
	id: string;
	type: 'function';
	function: {
		name: string;
		arguments: string; // JSON string
	};
	index?: number; // For streaming responses
}

export interface ToolResult {
	tool_call_id: string;
	role: 'tool';
	name: string;
	content: string;
}

export interface ToolExecutionResult {
	success: boolean;
	output: string;
	error?: string;
}

/**
 * Tool executor function signature
 */
export type ToolExecutor = (
	args: Record<string, unknown>,
) => Promise<ToolExecutionResult>;

/**
 * Tool registry entry
 */
export interface Tool {
	definition: ToolDefinition;
	executor: ToolExecutor;
}
