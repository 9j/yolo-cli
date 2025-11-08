/**
 * Glob tool - Find files by pattern
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {Tool, ToolExecutionResult} from '../types/tools.js';
import type {ToolContext} from '../services/tools.js';

interface GlobArgs {
	pattern: string;
	directory?: string;
	_context?: ToolContext;
}

function validateArgs(args: Record<string, unknown>): GlobArgs {
	if (!args.pattern || typeof args.pattern !== 'string') {
		throw new Error('pattern is required and must be a string');
	}

	const context = args._context as ToolContext | undefined;
	const defaultDir = context?.workingDirectory ?? process.cwd();

	return {
		pattern: args.pattern,
		directory:
			args.directory && typeof args.directory === 'string'
				? args.directory
				: defaultDir,
		_context: context,
	};
}

async function findFiles(
	dir: string,
	pattern: string,
	results: string[] = [],
): Promise<string[]> {
	const entries = await fs.readdir(dir, {withFileTypes: true});

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);

		// Skip node_modules, .git, etc.
		if (
			entry.name === 'node_modules' ||
			entry.name === '.git' ||
			entry.name === 'dist' ||
			entry.name === '.yolo'
		) {
			continue;
		}

		if (entry.isDirectory()) {
			await findFiles(fullPath, pattern, results);
		} else if (entry.isFile()) {
			// Simple pattern matching (supports * wildcard)
			const regex = new RegExp(
				'^' + pattern.replaceAll('*', '.*').replaceAll('?', '.') + '$',
			);
			if (regex.test(entry.name) || regex.test(fullPath)) {
				results.push(fullPath);
			}
		}
	}

	return results;
}

async function executeGlob(
	args: Record<string, unknown>,
): Promise<ToolExecutionResult> {
	try {
		const {pattern, directory, _context} = validateArgs(args);
		const defaultDir = _context?.workingDirectory ?? process.cwd();
		const actualDir = directory ?? defaultDir;

		// Security: Ensure directory is absolute and within working directory
		const workDir = _context?.workingDirectory ?? process.cwd();
		const searchDir = path.isAbsolute(actualDir)
			? actualDir
			: path.join(workDir, actualDir);
		const resolvedSearchDir = path.resolve(searchDir);
		const resolvedWorkDir = path.resolve(workDir);

		if (!resolvedSearchDir.startsWith(resolvedWorkDir)) {
			return {
				success: false,
				output: '',
				error:
					'Search directory must be within the current working directory.',
			};
		}

		// Find matching files
		const matches = await findFiles(resolvedSearchDir, pattern);

		if (matches.length === 0) {
			return {
				success: true,
				output: `No files matching pattern "${pattern}" found in ${resolvedSearchDir}`,
			};
		}

		// Sort and format results
		matches.sort();
		const output = matches.join('\n') + `\n\n${matches.length} files found`;

		return {
			success: true,
			output,
		};
	} catch (error) {
		return {
			success: false,
			output: '',
			error:
				error instanceof Error
					? `Failed to search files: ${error.message}`
					: 'Failed to search files',
		};
	}
}

export const globTool: Tool = {
	definition: {
		type: 'function',
		function: {
			name: 'glob',
			description: `Find files matching a pattern (supports * and ? wildcards).
Searches recursively from the directory.
Skips node_modules, .git, dist, .yolo directories.
Example patterns: "*.ts", "test*.js", "src/**/*.tsx"`,
			parameters: {
				type: 'object',
				properties: {
					pattern: {
						type: 'string',
						description:
							'File pattern to match (supports * and ?). Can be filename or path pattern.',
					},
					directory: {
						type: 'string',
						description:
							'Directory to search in (absolute or relative, default: current working directory)',
					},
				},
				required: ['pattern'],
			},
		},
	},
	executor: executeGlob,
};
