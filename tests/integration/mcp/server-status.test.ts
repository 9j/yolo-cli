/**
 * Integration Test: MCP Server Status
 *
 * Tests server status tracking and retrieval
 */

import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {McpServerManager} from '../../../src/services/mcp.js';
import type {MergedConfig} from '../../../src/types/mcp.js';

describe('MCP Server Status', () => {
	let manager: McpServerManager;

	beforeEach(() => {
		manager = new McpServerManager();
	});

	afterEach(async () => {
		await manager.cleanup();
	});

	it('should return undefined for non-existent server', () => {
		const status = manager.getServerStatus('nonexistent');
		expect(status).toBeUndefined();
	});

	it('should track server status after failed load', async () => {
		const config: MergedConfig = {
			mcpServers: {
				failing: {
					command: 'nonexistent-command',
					args: [],
				},
			},
			sources: {
				failing: 'global',
			},
		};

		await manager.loadFromConfig(config);

		// Server should not be in registry after failure
		const status = manager.getServerStatus('failing');
		expect(status).toBeUndefined();
	});

	it('should provide server metadata', async () => {
		// After loading, servers that succeeded should have status
		const config: MergedConfig = {
			mcpServers: {},
			sources: {},
		};

		await manager.loadFromConfig(config);

		// With empty config, no servers should be registered
		const status = manager.getServerStatus('any');
		expect(status).toBeUndefined();
	});

	it('should track server source (global vs project)', async () => {
		const config: MergedConfig = {
			mcpServers: {
				globalServer: {command: 'test1', args: []},
				projectServer: {command: 'test2', args: []},
			},
			sources: {
				globalServer: 'global',
				projectServer: 'project',
			},
		};

		const result = await manager.loadFromConfig(config);

		// Verify source is tracked in errors (servers will fail)
		expect(result.errors.length).toBe(2);

		const globalError = result.errors.find(
			e => e.serverName === 'globalServer',
		);
		const projectError = result.errors.find(
			e => e.serverName === 'projectServer',
		);

		expect(globalError?.configPath).toContain('yolo-cli/mcp.json');
		expect(projectError?.configPath).toContain('.yolo/mcp.json');
	});

	it('should track load duration', async () => {
		const config: MergedConfig = {
			mcpServers: {},
			sources: {},
		};

		const result = await manager.loadFromConfig(config);

		expect(result.durationMs).toBeGreaterThanOrEqual(0);
		expect(typeof result.durationMs).toBe('number');
	});
});
