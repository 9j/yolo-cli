/**
 * Todo persistence service
 * Handles loading and saving todos to .yolo/todos.json
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {TodoList, Todo} from '../types/index.js';

const TODOS_FILENAME = 'todos.json';
const YOLO_DIR = '.yolo';
const CURRENT_VERSION = '1.0.0';

/**
 * Load todos for a working directory
 *
 * @param workingDirectory - Absolute path to working directory
 * @returns TodoList or null if no todos file exists
 */
export async function loadTodos(
	workingDirectory: string,
): Promise<TodoList | null> {
	const todosPath = path.join(workingDirectory, YOLO_DIR, TODOS_FILENAME);

	try {
		const content = await fs.readFile(todosPath, 'utf-8');
		const todoList = JSON.parse(content) as TodoList;
		return todoList;
	} catch (error) {
		// File doesn't exist or is invalid JSON - return null
		if (
			error &&
			typeof error === 'object' &&
			'code' in error &&
			error.code === 'ENOENT'
		) {
			return null;
		}

		// Re-throw parsing errors
		throw error;
	}
}

/**
 * Save todos for a working directory
 *
 * @param workingDirectory - Absolute path to working directory
 * @param todos - Array of todo items
 * @throws Error if save fails
 */
export async function saveTodos(
	workingDirectory: string,
	todos: Todo[],
): Promise<void> {
	const yoloDir = path.join(workingDirectory, YOLO_DIR);
	const todosPath = path.join(yoloDir, TODOS_FILENAME);

	// Ensure .yolo directory exists
	try {
		await fs.mkdir(yoloDir, {recursive: true});
	} catch (error) {
		// Ignore if directory already exists
		if (
			!(
				error &&
				typeof error === 'object' &&
				'code' in error &&
				error.code === 'EEXIST'
			)
		) {
			throw error;
		}
	}

	// Create TodoList object
	const todoList: TodoList = {
		working_directory: workingDirectory,
		todos,
		version: CURRENT_VERSION,
	};

	// Write atomically: write to temp file then rename
	// Use unique temp file name to avoid conflicts during concurrent writes
	const tempPath = `${todosPath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
	await fs.writeFile(tempPath, JSON.stringify(todoList, null, 2), 'utf-8');
	await fs.rename(tempPath, todosPath);
}

/**
 * Get todo counts by status
 *
 * @param todos - Array of todo items
 * @returns Object with counts for each status
 */
export function getTodoCounts(todos: Todo[]): {
	pending: number;
	in_progress: number;
	completed: number;
} {
	return todos.reduce(
		(counts, todo) => {
			counts[todo.status]++;
			return counts;
		},
		{pending: 0, in_progress: 0, completed: 0},
	);
}
