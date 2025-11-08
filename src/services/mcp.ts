/**
 * MCP Server Manager Service
 *
 * Manages the lifecycle of MCP server connections, including spawning processes,
 * maintaining tool registries, executing tool calls, and cleanup.
 */

import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import type {
	McpConfig,
	McpServerConfig,
	McpServerInstance,
	McpServerState,
	McpServerError,
	McpTool,
	ToolResult,
	LoadResult,
	MergedConfig,
} from '../types/mcp.js';
import {MCP_ERROR_CODES} from '../types/mcp.js';

/**
 * MCP Server Manager Interface
 */
export interface IMcpServerManager {
	loadFromConfig(config: MergedConfig): Promise<LoadResult>;
	connectServer(
		name: string,
		config: McpServerConfig,
	): Promise<McpServerInstance>;
	getTools(): Promise<McpTool[]>;
	callTool(toolName: string, args: Record<string, any>): Promise<ToolResult>;
	getServerStatus(name: string): McpServerInstance | undefined;
	cleanup(): Promise<void>;
}

/**
 * Default timeout for server operations (ms)
 */
const DEFAULT_TIMEOUT = 60_000; // 60 seconds

/**
 * MCP Server Manager Implementation
 */
export class McpServerManager implements IMcpServerManager {
	private servers: Map<string, McpServerInstance> = new Map();
	private tools: Map<string, McpTool> = new Map();

	/**
	 * Load MCP servers from merged configuration
	 */
	async loadFromConfig(config: MergedConfig): Promise<LoadResult> {
		const startTime = Date.now();
		const errors: McpServerError[] = [];
		const servers: McpServerInstance[] = [];

		// Load all servers in parallel
		const loadPromises = Object.entries(config.mcpServers).map(
			async ([name, serverConfig]) => {
				try {
					const source = config.sources[name] ?? 'global';
					const instance = await this.connectServer(name, serverConfig);
					instance.source = source;
					servers.push(instance);
					this.servers.set(name, instance);
				} catch (error) {
					const serverError: McpServerError = {
						code:
							(error as any).code ??
							MCP_ERROR_CODES.SPAWN_FAILED,
						message: (error as Error).message,
						serverName: name,
						configPath:
							config.sources[name] === 'project'
								? '.yolo/mcp.json'
								: '~/.config/yolo-cli/mcp.json',
						timestamp: new Date(),
						details: error as Record<string, any>,
					};
					errors.push(serverError);

					// Log warning but continue loading other servers (graceful degradation)
					console.warn(
						`✗ MCP server '${name}' failed to start: ${serverError.message}`,
					);
				}
			},
		);

		await Promise.all(loadPromises);

		// Collect all tools from successfully loaded servers
		const tools = await this.getTools();
		const toolCount = tools.length;

		const durationMs = Date.now() - startTime;

		return {
			servers,
			errors,
			toolCount,
			durationMs,
		};
	}

	/**
	 * Connect to a single MCP server
	 */
	async connectServer(
		name: string,
		config: McpServerConfig,
	): Promise<McpServerInstance> {
		// Create MCP client
		const client = new Client(
			{
				name: 'yolo-cli',
				version: '1.0.0',
			},
			{
				capabilities: {},
			},
		);

		// Create server instance
		const instance: McpServerInstance = {
			name,
			config,
			client,
			state: 'created' as McpServerState,
			startedAt: new Date(),
			tools: [],
			source: 'global', // Will be overridden by loadFromConfig
		};

		try {
			// Update state to connecting
			instance.state = 'connecting' as McpServerState;

			// Create stdio transport (this will spawn the process)
			const transport = new StdioClientTransport({
				command: config.command,
				args: config.args,
				env: config.env,
			});

			// Connect client to transport
			await client.connect(transport);

			// Update state to initialized
			instance.state = 'initialized' as McpServerState;

			// Discover tools from server
			const toolsResponse = await client.listTools();
			const tools = toolsResponse.tools ?? [];

			// Register tools with namespacing
			instance.tools = tools.map((tool) => ({
				name: `${name}__${tool.name}`, // Namespaced
				originalName: tool.name,
				description: tool.description ?? '',
				inputSchema: tool.inputSchema as any,
				serverName: name,
				server: instance,
			}));

			// Update state to operating
			instance.state = 'operating' as McpServerState;

			return instance;
		} catch (error) {
			// Update state to failed
			instance.state = 'failed' as McpServerState;
			instance.error = {
				code: MCP_ERROR_CODES.CONNECT_TIMEOUT,
				message: (error as Error).message,
				serverName: name,
				configPath: '',
				timestamp: new Date(),
				details: error as Record<string, any>,
			};

			throw error;
		}
	}

