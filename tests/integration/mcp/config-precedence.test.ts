/**
 * Integration Test: MCP Configuration Precedence
 *
 * Tests that project configuration overrides global configuration
 */

import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {mergeConfigs} from '../../../src/utils/mcp-config.js';
import type {McpConfig} from '../../../src/types/mcp.js';

describe('MCP Configuration Precedence', () => {
	it('should prefer project config over global for same server name', () => {
		const global: McpConfig = {
			mcpServers: {
				github: {
					command: 'npx',
					args: ['-y', '@modelcontextprotocol/server-github'],
					env: {
						GITHUB_TOKEN: 'global_token',
					},
				},
			},
		};

		const project: McpConfig = {
			mcpServers: {
				github: {
					command: 'npx',
					args: ['-y', '@modelcontextprotocol/server-github'],
					env: {
						GITHUB_TOKEN: 'project_token',
					},
				},
			},
		};

		const merged = mergeConfigs(global, project);

		// Project config should override global
		expect(merged.mcpServers.github.env?.GITHUB_TOKEN).toBe('project_token');
		expect(merged.sources.github).toBe('project');
	});

	it('should keep global servers not defined in project', () => {
		const global: McpConfig = {
			mcpServers: {
				github: {
					command: 'npx',
					args: ['-y', '@modelcontextprotocol/server-github'],
				},
				filesystem: {
					command: 'npx',
					args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
				},
			},
		};

		const project: McpConfig = {
			mcpServers: {
				github: {
					command: 'custom-github',
					args: ['custom-args'],
				},
			},
		};

		const merged = mergeConfigs(global, project);

		// GitHub overridden by project
		expect(merged.mcpServers.github.command).toBe('custom-github');
		expect(merged.sources.github).toBe('project');

		// Filesystem kept from global
		expect(merged.mcpServers.filesystem.command).toBe('npx');
		expect(merged.sources.filesystem).toBe('global');
	});

	it('should add project-only servers alongside global servers', () => {
		const global: McpConfig = {
			mcpServers: {
				global1: {command: 'cmd1', args: []},
			},
		};

		const project: McpConfig = {
			mcpServers: {
				project1: {command: 'cmd2', args: []},
			},
		};

		const merged = mergeConfigs(global, project);

		expect(Object.keys(merged.mcpServers)).toHaveLength(2);
		expect(merged.mcpServers.global1).toBeDefined();
		expect(merged.mcpServers.project1).toBeDefined();
		expect(merged.sources.global1).toBe('global');
		expect(merged.sources.project1).toBe('project');
	});
});
