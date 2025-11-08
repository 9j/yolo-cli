/**
 * Tool executor service - manages tool registration and execution
 */

import type {
	Tool,
	ToolCall,
	ToolResult,
	ToolExecutionResult,
} from '../types/tools.js';
import {ALL_TOOLS} from '../tools/index.js';

export interface ToolContext {
	workingDirectory: string;
	requestApproval?: (action: string, details: string) => Promise<boolean>;
}

export class ToolExecutor {
	private readonly tools: Map<string, Tool>;
	private context: ToolContext;

	constructor(tools: Tool[] = ALL_TOOLS, context?: ToolContext) {
		this.tools = new Map();
		this.context = context ?? {workingDirectory: process.cwd()};

		for (const tool of tools) {
			this.tools.set(tool.definition.function.name, tool);
		}
	}

	/**
	 * Set the working directory context
	 */
	setContext(context: ToolContext): void {
		this.context = context;
	}

	/**
	 * Register additional tools (e.g., from MCP servers)
	 */
	registerTools(tools: Tool[]): void {
		for (const tool of tools) {
			this.tools.set(tool.definition.function.name, tool);
		}
	}

	/**
	 * Get all tool definitions for API requests
	 */
	getToolDefinitions() {
		return Array.from(this.tools.values()).map(tool => tool.definition);
	}

	/**
	 * Execute a single tool call
	 */
	async executeTool(toolCall: ToolCall): Promise<ToolResult> {
		const {name, arguments: argsJson} = toolCall.function;

		// Find tool
		const tool = this.tools.get(name);
		if (!tool) {
			return {
				tool_call_id: toolCall.id,
				role: 'tool',
				name,
				content: JSON.stringify({
					success: false,
					error: `Unknown tool: ${name}`,
				}),
			};
		}

		// Parse arguments
		let args: Record<string, unknown>;
		try {
			args = JSON.parse(argsJson) as Record<string, unknown>;
		} catch {
			return {
				tool_call_id: toolCall.id,
				role: 'tool',
				name,
				content: JSON.stringify({
					success: false,
					error: 'Invalid JSON arguments',
				}),
			};
		}

		// Execute tool with context
		try {
			// Inject context into args
			const argsWithContext = {
				...args,
				_context: this.context,
			};
			const result = await tool.executor(argsWithContext);
			return {
				tool_call_id: toolCall.id,
				role: 'tool',
				name,
				content: this.formatToolResult(result),
			};
		} catch (error) {
			return {
				tool_call_id: toolCall.id,
				role: 'tool',
				name,
				content: JSON.stringify({
					success: false,
					error:
						error instanceof Error
							? `Tool execution failed: ${error.message}`
							: 'Tool execution failed',
				}),
			};
		}
	}

	/**
	 * Execute multiple tool calls
	 */
	async executeToolCalls(toolCalls: ToolCall[]): Promise<ToolResult[]> {
		return Promise.all(toolCalls.map(tc => this.executeTool(tc)));
	}

	/**
	 * Format tool execution result as content string
	 */
	private formatToolResult(result: ToolExecutionResult): string {
		if (result.success) {
			return result.output;
		}

		return JSON.stringify({
			success: false,
			error: result.error ?? 'Unknown error',
		});
	}

	/**
	 * Check if a tool exists
	 */
	hasTool(name: string): boolean {
		return this.tools.has(name);
	}

	/**
	 * Get list of available tool names
	 */
	getToolNames(): string[] {
		return Array.from(this.tools.keys());
	}
}

/**
 * Global tool executor instance
 */
export const toolExecutor = new ToolExecutor();
