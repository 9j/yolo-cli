/**
 * WriteFile tool - Write content to files
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {Tool, ToolExecutionResult} from '../types/tools.js';
import type {ToolContext} from '../services/tools.js';
import {validatePath} from '../utils/path-validator.js';

interface WriteFileArgs {
	path: string;
	content: string;
	_context?: ToolContext;
}

function validateArgs(args: Record<string, unknown>): WriteFileArgs {
	if (!args.path || typeof args.path !== 'string') {
		throw new Error('path is required and must be a string');
	}

	if (!args.content || typeof args.content !== 'string') {
		throw new Error('content is required and must be a string');
	}

	return {
		path: args.path,
		content: args.content,
		_context: args._context as ToolContext | undefined,
	};
}

async function executeWriteFile(
	args: Record<string, unknown>,
): Promise<ToolExecutionResult> {
	try {
		const {path: filePath, content, _context} = validateArgs(args);

		// Request approval if callback is available
		if (_context?.requestApproval) {
			const approved = await _context.requestApproval('write_file', filePath);
			if (!approved) {
				return {
					success: false,
					output: '',
					error: 'Operation rejected by user',
				};
			}
		}

		// Validate path security (absolute, within working directory)
		const workDir = _context?.workingDirectory ?? process.cwd();
		const validation = validatePath(filePath, workDir);
		if (!validation.isValid) {
			return {
				success: false,
				output: '',
				error: validation.error,
			};
		}

		const resolvedPath = path.resolve(filePath);

		// Check if parent directory exists
		const parentDir = path.dirname(resolvedPath);
		try {
			await fs.access(parentDir);
		} catch {
			return {
				success: false,
				output: '',
				error: `Parent directory ${parentDir} does not exist.`,
			};
		}

		// Write file
		await fs.writeFile(resolvedPath, content, 'utf-8');

		// Get file size
		const stats = await fs.stat(resolvedPath);

		return {
			success: true,
			output: `File successfully written. Size: ${stats.size} bytes.`,
		};
	} catch (error) {
		return {
			success: false,
			output: '',
			error:
				error instanceof Error
					? `Failed to write file: ${error.message}`
					: 'Failed to write file',
		};
	}
}

export const writeFileTool: Tool = {
	definition: {
		type: 'function',
		function: {
			name: 'write_file',
			description: `Write content to a file (creates new file or overwrites existing).
Only works within the current working directory for security.
Parent directory must exist.`,
			parameters: {
				type: 'object',
				properties: {
					path: {
						type: 'string',
						description:
							'Absolute path to the file to write (must be within working directory)',
					},
					content: {
						type: 'string',
						description: 'Content to write to the file',
					},
				},
				required: ['path', 'content'],
			},
		},
	},
	executor: executeWriteFile,
};
