/**
 * Integration tests for set_todo_list tool
 * Tests file persistence and real working directory operations
 */

import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {loadTodos} from '../../../src/services/todos.js';
import type {Todo} from '../../../src/types/todos.js';

let setTodoListTool: any;

describe('set_todo_list integration tests', () => {
	let testDir: string;

	beforeEach(async () => {
		// Create temporary test directory
		testDir = await fs.mkdtemp(
			path.join(os.tmpdir(), 'set-todo-integration-'),
		);

		// Import the actual tool
		try {
			const module = await import('../../../src/tools/set-todo-list.js');
			setTodoListTool = module.setTodoListTool;
		} catch (error) {
			throw new Error(
				'set_todo_list tool not yet implemented - test should fail (TDD)',
			);
		}
	});

	afterEach(async () => {
		// Clean up test directory
		await fs.rm(testDir, {recursive: true, force: true});
	});

	describe('T029: File persistence', () => {
		it('should persist todos to .yolo/todos.json', async () => {
			// Arrange
			const todos: Todo[] = [
				{title: 'Implement feature', status: 'in_progress'},
				{title: 'Write tests', status: 'pending'},
			];

			// Act
			await setTodoListTool.executor({
				todos,
				_context: {workingDirectory: testDir},
			});

			// Assert - verify file exists and has correct content
			const loaded = await loadTodos(testDir);
			expect(loaded).not.toBeNull();
			expect(loaded?.todos).toEqual(todos);
			expect(loaded?.working_directory).toBe(testDir);
			expect(loaded?.version).toBe('1.0.0');
		});

		it('should create .yolo directory if it does not exist', async () => {
			// Arrange
			const todos: Todo[] = [{title: 'Test', status: 'pending'}];
			const yoloDir = path.join(testDir, '.yolo');

			// Verify .yolo doesn't exist yet
			const existsBefore = await fs
				.access(yoloDir)
				.then(() => true)
				.catch(() => false);
			expect(existsBefore).toBe(false);

			// Act
			await setTodoListTool.executor({
				todos,
				_context: {workingDirectory: testDir},
			});

			// Assert - .yolo directory was created
			const existsAfter = await fs
				.access(yoloDir)
				.then(() => true)
				.catch(() => false);
			expect(existsAfter).toBe(true);

			const stats = await fs.stat(yoloDir);
			expect(stats.isDirectory()).toBe(true);
		});

		it('should support multiple working directories', async () => {
			// Arrange
			const testDir2 = await fs.mkdtemp(
				path.join(os.tmpdir(), 'set-todo-integration-2-'),
			);

			const todos1: Todo[] = [{title: 'Project 1 task', status: 'pending'}];
			const todos2: Todo[] = [{title: 'Project 2 task', status: 'completed'}];

			try {
				// Act
				await setTodoListTool.executor({
					todos: todos1,
					_context: {workingDirectory: testDir},
				});
				await setTodoListTool.executor({
					todos: todos2,
					_context: {workingDirectory: testDir2},
				});

				// Assert - each directory has its own todos
				const loaded1 = await loadTodos(testDir);
				const loaded2 = await loadTodos(testDir2);

				expect(loaded1?.todos).toEqual(todos1);
				expect(loaded2?.todos).toEqual(todos2);
			} finally {
				await fs.rm(testDir2, {recursive: true, force: true});
			}
		});

		it('should handle concurrent updates safely', async () => {
			// Arrange
			const todos1: Todo[] = [{title: 'Task 1', status: 'pending'}];
			const todos2: Todo[] = [{title: 'Task 2', status: 'completed'}];
			const todos3: Todo[] = [{title: 'Task 3', status: 'in_progress'}];

			// Act - concurrent updates
			await Promise.all([
				setTodoListTool.executor({
					todos: todos1,
					_context: {workingDirectory: testDir},
				}),
				setTodoListTool.executor({
					todos: todos2,
					_context: {workingDirectory: testDir},
				}),
				setTodoListTool.executor({
					todos: todos3,
					_context: {workingDirectory: testDir},
				}),
			]);

			// Assert - one of them should win (no corruption)
			const loaded = await loadTodos(testDir);
			expect(loaded).not.toBeNull();
			expect(Array.isArray(loaded?.todos)).toBe(true);

			// Should be one of the three
			const isValid =
				JSON.stringify(loaded?.todos) === JSON.stringify(todos1) ||
				JSON.stringify(loaded?.todos) === JSON.stringify(todos2) ||
				JSON.stringify(loaded?.todos) === JSON.stringify(todos3);
			expect(isValid).toBe(true);
		});

		it('should preserve JSON formatting (2-space indent)', async () => {
			// Arrange
			const todos: Todo[] = [{title: 'Test', status: 'pending'}];

			// Act
			await setTodoListTool.executor({
				todos,
				_context: {workingDirectory: testDir},
			});

			// Assert
			const todosPath = path.join(testDir, '.yolo', 'todos.json');
			const content = await fs.readFile(todosPath, 'utf-8');

			expect(content).toContain('\n');
			expect(content).toContain('  '); // 2-space indent
			expect(content).not.toContain('\t'); // No tabs
		});
	});

	describe('Real-world scenarios', () => {
		it('should support typical workflow - add, update, complete', async () => {
			// Step 1: Create initial todos
			const step1: Todo[] = [
				{title: 'Design API', status: 'pending'},
				{title: 'Implement endpoints', status: 'pending'},
				{title: 'Write tests', status: 'pending'},
			];

			await setTodoListTool.executor({
				todos: step1,
				_context: {workingDirectory: testDir},
			});

			let loaded = await loadTodos(testDir);
			expect(loaded?.todos).toEqual(step1);

			// Step 2: Start working on first task
			const step2: Todo[] = [
				{title: 'Design API', status: 'in_progress'},
				{title: 'Implement endpoints', status: 'pending'},
				{title: 'Write tests', status: 'pending'},
			];

			await setTodoListTool.executor({
				todos: step2,
				_context: {workingDirectory: testDir},
			});

			loaded = await loadTodos(testDir);
			expect(loaded?.todos).toEqual(step2);

			// Step 3: Complete first task, start second
			const step3: Todo[] = [
				{title: 'Design API', status: 'completed'},
				{title: 'Implement endpoints', status: 'in_progress'},
				{title: 'Write tests', status: 'pending'},
			];

			await setTodoListTool.executor({
				todos: step3,
				_context: {workingDirectory: testDir},
			});

			loaded = await loadTodos(testDir);
			expect(loaded?.todos).toEqual(step3);

			// Step 4: Complete all
			const step4: Todo[] = [
				{title: 'Design API', status: 'completed'},
				{title: 'Implement endpoints', status: 'completed'},
				{title: 'Write tests', status: 'completed'},
			];

			await setTodoListTool.executor({
				todos: step4,
				_context: {workingDirectory: testDir},
			});

			loaded = await loadTodos(testDir);
			expect(loaded?.todos).toEqual(step4);
		});

		it('should handle large todo lists', async () => {
			// Arrange - create 100 todos
			const todos: Todo[] = Array.from({length: 100}, (_, i) => ({
				title: `Task ${i + 1}`,
				status: i % 3 === 0 ? 'completed' : i % 3 === 1 ? 'in_progress' : ('pending' as const),
			}));

			// Act
			const result = await setTodoListTool.executor({
				todos,
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(true);

			const loaded = await loadTodos(testDir);
			expect(loaded?.todos).toHaveLength(100);
			expect(loaded?.todos).toEqual(todos);
		});

		it('should clear todos by setting empty array', async () => {
			// Arrange - set initial todos
			const initialTodos: Todo[] = [
				{title: 'Task 1', status: 'pending'},
				{title: 'Task 2', status: 'completed'},
			];

			await setTodoListTool.executor({
				todos: initialTodos,
				_context: {workingDirectory: testDir},
			});

			// Act - clear todos
			const result = await setTodoListTool.executor({
				todos: [],
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(true);

			const loaded = await loadTodos(testDir);
			expect(loaded?.todos).toEqual([]);
		});
	});
});
