/**
 * Think tool - AI reasoning and planning without state modification
 * Enables transparent thought process by logging reasoning in conversation
 */

import type {Tool, ToolExecutionResult} from '../types/tools.js';

interface ThinkArgs {
	thought: string;
}

function validateArgs(args: Record<string, unknown>): ThinkArgs {
	if (args.thought === undefined || typeof args.thought !== 'string') {
		throw new Error('thought is required and must be a string');
	}

	return {
		thought: args.thought,
	};
}

async function executeThink(
	args: Record<string, unknown>,
): Promise<ToolExecutionResult> {
	try {
		const {thought} = validateArgs(args);

		// Simply return the thought - no state modification
		return {
			success: true,
			output: thought,
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

		return {
			success: false,
			output: '',
			error:
				error instanceof Error
					? `Failed to process thought: ${error.message}`
					: 'Failed to process thought',
		};
	}
}

export const thinkTool: Tool = {
	definition: {
		type: 'function',
		function: {
			name: 'think',
			description: `Think out loud without taking any actions. Use this tool to:
- Plan multi-step approaches before executing
- Analyze problems and identify root causes
- Reason through complex decisions
- Identify what information is missing

This tool does NOT modify any files or state. The thought is logged in conversation history for transparency.

When to use:
- Before implementing complex features (outline steps)
- When debugging (trace through logic)
- When request is ambiguous (identify what to clarify)
- When multiple approaches exist (compare trade-offs)

Example:
  "I need to implement authentication. Let me think through the approach:
   1. User submits credentials
   2. Hash password with bcrypt
   3. Compare with stored hash
   4. Generate JWT token
   5. Return token to client
   I should start with the password hashing utility first."`,
			parameters: {
				type: 'object',
				properties: {
					thought: {
						type: 'string',
						description:
							'The reasoning, analysis, or planning to log. Can be multi-line. Be as detailed as needed.',
					},
				},
				required: ['thought'],
			},
		},
	},
	executor: executeThink,
};
