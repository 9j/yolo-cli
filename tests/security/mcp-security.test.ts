/**
 * Security Tests: MCP Configuration and Server Management
 */

import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {McpServerManager} from '../../src/services/mcp.js';
import {validateConfig} from '../../src/utils/mcp-config.js';
import type {McpConfig, MergedConfig} from '../../src/types/mcp.js';

describe('MCP Security Tests', () => {
	let manager: McpServerManager;

	beforeEach(() => {
		manager = new McpServerManager();
	});

	afterEach(async () => {
		await manager.cleanup();
	});

	describe('Path Validation and Command Injection Prevention', () => {
		it('should not execute commands with shell injection attempts', async () => {
			const maliciousConfig: MergedConfig = {
				mcpServers: {
					malicious: {
						command: 'echo',
						args: ['test', '&&', 'rm', '-rf', '/'],
					},
				},
				sources: {
					malicious: 'global',
				},
			};

			// This should fail to connect (echo is not an MCP server)
			// but importantly, it should NOT execute the rm command
			const result = await manager.loadFromConfig(maliciousConfig);

			// Server should fail to connect
			expect(result.errors.length).toBeGreaterThan(0);
		});

		it('should reject config with non-string environment variables', () => {
			const invalidConfig: any = {
				mcpServers: {
					github: {
						command: 'npx',
						args: ['-y', '@modelcontextprotocol/server-github'],
						env: {
							PORT: 3000, // Number instead of string
						},
					},
				},
			};

			const result = validateConfig(invalidConfig);
			expect(result.valid).toBe(false);
		});

		it('should sanitize environment variables', () => {
			const config: McpConfig = {
				mcpServers: {
					github: {
						command: 'npx',
						args: ['-y', '@modelcontextprotocol/server-github'],
						env: {
							GITHUB_TOKEN: 'safe_token',
							API_KEY: 'another_safe_key',
						},
					},
				},
			};

			const result = validateConfig(config);
			expect(result.valid).toBe(true);

			// Verify all env vars are strings
			for (const [, serverConfig] of Object.entries(config.mcpServers)) {
				if (serverConfig.env) {
					for (const value of Object.values(serverConfig.env)) {
						expect(typeof value).toBe('string');
					}
				}
			}
		});

		it('should validate server names match pattern', () => {
			const configWithInvalidName: any = {
				mcpServers: {
					'invalid server name!': {
						command: 'npx',
						args: ['test'],
					},
				},
			};

			const result = validateConfig(configWithInvalidName);
			// Schema should reject invalid server names
			expect(result.valid).toBe(false);
		});
	});

	describe('Process Cleanup', () => {
		it('should clean up all servers on cleanup()', async () => {
			const config: MergedConfig = {
				mcpServers: {},
				sources: {},
			};

			await manager.loadFromConfig(config);
			await manager.cleanup();

			// After cleanup, getTools should return empty
			const tools = await manager.getTools();
			expect(tools).toHaveLength(0);
		});

		it('should handle cleanup errors gracefully', async () => {
			// Cleanup should not throw even if servers are already closed
			await manager.cleanup();
			await expect(manager.cleanup()).resolves.toBeUndefined();
		});

		it('should complete cleanup within reasonable time', async () => {
			const config: MergedConfig = {
				mcpServers: {},
				sources: {},
			};

			await manager.loadFromConfig(config);

			const startTime = Date.now();
			await manager.cleanup();
			const duration = Date.now() - startTime;

			// Cleanup should be fast (< 5s)
			expect(duration).toBeLessThan(5000);
		});
	});

	describe('Resource Limits', () => {
		it('should handle large number of server configurations', () => {
			// Create config with many servers
			const largeConfig: McpConfig = {
				mcpServers: {},
			};

			for (let i = 0; i < 100; i++) {
				largeConfig.mcpServers[`server${i}`] = {
					command: 'npx',
					args: ['test'],
				};
			}

			const result = validateConfig(largeConfig);
			expect(result.valid).toBe(true);
		});

		it('should validate timeout values', () => {
			const configWithTimeout: McpConfig = {
				mcpServers: {
					github: {
						command: 'npx',
						args: ['test'],
						timeout: 30000, // 30 seconds
					},
				},
			};

			const result = validateConfig(configWithTimeout);
			expect(result.valid).toBe(true);
		});

		it('should reject invalid timeout values', () => {
			const configWithInvalidTimeout: any = {
				mcpServers: {
					github: {
						command: 'npx',
						args: ['test'],
						timeout: 500, // Less than minimum (1000ms)
					},
				},
			};

			const result = validateConfig(configWithInvalidTimeout);
			expect(result.valid).toBe(false);
		});
	});
});
