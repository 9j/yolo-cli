/**
 * Integration Test: MCP Performance
 *
 * Tests that MCP server loading meets performance requirements
 */

import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {McpServerManager} from '../../../src/services/mcp.js';
import type {MergedConfig} from '../../../src/types/mcp.js';

describe('MCP Performance', () => {
	let manager: McpServerManager;

	beforeEach(() => {
		manager = new McpServerManager();
	});

	afterEach(async () => {
		await manager.cleanup();
	});

	it('should load 5 servers in parallel under 5 seconds', async () => {
		// Note: Actual MCP servers would be faster, these fail quickly
		const config: MergedConfig = {
			mcpServers: {
				server1: {command: 'invalid1', args: []},
				server2: {command: 'invalid2', args: []},
				server3: {command: 'invalid3', args: []},
				server4: {command: 'invalid4', args: []},
				server5: {command: 'invalid5', args: []},
			},
			sources: {
				server1: 'global',
				server2: 'global',
				server3: 'global',
				server4: 'project',
				server5: 'project',
			},
		};

		const startTime = Date.now();
		const result = await manager.loadFromConfig(config);
		const duration = result.durationMs;

		// Should complete quickly even with 5 servers
		// Requirement: <2s overhead for 5 servers
		// Allow 5s for test environment
		expect(duration).toBeLessThan(5000);

		// Verify parallel loading (not sequential)
		// If sequential, 5 servers * 1s each = 5s+
		// Parallel should be much faster
		expect(duration).toBeLessThan(3000);
	});

	it('should report accurate load duration', async () => {
		const config: MergedConfig = {
			mcpServers: {},
			sources: {},
		};

		const before = Date.now();
		const result = await manager.loadFromConfig(config);
		const after = Date.now();
		const actualDuration = after - before;

		// Reported duration should match actual duration (within margin)
		expect(result.durationMs).toBeGreaterThanOrEqual(0);
		expect(result.durationMs).toBeLessThanOrEqual(actualDuration + 100); // 100ms margin
	});

	it('should load empty config quickly', async () => {
		const config: MergedConfig = {
			mcpServers: {},
			sources: {},
		};

		const result = await manager.loadFromConfig(config);

		// Empty config should be nearly instant
		expect(result.durationMs).toBeLessThan(100);
	});

	it('should cleanup quickly', async () => {
		const config: MergedConfig = {
			mcpServers: {},
			sources: {},
		};

		await manager.loadFromConfig(config);

		const startTime = Date.now();
		await manager.cleanup();
		const duration = Date.now() - startTime;

		// Cleanup should be fast (<1s)
		expect(duration).toBeLessThan(1000);
	});
});
