/**
 * Bash tool - Execute shell commands
 */

import {exec} from 'node:child_process';
import {promisify} from 'node:util';
import type {Tool, ToolExecutionResult} from '../types/tools.js';
import type {ToolContext} from '../services/tools.js';

const execAsync = promisify(exec);
const DEFAULT_TIMEOUT = 60000; // 60 seconds
const MAX_TIMEOUT = 300000; // 5 minutes

interface BashArgs {
	command: string;
	timeout?: number;
	_context?: ToolContext;
}

function validateArgs(args: Record<string, unknown>): BashArgs {
	if (!args.command || typeof args.command !== 'string') {
		throw new Error('command is required and must be a string');
	}

	const timeout =
		args.timeout && typeof args.timeout === 'number'
			? Math.min(args.timeout * 1000, MAX_TIMEOUT)
			: DEFAULT_TIMEOUT;

	return {
		command: args.command,
		timeout,
		_context: args._context as ToolContext | undefined,
	};
}

async function executeBash(
	args: Record<string, unknown>,
): Promise<ToolExecutionResult> {
	try {
		const {command, timeout, _context} = validateArgs(args);

		// Request approval if callback is available
		if (_context?.requestApproval) {
			const approved = await _context.requestApproval('bash', command);
			if (!approved) {
				return {
					success: false,
					output: '',
					error: 'Operation rejected by user',
				};
			}
		}

		// Use context working directory or fall back to process.cwd()
		const workingDir = _context?.workingDirectory ?? process.cwd();

		// Execute command with timeout
		const {stdout, stderr} = await execAsync(command, {
			timeout,
			maxBuffer: 1024 * 1024, // 1MB
			cwd: workingDir,
		});

		const output = (stdout + stderr).trim();

		return {
			success: true,
			output: output || 'Command executed successfully (no output)',
		};
	} catch (error: unknown) {
		if (
			error &&
			typeof error === 'object' &&
			'killed' in error &&
			error.killed
		) {
			return {
				success: false,
				output: '',
				error: `Command killed by timeout (${DEFAULT_TIMEOUT / 1000}s)`,
			};
		}

		if (error && typeof error === 'object' && 'code' in error) {
			const execError = error as {code: number; stdout: string; stderr: string};
			return {
				success: false,
				output: (execError.stdout + execError.stderr).trim(),
				error: `Command failed with exit code ${execError.code}`,
			};
		}

		return {
			success: false,
			output: '',
			error:
				error instanceof Error
					? `Failed to execute command: ${error.message}`
					: 'Failed to execute command',
		};
	}
}

export const bashTool: Tool = {
	definition: {
		type: 'function',
		function: {
			name: 'bash',
			description: `Execute a bash command and return stdout/stderr.
Commands run in the current working directory.
Default timeout: 60s, maximum: 5 minutes.
Use for: listing files (ls), searching (grep), git operations, etc.
WARNING: Commands are executed directly - use with caution.`,
			parameters: {
				type: 'object',
				properties: {
					command: {
						type: 'string',
						description: 'The bash command to execute',
					},
					timeout: {
						type: 'number',
						description:
							'Timeout in seconds (default: 60, max: 300). If command takes longer, it will be killed.',
					},
				},
				required: ['command'],
			},
		},
	},
	executor: executeBash,
};
