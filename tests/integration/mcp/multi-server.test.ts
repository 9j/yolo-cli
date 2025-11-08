/**
 * Integration Test: Multiple MCP Servers Loading
 */

import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {McpServerManager} from '../../../src/services/mcp.js';
import type {MergedConfig} from '../../../src/types/mcp.js';

describe('Multiple MCP Servers Loading', () => {
	let manager: McpServerManager;

	beforeEach(() => {
		manager = new McpServerManager();
	});

	afterEach(async () => {
		await manager.cleanup();
	});

	it('should continue loading other servers if one fails', async () => {
		const config: MergedConfig = {
			mcpServers: {
				invalid1: {
					command: 'nonexistent-server-1',
					args: [],
				},
				invalid2: {
					command: 'nonexistent-server-2',
					args: [],
				},
			},
			sources: {
				invalid1: 'global',
				invalid2: 'project',
			},
		};

		const result = await manager.loadFromConfig(config);

		// Both servers should fail, but load should complete
		expect(result.errors).toHaveLength(2);
		expect(result.servers).toHaveLength(0);

		// Should have errors for both servers
		const errorNames = result.errors.map((e) => e.serverName);
		expect(errorNames).toContain('invalid1');
		expect(errorNames).toContain('invalid2');
	});

	it('should track source for each server', async () => {
		const config: MergedConfig = {
			mcpServers: {
				globalServer: {
					command: 'invalid-global',
					args: [],
				},
				projectServer: {
					command: 'invalid-project',
					args: [],
				},
			},
			sources: {
				globalServer: 'global',
				projectServer: 'project',
			},
		};

		const result = await manager.loadFromConfig(config);

		// Verify source tracking in errors
		const globalError = result.errors.find(
			(e) => e.serverName === 'globalServer',
		);
		const projectError = result.errors.find(
			(e) => e.serverName === 'projectServer',
		);

		expect(globalError?.configPath).toContain('yolo-cli/mcp.json');
		expect(projectError?.configPath).toContain('.yolo/mcp.json');
	});

	it('should load servers in parallel (performance)', async () => {
		// Even with invalid servers, they should fail in parallel
		const config: MergedConfig = {
			mcpServers: {
				server1: {command: 'invalid1', args: []},
				server2: {command: 'invalid2', args: []},
				server3: {command: 'invalid3', args: []},
			},
			sources: {
				server1: 'global',
				server2: 'global',
				server3: 'global',
			},
		};

		const startTime = Date.now();
		const result = await manager.loadFromConfig(config);
		const duration = Date.now() - startTime;

		// Should complete quickly (not sequential)
		// Allow 5s for potential system delays
		expect(duration).toBeLessThan(5000);
		expect(result.errors).toHaveLength(3);
	});
});
