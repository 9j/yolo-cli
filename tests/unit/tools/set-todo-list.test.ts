/**
 * Unit tests for set_todo_list tool
 * Tests basic functionality and todo validation
 */

import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import type {Todo} from '../../../src/types/todos.js';

// Import will be available after implementation
let setTodoListTool: any;

describe('set_todo_list tool', () => {
	let testDir: string;

	beforeEach(async () => {
		// Create temporary test directory
		testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'set-todo-test-'));

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

	describe('T026: Basic functionality', () => {
		it('should set todos successfully', async () => {
			// Arrange
			const todos: Todo[] = [
				{title: 'Task 1', status: 'pending'},
				{title: 'Task 2', status: 'in_progress'},
				{title: 'Task 3', status: 'completed'},
			];

			// Act
			const result = await setTodoListTool.executor({
				todos,
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(true);
			expect(result.output).toContain('3 todo');
		});

		it('should create .yolo/todos.json file', async () => {
			// Arrange
			const todos: Todo[] = [{title: 'Test task', status: 'pending'}];

			// Act
			await setTodoListTool.executor({
				todos,
				_context: {workingDirectory: testDir},
			});

			// Assert
			const todosPath = path.join(testDir, '.yolo', 'todos.json');
			const exists = await fs
				.access(todosPath)
				.then(() => true)
				.catch(() => false);
			expect(exists).toBe(true);
		});

		it('should replace existing todos (full replacement pattern)', async () => {
			// Arrange
			const todos1: Todo[] = [
				{title: 'Old task 1', status: 'pending'},
				{title: 'Old task 2', status: 'pending'},
			];
			const todos2: Todo[] = [{title: 'New task', status: 'completed'}];

			// Act
			await setTodoListTool.executor({
				todos: todos1,
				_context: {workingDirectory: testDir},
			});
			const result = await setTodoListTool.executor({
				todos: todos2,
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(true);
			expect(result.output).toContain('1 todo');

			// Verify file contains only new todos
			const todosPath = path.join(testDir, '.yolo', 'todos.json');
			const content = await fs.readFile(todosPath, 'utf-8');
			const parsed = JSON.parse(content);
			expect(parsed.todos).toEqual(todos2);
		});

		it('should handle empty todos array', async () => {
			// Act
			const result = await setTodoListTool.executor({
				todos: [],
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(true);
			expect(result.output).toContain('0 todo');
		});

		it('should return success message with counts', async () => {
			// Arrange
			const todos: Todo[] = [
				{title: 'P1', status: 'pending'},
				{title: 'P2', status: 'pending'},
				{title: 'I1', status: 'in_progress'},
				{title: 'C1', status: 'completed'},
				{title: 'C2', status: 'completed'},
				{title: 'C3', status: 'completed'},
			];

			// Act
			const result = await setTodoListTool.executor({
				todos,
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(true);
			expect(result.output).toContain('2 pending');
			expect(result.output).toContain('1 in progress');
			expect(result.output).toContain('3 completed');
		});

		it('should handle todos with special characters in title', async () => {
			// Arrange
			const todos: Todo[] = [
				{title: 'Task with "quotes"', status: 'pending'},
				{title: 'Task with\nnewlines', status: 'pending'},
				{title: 'Task with 世界 unicode', status: 'pending'},
			];

			// Act
			const result = await setTodoListTool.executor({
				todos,
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(true);
		});
	});

	describe('T027: Todo validation', () => {
		it('should require todos parameter', async () => {
			// Act
			const result = await setTodoListTool.executor({
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(false);
			expect(result.error).toMatch(/todos.*required/i);
		});

		it('should require todos to be an array', async () => {
			// Act
			const result = await setTodoListTool.executor({
				todos: 'not an array',
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(false);
			expect(result.error).toMatch(/array/i);
		});

		it('should validate todo has title', async () => {
			// Act
			const result = await setTodoListTool.executor({
				todos: [{status: 'pending'}], // Missing title
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(false);
			expect(result.error).toMatch(/title/i);
		});

		it('should validate todo has status', async () => {
			// Act
			const result = await setTodoListTool.executor({
				todos: [{title: 'Test'}], // Missing status
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(false);
			expect(result.error).toMatch(/status/i);
		});

		it('should validate title is non-empty string', async () => {
			// Act
			const result = await setTodoListTool.executor({
				todos: [{title: '', status: 'pending'}],
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(false);
			expect(result.error).toMatch(/title.*empty/i);
		});

		it('should validate status is valid enum value', async () => {
			// Act
			const result = await setTodoListTool.executor({
				todos: [{title: 'Test', status: 'invalid_status'}],
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(false);
			expect(result.error).toMatch(/status.*pending|in_progress|completed/i);
		});

		it('should validate title is string type', async () => {
			// Act
			const result = await setTodoListTool.executor({
				todos: [{title: 123, status: 'pending'}],
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(false);
			expect(result.error).toMatch(/title.*string/i);
		});

		it('should validate status is string type', async () => {
			// Act
			const result = await setTodoListTool.executor({
				todos: [{title: 'Test', status: 123}],
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(false);
			expect(result.error).toMatch(/status.*string/i);
		});

		it('should accept all valid status values', async () => {
			// Arrange
			const todos: Todo[] = [
				{title: 'Task 1', status: 'pending'},
				{title: 'Task 2', status: 'in_progress'},
				{title: 'Task 3', status: 'completed'},
			];

			// Act
			const result = await setTodoListTool.executor({
				todos,
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(true);
		});

		it('should validate all todos in array', async () => {
			// Act - second todo is invalid
			const result = await setTodoListTool.executor({
				todos: [
					{title: 'Valid', status: 'pending'},
					{title: 'Invalid', status: 'bad_status'},
				],
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(false);
		});
	});

	describe('Working directory context', () => {
		it('should use working directory from context', async () => {
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
			const parsed = JSON.parse(content);
			expect(parsed.working_directory).toBe(testDir);
		});

		it('should fall back to process.cwd() if no context', async () => {
			// Arrange
			const todos: Todo[] = [{title: 'Test', status: 'pending'}];

			// Act
			const result = await setTodoListTool.executor({todos});

			// Assert - should still succeed
			expect(result.success).toBe(true);
		});
	});

	describe('Tool definition', () => {
		it('should have correct tool definition structure', () => {
			expect(setTodoListTool.definition.type).toBe('function');
			expect(setTodoListTool.definition.function.name).toBe('set_todo_list');
			expect(setTodoListTool.definition.function.description).toBeDefined();
			expect(setTodoListTool.definition.function.parameters).toBeDefined();
		});

		it('should have todos array parameter in schema', () => {
			const params = setTodoListTool.definition.function.parameters;
			expect(params.type).toBe('object');
			expect(params.properties.todos).toBeDefined();
			expect(params.properties.todos.type).toBe('array');
			expect(params.required).toContain('todos');
		});

		it('should define todo item schema', () => {
			const params = setTodoListTool.definition.function.parameters;
			const todoSchema = params.properties.todos.items;
			expect(todoSchema.type).toBe('object');
			expect(todoSchema.properties.title).toBeDefined();
			expect(todoSchema.properties.status).toBeDefined();
			// Note: ToolParameter type doesn't have 'required' field
			// Validation is handled in the executor instead
		});
	});
});
