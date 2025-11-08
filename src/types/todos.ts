/**
 * Todo types for structured task management
 */

/**
 * Todo status values
 */
export type TodoStatus = 'pending' | 'in_progress' | 'completed';

/**
 * Individual todo item
 */
export interface Todo {
	title: string; // Task description
	status: TodoStatus; // Current state
}

/**
 * Persisted todo list for a working directory
 */
export interface TodoList {
	working_directory: string; // Absolute path to project
	todos: Todo[]; // Array of todo items
	version: string; // Schema version for migrations
}