	/**
	 * Get all available tools from all active servers
	 */
	async getTools(): Promise<McpTool[]> {
		const tools: McpTool[] = [];

		for (const server of this.servers.values()) {
			if (server.state === ('operating' as McpServerState)) {
				tools.push(...server.tools);

				// Register tools in tool registry
				for (const tool of server.tools) {
					this.tools.set(tool.name, tool);
				}
			}
		}

		return tools;
	}

	/**
	 * Execute a tool by namespaced name
	 */
	async callTool(
		toolName: string,
		args: Record<string, any>,
	): Promise<ToolResult> {
		const startTime = Date.now();

		// Parse namespaced name
		const separatorIndex = toolName.indexOf('__');
		if (separatorIndex === -1) {
			return {
				success: false,
				error: {
					code: MCP_ERROR_CODES.TOOL_NOT_FOUND,
					message: `Invalid tool name format: ${toolName}. Expected format: servername__toolname`,
					toolName,
					arguments: args,
				},
			};
		}

		const serverName = toolName.slice(0, separatorIndex);
		const originalToolName = toolName.slice(separatorIndex + 2);

		// Get server instance
		const server = this.servers.get(serverName);
		if (!server) {
			return {
				success: false,
				error: {
					code: MCP_ERROR_CODES.TOOL_NOT_FOUND,
					message: `Server not found: ${serverName}`,
					toolName,
					arguments: args as Record<string, any>,
				},
			};
		}

		// Check server state
		if (server.state !== ('operating' as McpServerState)) {
			return {
				success: false,
				error: {
					code: MCP_ERROR_CODES.SERVER_CRASHED,
					message: `Server '${serverName}' is not operating (state: ${server.state})`,
					toolName,
					arguments: args,
				},
			};
		}

		// Execute tool
		try {
			const response = await server.client.callTool({
				name: originalToolName,
				arguments: args,
			});

			const durationMs = Date.now() - startTime;

			return {
				success: true,
				content: response.content as any[],
				metadata: {
					durationMs,
					serverName,
					toolName: originalToolName,
				},
			};
		} catch (error) {
			return {
				success: false,
				error: {
					code: MCP_ERROR_CODES.TOOL_EXECUTION_FAILED,
					message: (error as Error).message,
					toolName,
					arguments: args as Record<string, any>,
					details: error as Record<string, any>,
				},
			};
		}
	}

	/**
	 * Get current status of a server by name
	 */
	getServerStatus(name: string): McpServerInstance | undefined {
		return this.servers.get(name);
	}

	/**
	 * Clean up all server connections
	 */
	async cleanup(): Promise<void> {
		const cleanupPromises: Promise<void>[] = [];

		for (const [name, server] of this.servers.entries()) {
			const cleanupPromise = (async () => {
				try {
					// Close client connection
					await server.client.close();

					// Update state
					server.state = 'closed' as McpServerState;
				} catch (error) {
					console.warn(
						`Warning: Failed to clean up MCP server '${name}': ${(error as Error).message}`,
					);
				}
			})();

			cleanupPromises.push(cleanupPromise);
		}

		// Wait for all cleanups to complete
		await Promise.all(cleanupPromises);

		// Clear registries
		this.servers.clear();
		this.tools.clear();
	}
}
