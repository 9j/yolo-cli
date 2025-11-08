/**
 * StrReplaceFile tool - Surgical string replacement in files
 * Enables precise edits without rewriting entire files
 */

import * as fs from 'node:fs/promises';
import type {Tool, ToolExecutionResult} from '../types/tools.js';
import type {ToolContext} from '../services/tools.js';
import {validatePathIsFile} from '../utils/path-validator.js';

interface StrReplaceFileArgs {
	path: string;
	old_text: string;
	new_text: string;
	replace_all: boolean;
	_context?: ToolContext;
}

function validateArgs(args: Record<string, unknown>): StrReplaceFileArgs {
	// Validate required parameters
	if (!args.path || typeof args.path !== 'string') {
		throw new Error('path is required and must be a string');
	}

	if (args.old_text === undefined || typeof args.old_text !== 'string') {
		throw new Error('old_text is required and must be a string');
	}

	if (args.new_text === undefined || typeof args.new_text !== 'string') {
		throw new Error('new_text is required and must be a string');
	}

	return {
		path: args.path,
		old_text: args.old_text,
		new_text: args.new_text,
		replace_all:
			args.replace_all !== undefined && typeof args.replace_all === 'boolean'
				? args.replace_all
				: false, // Default to false (replace only first occurrence)
		_context: args._context as ToolContext | undefined,
	};
}

async function executeStrReplaceFile(
	args: Record<string, unknown>,
): Promise<ToolExecutionResult> {
	try {
		const {path: filePath, old_text, new_text, replace_all, _context} =
			validateArgs(args);

		// Get working directory from context
		const workingDir = _context?.workingDirectory ?? process.cwd();

		// Validate path security (absolute, within working directory, exists, is file)
		const validation = await validatePathIsFile(filePath, workingDir);
		if (!validation.isValid) {
			return {
				success: false,
				output: '',
				error: validation.error,
			};
		}

		// Request approval if callback is available
		if (_context?.requestApproval) {
			const approvalDetails = replace_all
				? `Replace all occurrences of "${old_text.slice(0, 50)}${old_text.length > 50 ? '...' : ''}" in ${filePath}`
				: `Replace first occurrence of "${old_text.slice(0, 50)}${old_text.length > 50 ? '...' : ''}" in ${filePath}`;

			const approved = await _context.requestApproval(
				'str_replace_file',
				approvalDetails,
			);

			if (!approved) {
				return {
					success: false,
					output: '',
					error: 'Operation rejected by user',
				};
			}
		}

		// Read file content
		const originalContent = await fs.readFile(filePath, 'utf-8');

		// Check if old_text exists
		if (!originalContent.includes(old_text)) {
			return {
				success: false,
				output: '',
				error: `The text "${old_text}" was not found in ${filePath}`,
			};
		}

		// Perform replacement
		let newContent: string;
		let replacementCount: number;

		if (replace_all) {
			// Replace all occurrences
			const parts = originalContent.split(old_text);
			replacementCount = parts.length - 1;
			newContent = parts.join(new_text);
		} else {
			// Replace only first occurrence
			const index = originalContent.indexOf(old_text);
			newContent =
				originalContent.slice(0, index) +
				new_text +
				originalContent.slice(index + old_text.length);
			replacementCount = 1;
		}

		// Write back to file (atomic-ish: direct overwrite)
		// For full atomicity, would use temp file + rename like in saveTodos
		await fs.writeFile(filePath, newContent, 'utf-8');

		// Return success message with count
		const plural = replacementCount === 1 ? '' : 's';
		return {
			success: true,
			output: `Successfully made ${replacementCount} replacement${plural} in ${filePath}`,
		};
	} catch (error) {
		// Handle validation errors
		if (error instanceof Error && error.message.includes('required')) {
			return {
				success: false,
				output: '',
				error: error.message,
			};
		}

		// Handle other errors
		return {
			success: false,
			output: '',
			error:
				error instanceof Error
					? `Failed to replace text in file: ${error.message}`
					: 'Failed to replace text in file',
		};
	}
}

export const strReplaceFileTool: Tool = {
	definition: {
		type: 'function',
		function: {
			name: 'str_replace_file',
			description: `Replace text in a file with surgical precision. Use this for small edits instead of rewriting entire files.

Security: Only works within the current working directory. Requires user approval unless auto-approve enabled.

Behavior:
- replace_all=false: Replaces only the FIRST occurrence of old_text
- replace_all=true: Replaces ALL occurrences of old_text
- If old_text not found: Returns error
- Preserves file encoding (UTF-8) and formatting

Example:
  old_text: "function foo()"
  new_text: "function bar()"
  → Changes function name without rewriting entire file`,
			parameters: {
				type: 'object',
				properties: {
					path: {
						type: 'string',
						description:
							'Absolute path to the file to edit (must be within working directory)',
					},
					old_text: {
						type: 'string',
						description:
							'Exact text to find and replace. Can be multi-line. Case-sensitive literal match (not regex).',
					},
					new_text: {
						type: 'string',
						description:
							'Text to replace old_text with. Can be multi-line. Use empty string "" to delete old_text.',
					},
					replace_all: {
						type: 'boolean',
						description:
							'If true, replace all occurrences. If false (default), replace only first occurrence.',
					},
				},
				required: ['path', 'old_text', 'new_text'],
			},
		},
	},
	executor: executeStrReplaceFile,
};
