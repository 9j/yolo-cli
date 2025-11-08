/**
 * ReadFile tool - Read file contents with line numbers
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {Tool, ToolExecutionResult} from '../types/tools.js';
import type {ToolContext} from '../services/tools.js';
import {validatePathIsFile} from '../utils/path-validator.js';

const MAX_LINES = 1000;
const MAX_LINE_LENGTH = 2000;

interface ReadFileArgs {
	path: string;
	start_line?: number;
	end_line?: number;
	_context?: ToolContext;
}

function validateArgs(args: Record<string, unknown>): ReadFileArgs {
	if (!args.path || typeof args.path !== 'string') {
		throw new Error('path is required and must be a string');
	}

	return {
		path: args.path,
		start_line:
			args.start_line && typeof args.start_line === 'number'
				? args.start_line
				: 1,
		end_line:
			args.end_line && typeof args.end_line === 'number'
				? args.end_line
				: undefined,
		_context: args._context as ToolContext | undefined,
	};
}

async function executeReadFile(
	args: Record<string, unknown>,
): Promise<ToolExecutionResult> {
	try {
		const {path: filePath, start_line = 1, end_line, _context} = validateArgs(args);

		// Validate path security (absolute, within working directory, exists, is file)
		const workDir = _context?.workingDirectory ?? process.cwd();
		const validation = await validatePathIsFile(filePath, workDir);
		if (!validation.isValid) {
			return {
				success: false,
				output: '',
				error: validation.error,
			};
		}

		// Read file
		const content = await fs.readFile(filePath, 'utf-8');
		const lines = content.split('\n');

		// Calculate range
		const startIdx = Math.max(0, start_line - 1);
		const endIdx = end_line
			? Math.min(lines.length, end_line)
			: Math.min(lines.length, startIdx + MAX_LINES);

		// Slice and format with line numbers
		const selectedLines = lines.slice(startIdx, endIdx);
		const truncatedLines: string[] = [];
		const truncatedLineNumbers: number[] = [];

		selectedLines.forEach((line, idx) => {
			const lineNumber = startIdx + idx + 1;
			let displayLine = line;

			if (line.length > MAX_LINE_LENGTH) {
				displayLine = line.slice(0, MAX_LINE_LENGTH) + '...';
				truncatedLineNumbers.push(lineNumber);
			}

			// Format like `cat -n`: right-aligned 6-digit line number + tab + content
			truncatedLines.push(`${lineNumber.toString().padStart(6)}→${displayLine}`);
		});

		let message = `${selectedLines.length} lines read from file starting from line ${start_line ?? 1}.`;
		if (endIdx >= lines.length) {
			message += ' End of file reached.';
		} else if (selectedLines.length >= MAX_LINES) {
			message += ` Max ${MAX_LINES} lines reached.`;
		}

		if (truncatedLineNumbers.length > 0) {
			message += ` Lines ${truncatedLineNumbers.join(', ')} were truncated.`;
		}

		return {
			success: true,
			output: truncatedLines.join('\n') + '\n' + message,
		};
	} catch (error) {
		return {
			success: false,
			output: '',
			error:
				error instanceof Error
					? `Failed to read file: ${error.message}`
					: 'Failed to read file',
		};
	}
}

export const readFileTool: Tool = {
	definition: {
		type: 'function',
		function: {
			name: 'read_file',
			description: `Read content from a file with line numbers (cat -n format).
Use start_line and end_line to read specific sections.
Maximum ${MAX_LINES} lines per call.
Lines longer than ${MAX_LINE_LENGTH} characters will be truncated.`,
			parameters: {
				type: 'object',
				properties: {
					path: {
						type: 'string',
						description: 'Absolute path to the file to read',
					},
					start_line: {
						type: 'number',
						description:
							'Starting line number (1-based, default: 1). Use when file is too large.',
					},
					end_line: {
						type: 'number',
						description:
							'Ending line number (1-based, optional). If not provided, reads up to MAX_LINES from start_line.',
					},
				},
				required: ['path'],
			},
		},
	},
	executor: executeReadFile,
};
