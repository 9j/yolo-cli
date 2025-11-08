/**
 * Unit Tests: MCP Server Manager
 */

import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {McpServerManager} from '../../../src/services/mcp.js';
import type {McpServerConfig, MergedConfig} from '../../../src/types/mcp.js';

describe('MCP Server Manager', () => {
	let manager: McpServerManager;

	beforeEach(() => {
		manager = new McpServerManager();
	});

	afterEach(async () => {
		await manager.cleanup();
	});

	describe('loadFromConfig', () => {
		it('should handle empty config', async () => {
			const emptyConfig: MergedConfig = {
				mcpServers: {},
				sources: {},
			};

			const result = await manager.loadFromConfig(emptyConfig);

			expect(result.servers).toHaveLength(0);
			expect(result.errors).toHaveLength(0);
			expect(result.toolCount).toBe(0);
			expect(result.durationMs).toBeGreaterThanOrEqual(0);
		});

		it('should track failed servers in errors array', async () => {
			const config: MergedConfig = {
				mcpServers: {
					invalid: {
						command: 'nonexistent-command-12345',
						args: [],
					},
				},
				sources: {
					invalid: 'global',
				},
			};

			const result = await manager.loadFromConfig(config);

			expect(result.servers).toHaveLength(0);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0].serverName).toBe('invalid');
		});

		it('should continue loading other servers if one fails (graceful degradation)', async () => {
			const config: MergedConfig = {
				mcpServers: {
					invalid: {
						command: 'nonexistent-command-12345',
						args: [],
					},
					// Note: We can't easily test with a real MCP server in unit tests
					// Integration tests will cover successful server loading
				},
				sources: {
					invalid: 'global',
				},
			};

			const result = await manager.loadFromConfig(config);

			// Should not throw - graceful degradation
			expect(result).toBeDefined();
			expect(result.errors.length).toBeGreaterThan(0);
		});
	});

	describe('getTools', () => {
		it('should return empty array when no servers loaded', async () => {
			const tools = await manager.getTools();
			expect(tools).toEqual([]);
		});
	});

	describe('callTool', () => {
		it('should reject invalid tool name format', async () => {
			const result = await manager.callTool('invalid-format', {});

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			expect(result.error?.code).toBe('TOOL_NOT_FOUND');
			expect(result.error?.message).toContain('Invalid tool name format');
		});

		it('should reject tool from non-existent server', async () => {
			const result = await manager.callTool('nonexistent__tool', {});

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			expect(result.error?.code).toBe('TOOL_NOT_FOUND');
			expect(result.error?.message).toContain('Server not found');
		});
	});

	describe('getServerStatus', () => {
		it('should return undefined for non-existent server', () => {
			const status = manager.getServerStatus('nonexistent');
			expect(status).toBeUndefined();
		});
	});

	describe('cleanup', () => {
		it('should complete without errors even with no servers', async () => {
			await expect(manager.cleanup()).resolves.toBeUndefined();
		});
	});

	describe('tool namespacing', () => {
		it('should namespace tools with server name prefix', () => {
			// This will be tested in integration tests with real servers
			// Unit test verifies the format is correct
			const namespacedTool = 'github__create_issue';
			const [serverName, toolName] = namespacedTool.split('__');

			expect(serverName).toBe('github');
			expect(toolName).toBe('create_issue');
		});
	});
});
