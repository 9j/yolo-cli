/**
 * Grep tool - Search file contents with regex
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {Tool, ToolExecutionResult} from '../types/tools.js';

interface GrepArgs {
	pattern: string;
	path: string;
	context_lines?: number;
}

function validateArgs(args: Record<string, unknown>): GrepArgs {
	if (!args.pattern || typeof args.pattern !== 'string') {
		throw new Error('pattern is required and must be a string');
	}

	if (!args.path || typeof args.path !== 'string') {
		throw new Error('path is required and must be a string');
	}

	return {
		pattern: args.pattern,
		path: args.path,
		context_lines:
			args.context_lines && typeof args.context_lines === 'number'
				? args.context_lines
				: 0,
	};
}

async function executeGrep(
	args: Record<string, unknown>,
): Promise<ToolExecutionResult> {
	try {
		const {pattern, path: searchPath, context_lines} = validateArgs(args);

		// Check if path is absolute
		if (!path.isAbsolute(searchPath)) {
			return {
				success: false,
				output: '',
				error: `${searchPath} is not an absolute path. You must provide an absolute path.`,
			};
		}

		// Check if file exists
		try {
			const stats = await fs.stat(searchPath);
			if (!stats.isFile()) {
				return {
					success: false,
					output: '',
					error: `${searchPath} is not a file.`,
				};
			}
		} catch {
			return {
				success: false,
				output: '',
				error: `${searchPath} does not exist.`,
			};
		}

		// Read file
		const content = await fs.readFile(searchPath, 'utf-8');
		const lines = content.split('\n');

		// Create regex (case-insensitive by default)
		const regex = new RegExp(pattern, 'gi');

		// Find matching lines
		const matches: Array<{lineNum: number; line: string; contextBefore: string[]; contextAfter: string[]}> = [];

		lines.forEach((line, idx) => {
			if (regex.test(line)) {
				const lineNum = idx + 1;
				const contextBefore = context_lines
					? lines.slice(Math.max(0, idx - context_lines), idx)
					: [];
				const contextAfter = context_lines
					? lines.slice(idx + 1, idx + 1 + context_lines)
					: [];

				matches.push({
					lineNum,
					line,
					contextBefore,
					contextAfter,
				});
			}

			// Reset regex lastIndex
			regex.lastIndex = 0;
		});

		if (matches.length === 0) {
			return {
				success: true,
				output: `No matches found for pattern "${pattern}" in ${searchPath}`,
			};
		}

		// Format output
		const formattedMatches = matches.map(match => {
			const parts: string[] = [];

			// Context before
			if (match.contextBefore.length > 0) {
				match.contextBefore.forEach((line, idx) => {
					const lineNum = match.lineNum - match.contextBefore.length + idx;
					parts.push(`${lineNum.toString().padStart(6)}-${line}`);
				});
			}

			// Matching line
			parts.push(`${match.lineNum.toString().padStart(6)}:${match.line}`);

			// Context after
			if (match.contextAfter.length > 0) {
				match.contextAfter.forEach((line, idx) => {
					const lineNum = match.lineNum + idx + 1;
					parts.push(`${lineNum.toString().padStart(6)}-${line}`);
				});
			}

			return parts.join('\n');
		});

		const output =
			formattedMatches.join('\n--\n') +
			`\n\n${matches.length} matches found in ${searchPath}`;

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
					? `Failed to search file: ${error.message}`
					: 'Failed to search file',
		};
	}
}

export const grepTool: Tool = {
	definition: {
		type: 'function',
		function: {
			name: 'grep',
			description: `Search for a pattern (regex) in a file and return matching lines with line numbers.
Supports regular expressions (case-insensitive by default).
Can include context lines before/after matches.
Output format: linenum:content (: for match, - for context)`,
			parameters: {
				type: 'object',
				properties: {
					pattern: {
						type: 'string',
						description:
							'Regular expression pattern to search for (case-insensitive)',
					},
					path: {
						type: 'string',
						description: 'Absolute path to the file to search',
					},
					context_lines: {
						type: 'number',
						description:
							'Number of context lines to show before/after each match (default: 0)',
					},
				},
				required: ['pattern', 'path'],
			},
		},
	},
	executor: executeGrep,
};
