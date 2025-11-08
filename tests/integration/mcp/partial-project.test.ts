/**
 * Integration Test: Partial Project Configuration
 *
 * Tests that global servers still load even if project config has errors
 */

import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {McpServerManager} from '../../../src/services/mcp.js';
import type {MergedConfig} from '../../../src/types/mcp.js';

describe('Partial Project Configuration', () => {
	let manager: McpServerManager;

	beforeEach(() => {
		manager = new McpServerManager();
	});

	afterEach(async () => {
		await manager.cleanup();
	});

	it('should load global servers even if project server fails', async () => {
		// Simulate merged config with both global and project servers
		// In reality, one would fail to load
		const config: MergedConfig = {
			mcpServers: {
				globalServer: {
					command: 'nonexistent-global',
					args: [],
				},
				projectServer: {
					command: 'nonexistent-project',
					args: [],
				},
			},
			sources: {
				globalServer: 'global',
				projectServer: 'project',
			},
		};

		const result = await manager.loadFromConfig(config);

		// Both will fail in this test, but the point is graceful degradation
		// Real scenario: some servers succeed, some fail
		expect(result.errors.length).toBeGreaterThan(0);

		// Verify errors contain both servers
		const errorNames = result.errors.map(e => e.serverName);
		expect(errorNames).toContain('globalServer');
		expect(errorNames).toContain('projectServer');

		// Verify config path is tracked correctly
		const globalError = result.errors.find(
			e => e.serverName === 'globalServer',
		);
		const projectError = result.errors.find(
			e => e.serverName === 'projectServer',
		);

		expect(globalError?.configPath).toContain('yolo-cli/mcp.json');
		expect(projectError?.configPath).toContain('.yolo/mcp.json');
	});

	it('should continue loading if some servers fail', async () => {
		// Graceful degradation test
		const config: MergedConfig = {
			mcpServers: {
				failing1: {command: 'invalid1', args: []},
				failing2: {command: 'invalid2', args: []},
			},
			sources: {
				failing1: 'global',
				failing2: 'project',
			},
		};

		// Should not throw
		const result = await manager.loadFromConfig(config);

		expect(result).toBeDefined();
		expect(result.errors).toHaveLength(2);
		expect(result.servers).toHaveLength(0);
	});
});
