/**
 * SetTodoList tool - Structured todo management with status tracking
 * Enables breaking down complex tasks into trackable subtasks
 */

import type {Tool, ToolExecutionResult} from '../types/tools.js';
import type {ToolContext} from '../services/tools.js';
import type {Todo, TodoStatus} from '../types/todos.js';
import {saveTodos, getTodoCounts} from '../services/todos.js';

interface SetTodoListArgs {
	todos: Todo[];
	_context?: ToolContext;
}

const VALID_STATUSES: TodoStatus[] = ['pending', 'in_progress', 'completed'];

function validateArgs(args: Record<string, unknown>): SetTodoListArgs {
	// Validate todos parameter exists
	if (!args.todos || !Array.isArray(args.todos)) {
		throw new Error('todos is required and must be an array');
	}

	const todos = args.todos as unknown[];

	// Validate each todo
	for (let i = 0; i < todos.length; i++) {
		const todo = todos[i];

		// Check todo is an object
		if (typeof todo !== 'object' || todo === null) {
			throw new Error(`Todo at index ${i} must be an object`);
		}

		const todoObj = todo as Record<string, unknown>;

		// Validate title
		if (todoObj.title === undefined || todoObj.title === null || typeof todoObj.title !== 'string') {
			throw new Error(`Todo at index ${i}: title is required and must be a string`);
		}

		if (todoObj.title.trim() === '') {
			throw new Error(`Todo at index ${i}: title cannot be empty`);
		}

		// Validate status
		if (!todoObj.status || typeof todoObj.status !== 'string') {
			throw new Error(`Todo at index ${i}: status is required and must be a string`);
		}

		if (!VALID_STATUSES.includes(todoObj.status as TodoStatus)) {
			throw new Error(
				`Todo at index ${i}: status must be one of: ${VALID_STATUSES.join(', ')}`,
			);
		}
	}

	return {
		todos: todos as Todo[],
		_context: args._context as ToolContext | undefined,
	};
}

async function executeSetTodoList(
	args: Record<string, unknown>,
): Promise<ToolExecutionResult> {
	try {
		const {todos, _context} = validateArgs(args);

		// Get working directory from context
		const workingDir = _context?.workingDirectory ?? process.cwd();

		// Save todos using persistence service
		await saveTodos(workingDir, todos);

		// Get counts for success message
		const counts = getTodoCounts(todos);

		// Format success message
		const totalCount = todos.length;
		const plural = totalCount === 1 ? '' : 's';

		const parts: string[] = [
			`Successfully set ${totalCount} todo${plural}`,
		];

		if (totalCount > 0) {
			const statusParts: string[] = [];
			if (counts.pending > 0) statusParts.push(`${counts.pending} pending`);
			if (counts.in_progress > 0) statusParts.push(`${counts.in_progress} in progress`);
			if (counts.completed > 0) statusParts.push(`${counts.completed} completed`);

			if (statusParts.length > 0) {
				parts.push(`(${statusParts.join(', ')})`);
			}
		}

		return {
			success: true,
			output: parts.join(' '),
		};
	} catch (error) {
		// Handle validation errors
		if (error instanceof Error && (error.message.includes('required') || error.message.includes('must be'))) {
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
					? `Failed to set todo list: ${error.message}`
					: 'Failed to set todo list',
		};
	}
}

export const setTodoListTool: Tool = {
	definition: {
		type: 'function',
		function: {
			name: 'set_todo_list',
			description: `Set the complete todo list for the current working directory. This REPLACES the entire list.

Use this to:
- Break down complex tasks into subtasks
- Track progress on multi-step implementations
- Provide visibility into what's pending vs. completed

Status values:
- "pending": Task not yet started
- "in_progress": Currently working on this task
- "completed": Task finished

The todo list is persisted in .yolo/todos.json and displayed in the status bar as counts.

Example:
  [
    { "title": "Implement StrReplaceFile tool", "status": "completed" },
    { "title": "Write unit tests", "status": "in_progress" },
    { "title": "Update documentation", "status": "pending" }
  ]
  → Status bar shows: [1 pending, 1 in progress, 1 completed]

Note: Each call replaces the ENTIRE list. To update a task, send the full list with the updated status.`,
			parameters: {
				type: 'object',
				properties: {
					todos: {
						type: 'array',
						description: 'The complete todo list. This replaces any existing todos.',
						items: {
							type: 'object',
							description: 'A todo item with title and status',
							properties: {
								title: {
									type: 'string',
									description: 'Task description (required, must be at least 1 character)',
								},
								status: {
									type: 'string',
									enum: ['pending', 'in_progress', 'completed'],
									description: 'Current task status (required)',
								},
							},
						},
					},
				},
				required: ['todos'],
			},
		},
	},
	executor: executeSetTodoList,
};
