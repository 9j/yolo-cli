/**
 * Integration Test: MCP Error Handling
 *
 * Tests various error scenarios and graceful degradation
 */

import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {McpServerManager} from '../../../src/services/mcp.js';
import type {MergedConfig} from '../../../src/types/mcp.js';
import {MCP_ERROR_CODES} from '../../../src/types/mcp.js';

describe('MCP Error Handling', () => {
	let manager: McpServerManager;

	beforeEach(() => {
		manager = new McpServerManager();
	});

	afterEach(async () => {
		await manager.cleanup();
	});

	it('should handle command not found error', async () => {
		const config: MergedConfig = {
			mcpServers: {
				nonexistent: {
					command: 'this-command-does-not-exist-12345',
					args: [],
				},
			},
			sources: {
				nonexistent: 'global',
			},
		};

		const result = await manager.loadFromConfig(config);

		expect(result.servers).toHaveLength(0);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0].serverName).toBe('nonexistent');
		expect(result.errors[0].message).toContain('ENOENT');
	});

	it('should handle multiple server failures gracefully', async () => {
		const config: MergedConfig = {
			mcpServers: {
				fail1: {command: 'invalid1', args: []},
				fail2: {command: 'invalid2', args: []},
				fail3: {command: 'invalid3', args: []},
			},
			sources: {
				fail1: 'global',
				fail2: 'global',
				fail3: 'project',
			},
		};

		const result = await manager.loadFromConfig(config);

		expect(result.servers).toHaveLength(0);
		expect(result.errors).toHaveLength(3);

		// All errors should have required fields
		for (const error of result.errors) {
			expect(error.serverName).toBeDefined();
			expect(error.code).toBeDefined();
			expect(error.message).toBeDefined();
			expect(error.configPath).toBeDefined();
			expect(error.timestamp).toBeInstanceOf(Date);
		}
	});

	it('should provide actionable error messages', async () => {
		const config: MergedConfig = {
			mcpServers: {
				test: {
					command: 'nonexistent-mcp-server',
					args: [],
				},
			},
			sources: {
				test: 'global',
			},
		};

		const result = await manager.loadFromConfig(config);

		expect(result.errors).toHaveLength(1);
		const error = result.errors[0];

		// Error should include useful information
		expect(error.serverName).toBe('test');
		expect(error.configPath).toContain('mcp.json');
		expect(error.message.length).toBeGreaterThan(0);
	});

	it('should track error timestamp', async () => {
		const config: MergedConfig = {
			mcpServers: {
				test: {command: 'invalid', args: []},
			},
			sources: {
				test: 'global',
			},
		};

		const before = new Date();
		const result = await manager.loadFromConfig(config);
		const after = new Date();

		expect(result.errors).toHaveLength(1);
		const errorTime = result.errors[0].timestamp;

		expect(errorTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
		expect(errorTime.getTime()).toBeLessThanOrEqual(after.getTime());
	});

	it('should return structured tool errors', async () => {
		// Test tool execution error
		const result = await manager.callTool('invalid__tool', {});

		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
		expect(result.error?.code).toBe(MCP_ERROR_CODES.TOOL_NOT_FOUND);
		expect(result.error?.message).toBeDefined();
		expect(result.error?.toolName).toBe('invalid__tool');
	});
});
