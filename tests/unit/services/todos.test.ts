/**
 * Unit tests for todos persistence service
 * Tests loadTodos, saveTodos, and getTodoCounts functions
 */

import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
	loadTodos,
	saveTodos,
	getTodoCounts,
} from '../../../src/services/todos.js';
import type {Todo} from '../../../src/types/todos.js';

describe('todos persistence service', () => {
	let testDir: string;

	beforeEach(async () => {
		// Create temporary test directory
		testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'todos-test-'));
	});

	afterEach(async () => {
		// Clean up test directory
		await fs.rm(testDir, {recursive: true, force: true});
	});

	describe('T028: loadTodos', () => {
		it('should return null when todos file does not exist', async () => {
			// Act
			const result = await loadTodos(testDir);

			// Assert
			expect(result).toBeNull();
		});

		it('should load existing todos from .yolo/todos.json', async () => {
			// Arrange
			const todos: Todo[] = [
				{title: 'Task 1', status: 'pending'},
				{title: 'Task 2', status: 'in_progress'},
			];
			await saveTodos(testDir, todos);

			// Act
			const result = await loadTodos(testDir);

			// Assert
			expect(result).not.toBeNull();
			expect(result?.todos).toEqual(todos);
			expect(result?.working_directory).toBe(testDir);
			expect(result?.version).toBe('1.0.0');
		});

		it('should handle empty todos array', async () => {
			// Arrange
			await saveTodos(testDir, []);

			// Act
			const result = await loadTodos(testDir);

			// Assert
			expect(result).not.toBeNull();
			expect(result?.todos).toEqual([]);
		});

		it('should throw error on invalid JSON', async () => {
			// Arrange - create invalid JSON file
			const yoloDir = path.join(testDir, '.yolo');
			await fs.mkdir(yoloDir, {recursive: true});
			await fs.writeFile(
				path.join(yoloDir, 'todos.json'),
				'invalid json{',
				'utf-8',
			);

			// Act & Assert
			await expect(loadTodos(testDir)).rejects.toThrow();
		});
	});

	describe('T028: saveTodos', () => {
		it('should create .yolo directory if it does not exist', async () => {
			// Arrange
			const todos: Todo[] = [{title: 'Test', status: 'pending'}];

			// Act
			await saveTodos(testDir, todos);

			// Assert
			const yoloDir = path.join(testDir, '.yolo');
			const stats = await fs.stat(yoloDir);
			expect(stats.isDirectory()).toBe(true);
		});

		it('should save todos to .yolo/todos.json', async () => {
			// Arrange
			const todos: Todo[] = [
				{title: 'Task 1', status: 'pending'},
				{title: 'Task 2', status: 'completed'},
			];

			// Act
			await saveTodos(testDir, todos);

			// Assert
			const todosPath = path.join(testDir, '.yolo', 'todos.json');
			const content = await fs.readFile(todosPath, 'utf-8');
			const parsed = JSON.parse(content);

			expect(parsed.todos).toEqual(todos);
			expect(parsed.working_directory).toBe(testDir);
			expect(parsed.version).toBe('1.0.0');
		});

		it('should format JSON with 2-space indentation', async () => {
			// Arrange
			const todos: Todo[] = [{title: 'Test', status: 'pending'}];

			// Act
			await saveTodos(testDir, todos);

			// Assert
			const todosPath = path.join(testDir, '.yolo', 'todos.json');
			const content = await fs.readFile(todosPath, 'utf-8');

			// Check for formatted JSON (has newlines and indentation)
			expect(content).toContain('\n');
			expect(content).toContain('  '); // 2-space indent
		});

		it('should overwrite existing todos atomically', async () => {
			// Arrange
			const todos1: Todo[] = [{title: 'Old', status: 'pending'}];
			const todos2: Todo[] = [{title: 'New', status: 'completed'}];

			// Act
			await saveTodos(testDir, todos1);
			await saveTodos(testDir, todos2);

			// Assert
			const result = await loadTodos(testDir);
			expect(result?.todos).toEqual(todos2);
		});

		it('should handle all status types', async () => {
			// Arrange
			const todos: Todo[] = [
				{title: 'Pending task', status: 'pending'},
				{title: 'In progress task', status: 'in_progress'},
				{title: 'Completed task', status: 'completed'},
			];

			// Act
			await saveTodos(testDir, todos);

			// Assert
			const result = await loadTodos(testDir);
			expect(result?.todos).toEqual(todos);
		});

		it('should handle special characters in titles', async () => {
			// Arrange
			const todos: Todo[] = [
				{title: 'Task with "quotes"', status: 'pending'},
				{title: 'Task with\nnewline', status: 'pending'},
				{title: 'Task with 世界 unicode', status: 'pending'},
			];

			// Act
			await saveTodos(testDir, todos);

			// Assert
			const result = await loadTodos(testDir);
			expect(result?.todos).toEqual(todos);
		});
	});

	describe('T028: getTodoCounts', () => {
		it('should return zero counts for empty array', () => {
			// Act
			const counts = getTodoCounts([]);

			// Assert
			expect(counts).toEqual({
				pending: 0,
				in_progress: 0,
				completed: 0,
			});
		});

		it('should count todos by status', () => {
			// Arrange
			const todos: Todo[] = [
				{title: 'Task 1', status: 'pending'},
				{title: 'Task 2', status: 'pending'},
				{title: 'Task 3', status: 'in_progress'},
				{title: 'Task 4', status: 'completed'},
				{title: 'Task 5', status: 'completed'},
				{title: 'Task 6', status: 'completed'},
			];

			// Act
			const counts = getTodoCounts(todos);

			// Assert
			expect(counts).toEqual({
				pending: 2,
				in_progress: 1,
				completed: 3,
			});
		});

		it('should handle all pending', () => {
			// Arrange
			const todos: Todo[] = [
				{title: 'Task 1', status: 'pending'},
				{title: 'Task 2', status: 'pending'},
			];

			// Act
			const counts = getTodoCounts(todos);

			// Assert
			expect(counts).toEqual({
				pending: 2,
				in_progress: 0,
				completed: 0,
			});
		});

		it('should handle all in_progress', () => {
			// Arrange
			const todos: Todo[] = [
				{title: 'Task 1', status: 'in_progress'},
				{title: 'Task 2', status: 'in_progress'},
				{title: 'Task 3', status: 'in_progress'},
			];

			// Act
			const counts = getTodoCounts(todos);

			// Assert
			expect(counts).toEqual({
				pending: 0,
				in_progress: 3,
				completed: 0,
			});
		});

		it('should handle all completed', () => {
			// Arrange
			const todos: Todo[] = [{title: 'Task 1', status: 'completed'}];

			// Act
			const counts = getTodoCounts(todos);

			// Assert
			expect(counts).toEqual({
				pending: 0,
				in_progress: 0,
				completed: 1,
			});
		});
	});
});
