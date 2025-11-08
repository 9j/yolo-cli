/**
 * MCP (Model Context Protocol) Type Definitions
 *
 * This file defines all TypeScript types for MCP server configuration,
 * lifecycle management, and tool registration based on data-model.md.
 */

import type {Client} from '@modelcontextprotocol/sdk/client/index.js';

// ============================================================================
// Configuration Types
// ============================================================================

export interface McpConfig {
	/** Map of server name to server configuration */
	mcpServers: Record<string, McpServerConfig>;
}

export interface McpServerConfig {
	/** Command to spawn server process (required for stdio) */
	command: string;

	/** Command-line arguments passed to server */
	args?: string[];

	/** Environment variables for server process (all values must be strings) */
	env?: Record<string, string>;

	/** Timeout in milliseconds for server responses (default: 60000) */
	timeout?: number;

	/** URL for remote servers (alternative to stdio) */
	url?: string;

	/** HTTP headers for remote servers */
	headers?: Record<string, string>;
}

export interface MergedConfig {
	/** Combined server configurations (project overrides global) */
	mcpServers: Record<string, McpServerConfig>;

	/** Source of each server config for debugging */
	sources: Record<string, 'global' | 'project'>;
}

// ============================================================================
// Runtime State Types
// ============================================================================

export enum McpServerState {
	/** Client created but not yet connected */
	CREATED = 'created',

	/** Spawning process and establishing connection */
	CONNECTING = 'connecting',

	/** Initialize handshake complete, capabilities negotiated */
	INITIALIZED = 'initialized',

	/** Normal operation, processing requests */
	OPERATING = 'operating',

	/** Connection failed or process exited with error */
	FAILED = 'failed',

	/** Cleanly shut down */
	CLOSED = 'closed',
}

export interface McpServerInstance {
	/** Server name (key from config) */
	name: string;

	/** Configuration used to start this server */
	config: McpServerConfig;

	/** MCP Client instance (from @modelcontextprotocol/sdk) */
	client: Client;

	/** Current server state */
	state: McpServerState;

	/** Timestamp when server was started */
	startedAt: Date;

	/** List of tools provided by this server */
	tools: McpTool[];

	/** Source of configuration (for debugging) */
	source: 'global' | 'project';

	/** Error if server failed to start/connect */
	error?: McpServerError;
}

export interface McpServerError {
	/** Error code (MCP standard or custom) */
	code: string;

	/** Human-readable error message */
	message: string;

	/** Server name that failed */
	serverName: string;

	/** Configuration file path where server was defined */
	configPath: string;

	/** Timestamp when error occurred */
	timestamp: Date;

	/** Additional context (spawn error, exit code, etc.) */
	details?: Record<string, any>;
}

// ============================================================================
// Tool Registry Types
// ============================================================================

export interface McpTool {
	/** Namespaced tool name (servername__toolname) */
	name: string;

	/** Original tool name from MCP server */
	originalName: string;

	/** Tool description for AI model */
	description: string;

	/** JSON Schema for tool arguments */
	inputSchema: ToolInputSchema;

	/** Server that provides this tool */
	serverName: string;

	/** Reference to server instance */
	server: McpServerInstance;
}

export interface ToolInputSchema {
	/** Always "object" for MCP tools */
	type: 'object';

	/** Property definitions */
	properties: Record<string, JSONSchemaProperty>;

	/** Required property names */
	required?: string[];

	/** Additional properties allowed */
	additionalProperties?: boolean;
}

export interface JSONSchemaProperty {
	/** Property type */
	type: 'string' | 'number' | 'boolean' | 'array' | 'object';

	/** Human-readable description */
	description?: string;

	/** Enum values (for string type) */
	enum?: string[];

	/** Default value */
	default?: any;

	/** Array item schema (for array type) */
	items?: JSONSchemaProperty;

	/** Object properties (for object type) */
	properties?: Record<string, JSONSchemaProperty>;
}

export interface ToolResult {
	/** Whether tool execution succeeded */
	success: boolean;

	/** Tool output content (if successful) */
	content?: ToolContent[];

	/** Error information (if failed) */
	error?: ToolExecutionError;

	/** Tool execution metadata */
	metadata?: {
		/** Execution time in milliseconds */
		durationMs: number;

		/** Server that executed the tool */
		serverName: string;

		/** Tool name */
		toolName: string;
	};
}

export type ToolContent = TextContent | ImageContent | EmbeddedResourceContent;

export interface TextContent {
	type: 'text';
	text: string;
}

export interface ImageContent {
	type: 'image';
	data: string; // base64-encoded
	mimeType: string; // e.g., 'image/png'
}

export interface EmbeddedResourceContent {
	type: 'resource';
	uri: string;
	mimeType?: string;
	text?: string;
}

export interface ToolExecutionError {
	/** Error code */
	code: string;

	/** Error message */
	message: string;

	/** Tool that failed */
	toolName: string;

	/** Arguments passed to tool */
	arguments: Record<string, any>;

	/** Server-provided error details */
	details?: any;
}

// ============================================================================
// Service Manager Results
// ============================================================================

export interface LoadResult {
	/** Successfully loaded servers */
	servers: McpServerInstance[];

	/** Servers that failed to load */
	errors: McpServerError[];

	/** Total tools discovered */
	toolCount: number;

	/** Load duration in milliseconds */
	durationMs: number;
}

// ============================================================================
// Error Codes
// ============================================================================

export const MCP_ERROR_CODES = {
	// Configuration errors
	INVALID_CONFIG: 'INVALID_CONFIG',
	MISSING_COMMAND: 'MISSING_COMMAND',
	INVALID_ENV_VAR: 'INVALID_ENV_VAR',

	// Connection errors
	COMMAND_NOT_FOUND: 'COMMAND_NOT_FOUND',
	SPAWN_FAILED: 'SPAWN_FAILED',
	CONNECT_TIMEOUT: 'CONNECT_TIMEOUT',
	INITIALIZE_FAILED: 'INITIALIZE_FAILED',

	// Runtime errors
	SERVER_CRASHED: 'SERVER_CRASHED',
	DISCONNECTED: 'DISCONNECTED',
	TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
	TOOL_EXECUTION_FAILED: 'TOOL_EXECUTION_FAILED',
	TOOL_TIMEOUT: 'TOOL_TIMEOUT',
} as const;

export type McpErrorCode =
	(typeof MCP_ERROR_CODES)[keyof typeof MCP_ERROR_CODES];
