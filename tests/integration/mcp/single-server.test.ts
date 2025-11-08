/**
 * Integration Test: Single MCP Server Loading
 */

import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {McpServerManager} from '../../../src/services/mcp.js';
import type {MergedConfig} from '../../../src/types/mcp.js';

describe('Single MCP Server Loading', () => {
	let manager: McpServerManager;

	beforeEach(() => {
		manager = new McpServerManager();
	});

	afterEach(async () => {
		await manager.cleanup();
	});

	it('should handle server with invalid command gracefully', async () => {
		const config: MergedConfig = {
			mcpServers: {
				invalid: {
					command: 'nonexistent-mcp-server',
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
		expect(result.toolCount).toBe(0);
	});

	it('should report load duration', async () => {
		const config: MergedConfig = {
			mcpServers: {},
			sources: {},
		};

		const result = await manager.loadFromConfig(config);

		expect(result.durationMs).toBeGreaterThanOrEqual(0);
		expect(typeof result.durationMs).toBe('number');
	});
});
