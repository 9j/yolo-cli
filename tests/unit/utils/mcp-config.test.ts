/**
 * Unit Tests: MCP Configuration Loader
 */

import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
	discoverConfigs,
	mergeConfigs,
	validateConfig,
	McpConfigLoader,
} from '../../../src/utils/mcp-config.js';
import type {McpConfig} from '../../../src/types/mcp.js';

describe('MCP Configuration Loader', () => {
	let tempDir: string;

	beforeEach(async () => {
		// Create temp directory for test configs
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-config-test-'));
	});

	afterEach(async () => {
		// Clean up temp directory
		await fs.rm(tempDir, {recursive: true, force: true});
	});

	describe('discoverConfigs', () => {
		it('should return null for both configs when files do not exist', async () => {
			const result = await discoverConfigs(tempDir);
			expect(result.global).toBeNull();
			expect(result.project).toBeNull();
		});

		it('should load global config when it exists', async () => {
			// Create global config
			const globalConfig: McpConfig = {
				mcpServers: {
					github: {
						command: 'npx',
						args: ['-y', '@modelcontextprotocol/server-github'],
					},
				},
			};

			// Write to home directory .config/yolo-cli/mcp.json
			const homeDir = os.homedir();
			const configDir = path.join(homeDir, '.config', 'yolo-cli');
			await fs.mkdir(configDir, {recursive: true});
			const globalPath = path.join(configDir, 'mcp.json');
			await fs.writeFile(globalPath, JSON.stringify(globalConfig), 'utf-8');

			try {
				const result = await discoverConfigs(tempDir);
				expect(result.global).toEqual(globalConfig);
				expect(result.project).toBeNull();
			} finally {
				// Clean up
				await fs.rm(globalPath, {force: true});
			}
		});

		it('should load project config when it exists', async () => {
			// Create project config
			const projectConfig: McpConfig = {
				mcpServers: {
					filesystem: {
						command: 'npx',
						args: [
							'-y',
							'@modelcontextprotocol/server-filesystem',
							tempDir,
						],
					},
				},
			};

			// Write to .yolo/mcp.json in temp dir
			const yoloDir = path.join(tempDir, '.yolo');
			await fs.mkdir(yoloDir, {recursive: true});
			const projectPath = path.join(yoloDir, 'mcp.json');
			await fs.writeFile(projectPath, JSON.stringify(projectConfig), 'utf-8');

			const result = await discoverConfigs(tempDir);
			expect(result.project).toEqual(projectConfig);
		});

		it('should return null and warn on invalid JSON', async () => {
			// Create invalid JSON file
			const yoloDir = path.join(tempDir, '.yolo');
			await fs.mkdir(yoloDir, {recursive: true});
			const projectPath = path.join(yoloDir, 'mcp.json');
			await fs.writeFile(projectPath, 'invalid json{', 'utf-8');

			const result = await discoverConfigs(tempDir);
			expect(result.project).toBeNull();
		});
	});

	describe('mergeConfigs', () => {
		it('should return empty config when both are null', () => {
			const result = mergeConfigs(null, null);
			expect(result.mcpServers).toEqual({});
			expect(result.sources).toEqual({});
		});

		it('should use global config when project is null', () => {
			const global: McpConfig = {
				mcpServers: {
					github: {command: 'npx', args: ['github']},
				},
			};

			const result = mergeConfigs(global, null);
			expect(result.mcpServers).toHaveProperty('github');
			expect(result.sources.github).toBe('global');
		});

		it('should use project config when global is null', () => {
			const project: McpConfig = {
				mcpServers: {
					filesystem: {command: 'npx', args: ['filesystem']},
				},
			};

			const result = mergeConfigs(null, project);
			expect(result.mcpServers).toHaveProperty('filesystem');
			expect(result.sources.filesystem).toBe('project');
		});

		it('should merge configs with project taking precedence', () => {
			const global: McpConfig = {
				mcpServers: {
					github: {command: 'npx', args: ['github-global']},
					serena: {command: 'uvx', args: ['serena-global']},
				},
			};

			const project: McpConfig = {
				mcpServers: {
					serena: {command: 'uvx', args: ['serena-project']},
					filesystem: {command: 'npx', args: ['filesystem']},
				},
			};

			const result = mergeConfigs(global, project);

			// Should have all three servers
			expect(Object.keys(result.mcpServers)).toHaveLength(3);

			// Project overrides global for 'serena'
			expect(result.mcpServers.serena.args).toEqual(['serena-project']);
			expect(result.sources.serena).toBe('project');

			// Global still present
			expect(result.mcpServers.github).toBeDefined();
			expect(result.sources.github).toBe('global');

			// Project-only server
			expect(result.mcpServers.filesystem).toBeDefined();
			expect(result.sources.filesystem).toBe('project');
		});
	});

	describe('validateConfig', () => {
		it('should validate valid config', () => {
			const validConfig: McpConfig = {
				mcpServers: {
					github: {
						command: 'npx',
						args: ['-y', '@modelcontextprotocol/server-github'],
					},
				},
			};

			const result = validateConfig(validConfig);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should reject config without mcpServers', () => {
			const invalidConfig = {} as McpConfig;

			const result = validateConfig(invalidConfig);
			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});

		it('should reject server without command', () => {
			const invalidConfig: McpConfig = {
				mcpServers: {
					github: {
						// Missing command
						args: ['-y', '@modelcontextprotocol/server-github'],
					} as any,
				},
			};

			const result = validateConfig(invalidConfig);
			expect(result.valid).toBe(false);
		});

		it('should accept config with env variables', () => {
			const validConfig: McpConfig = {
				mcpServers: {
					github: {
						command: 'npx',
						args: ['-y', '@modelcontextprotocol/server-github'],
						env: {
							GITHUB_TOKEN: 'ghp_test',
						},
					},
				},
			};

			const result = validateConfig(validConfig);
			expect(result.valid).toBe(true);
		});
	});

	describe('McpConfigLoader', () => {
		it('should implement IMcpConfigLoader interface', async () => {
			const loader = new McpConfigLoader(tempDir);

			expect(loader.discoverConfigs).toBeDefined();
			expect(loader.mergeConfigs).toBeDefined();
			expect(loader.validateConfig).toBeDefined();

			const result = await loader.discoverConfigs();
			expect(result).toHaveProperty('global');
			expect(result).toHaveProperty('project');
		});
	});
});
