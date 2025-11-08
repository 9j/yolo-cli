/**
 * MCP Configuration Loader
 *
 * Discovers, loads, validates, and merges MCP server configuration files
 * from global and project-specific locations.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {createRequire} from 'node:module';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type {McpConfig, MergedConfig} from '../types/mcp.js';

const require = createRequire(import.meta.url);
const schema = require('../schemas/mcp-config-schema.json');

const ajv = new Ajv({allErrors: true});
addFormats(ajv);
const validate = ajv.compile(schema);

/**
 * Configuration Loader Interface
 */
export interface IMcpConfigLoader {
	discoverConfigs(): Promise<{
		global: McpConfig | null;
		project: McpConfig | null;
	}>;
	mergeConfigs(
		global: McpConfig | null,
		project: McpConfig | null,
	): MergedConfig;
	validateConfig(config: McpConfig): {valid: boolean; errors: string[]};
}

/**
 * Get platform-specific global configuration path
 */
function getGlobalConfigPath(): string {
	const homeDir = os.homedir();

	if (process.platform === 'win32') {
		// Windows: ~/.yolo-cli/mcp.json
		return path.join(homeDir, '.yolo-cli', 'mcp.json');
	}

	// Unix/macOS: ~/.config/yolo-cli/mcp.json
	return path.join(homeDir, '.config', 'yolo-cli', 'mcp.json');
}

/**
 * Get project-specific configuration path
 */
function getProjectConfigPath(workingDir?: string): string {
	const cwd = workingDir ?? process.cwd();
	return path.join(cwd, '.yolo', 'mcp.json');
}

/**
 * Load and parse JSON configuration file
 */
async function loadConfigFile(
	filePath: string,
): Promise<McpConfig | null> {
	try {
		const content = await fs.readFile(filePath, 'utf-8');
		const config = JSON.parse(content) as McpConfig;
		return config;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			// File doesn't exist - this is fine
			return null;
		}

		// Other errors (JSON parse error, permission denied, etc.) - log warning
		console.warn(
			`Warning: Failed to load MCP config from ${filePath}: ${(error as Error).message}`,
		);
		return null;
	}
}

/**
 * Discover and load MCP configurations from standard locations
 */
export async function discoverConfigs(workingDir?: string): Promise<{
	global: McpConfig | null;
	project: McpConfig | null;
}> {
	const globalPath = getGlobalConfigPath();
	const projectPath = getProjectConfigPath(workingDir);

	const [global, project] = await Promise.all([
		loadConfigFile(globalPath),
		loadConfigFile(projectPath),
	]);

	return {global, project};
}

/**
 * Merge global and project configurations
 *
 * Project configuration takes precedence for duplicate server names
 */
export function mergeConfigs(
	global: McpConfig | null,
	project: McpConfig | null,
): MergedConfig {
	const merged: MergedConfig = {
		mcpServers: {},
		sources: {},
	};

	// Add all servers from global config
	if (global) {
		for (const [name, config] of Object.entries(global.mcpServers)) {
			merged.mcpServers[name] = config;
			merged.sources[name] = 'global';
		}
	}

	// Add/override with servers from project config
	if (project) {
		for (const [name, config] of Object.entries(project.mcpServers)) {
			if (merged.mcpServers[name]) {
				console.info(
					`MCP server '${name}' defined in both global and project configs - using project configuration`,
				);
			}

			merged.mcpServers[name] = config;
			merged.sources[name] = 'project';
		}
	}

	return merged;
}

/**
 * Validate configuration against JSON schema
 */
export function validateConfig(config: McpConfig): {
	valid: boolean;
	errors: string[];
} {
	const valid = validate(config);
	const errors: string[] = [];

	if (!valid && validate.errors) {
		for (const error of validate.errors) {
			const path = (error as any).instancePath || 'root';
			errors.push(`${path}: ${error.message}`);
		}
	}

	return {valid: Boolean(valid), errors};
}

/**
 * MCP Configuration Loader implementation
 */
export class McpConfigLoader implements IMcpConfigLoader {
	constructor(private readonly workingDir?: string) {}

	async discoverConfigs(): Promise<{
		global: McpConfig | null;
		project: McpConfig | null;
	}> {
		return discoverConfigs(this.workingDir);
	}

	mergeConfigs(
		global: McpConfig | null,
		project: McpConfig | null,
	): MergedConfig {
		return mergeConfigs(global, project);
	}

	validateConfig(config: McpConfig): {valid: boolean; errors: string[]} {
		return validateConfig(config);
	}
}
