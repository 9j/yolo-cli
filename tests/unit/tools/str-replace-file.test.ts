/**
 * Unit tests for str_replace_file tool
 * Tests basic replacement, replace_all behavior, error handling, and multi-line replacement
 */

import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {strReplaceFileTool} from '../../../src/tools/str-replace-file.js';

describe('str_replace_file tool', () => {
	let testDir: string;
	let testFile: string;

	beforeEach(async () => {
		// Create temporary test directory
		testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yolo-test-'));
		testFile = path.join(testDir, 'test.txt');
	});

	afterEach(async () => {
		// Clean up test directory
		await fs.rm(testDir, {recursive: true, force: true});
	});

	describe('T008: Basic replacement functionality', () => {
		it('should replace text in a file successfully', async () => {
			// Arrange
			const originalContent = 'Hello world\nThis is a test\nGoodbye world';
			await fs.writeFile(testFile, originalContent, 'utf-8');

			// Act
			const result = await strReplaceFileTool.executor({
				path: testFile,
				old_text: 'world',
				new_text: 'universe',
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(true);
			expect(result.output).toContain('1 replacement');

			const newContent = await fs.readFile(testFile, 'utf-8');
			expect(newContent).toBe('Hello universe\nThis is a test\nGoodbye world');
		});

		it('should return error when old_text not found', async () => {
			// Arrange
			const originalContent = 'Hello world';
			await fs.writeFile(testFile, originalContent, 'utf-8');

			// Act
			const result = await strReplaceFileTool.executor({
				path: testFile,
				old_text: 'nonexistent',
				new_text: 'replacement',
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(false);
			expect(result.error).toContain('not found');

			// File should be unchanged
			const content = await fs.readFile(testFile, 'utf-8');
			expect(content).toBe(originalContent);
		});

		it('should handle empty new_text (deletion)', async () => {
			// Arrange
			const originalContent = 'Hello world test';
			await fs.writeFile(testFile, originalContent, 'utf-8');

			// Act
			const result = await strReplaceFileTool.executor({
				path: testFile,
				old_text: ' world',
				new_text: '',
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(true);
			const newContent = await fs.readFile(testFile, 'utf-8');
			expect(newContent).toBe('Hello test');
		});

		it('should preserve file encoding (UTF-8)', async () => {
			// Arrange
			const originalContent = 'Hello 世界 🌍';
			await fs.writeFile(testFile, originalContent, 'utf-8');

			// Act
			const result = await strReplaceFileTool.executor({
				path: testFile,
				old_text: '世界',
				new_text: 'world',
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(true);
			const newContent = await fs.readFile(testFile, 'utf-8');
			expect(newContent).toBe('Hello world 🌍');
		});
	});

	describe('T009: replace_all=false behavior (default)', () => {
		it('should replace only first occurrence when replace_all is false', async () => {
			// Arrange
			const originalContent = 'foo bar foo baz foo';
			await fs.writeFile(testFile, originalContent, 'utf-8');

			// Act
			const result = await strReplaceFileTool.executor({
				path: testFile,
				old_text: 'foo',
				new_text: 'qux',
				replace_all: false,
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(true);
			expect(result.output).toContain('1 replacement');

			const newContent = await fs.readFile(testFile, 'utf-8');
			expect(newContent).toBe('qux bar foo baz foo');
		});

		it('should replace only first occurrence when replace_all is omitted (default)', async () => {
			// Arrange
			const originalContent = 'test test test';
			await fs.writeFile(testFile, originalContent, 'utf-8');

			// Act
			const result = await strReplaceFileTool.executor({
				path: testFile,
				old_text: 'test',
				new_text: 'pass',
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(true);
			const newContent = await fs.readFile(testFile, 'utf-8');
			expect(newContent).toBe('pass test test');
		});
	});

	describe('T010: replace_all=true behavior', () => {
		it('should replace all occurrences when replace_all is true', async () => {
			// Arrange
			const originalContent = 'foo bar foo baz foo';
			await fs.writeFile(testFile, originalContent, 'utf-8');

			// Act
			const result = await strReplaceFileTool.executor({
				path: testFile,
				old_text: 'foo',
				new_text: 'qux',
				replace_all: true,
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(true);
			expect(result.output).toContain('3 replacement');

			const newContent = await fs.readFile(testFile, 'utf-8');
			expect(newContent).toBe('qux bar qux baz qux');
		});

		it('should replace all occurrences across multiple lines', async () => {
			// Arrange
			const originalContent = 'line1: foo\nline2: foo\nline3: bar\nline4: foo';
			await fs.writeFile(testFile, originalContent, 'utf-8');

			// Act
			const result = await strReplaceFileTool.executor({
				path: testFile,
				old_text: 'foo',
				new_text: 'baz',
				replace_all: true,
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(true);
			expect(result.output).toContain('3 replacement');

			const newContent = await fs.readFile(testFile, 'utf-8');
			expect(newContent).toBe('line1: baz\nline2: baz\nline3: bar\nline4: baz');
		});
	});

	describe('T011: Error handling - old_text not found', () => {
		it('should return error when old_text does not exist', async () => {
			// Arrange
			const originalContent = 'Hello world';
			await fs.writeFile(testFile, originalContent, 'utf-8');

			// Act
			const result = await strReplaceFileTool.executor({
				path: testFile,
				old_text: 'nonexistent',
				new_text: 'replacement',
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/not found|does not exist/i);

			// File should remain unchanged
			const content = await fs.readFile(testFile, 'utf-8');
			expect(content).toBe(originalContent);
		});

		it('should preserve file when error occurs', async () => {
			// Arrange
			const originalContent = 'Important data\nDo not lose this';
			await fs.writeFile(testFile, originalContent, 'utf-8');

			// Act
			await strReplaceFileTool.executor({
				path: testFile,
				old_text: 'missing',
				new_text: 'replacement',
				_context: {workingDirectory: testDir},
			});

			// Assert - file unchanged
			const content = await fs.readFile(testFile, 'utf-8');
			expect(content).toBe(originalContent);
		});
	});

	describe('T012: Multi-line replacement', () => {
		it('should replace multi-line old_text with multi-line new_text', async () => {
			// Arrange
			const originalContent = 'function foo() {\n  return 42;\n}\nrest of file';
			await fs.writeFile(testFile, originalContent, 'utf-8');

			// Act
			const result = await strReplaceFileTool.executor({
				path: testFile,
				old_text: 'function foo() {\n  return 42;\n}',
				new_text: 'function bar() {\n  return 100;\n}',
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(true);
			const newContent = await fs.readFile(testFile, 'utf-8');
			expect(newContent).toBe('function bar() {\n  return 100;\n}\nrest of file');
		});

		it('should preserve exact indentation and formatting', async () => {
			// Arrange
			const originalContent = 'class Test {\n\tconstructor() {\n\t\tthis.x = 1;\n\t}\n}';
			await fs.writeFile(testFile, originalContent, 'utf-8');

			// Act
			const result = await strReplaceFileTool.executor({
				path: testFile,
				old_text: '\tconstructor() {\n\t\tthis.x = 1;\n\t}',
				new_text: '\tconstructor() {\n\t\tthis.x = 2;\n\t}',
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(true);
			const newContent = await fs.readFile(testFile, 'utf-8');
			expect(newContent).toBe('class Test {\n\tconstructor() {\n\t\tthis.x = 2;\n\t}\n}');
		});

		it('should handle multi-line replacement with replace_all=true', async () => {
			// Arrange
			const block = 'START\nMIDDLE\nEND';
			const originalContent = `${block}\nother\n${block}`;
			await fs.writeFile(testFile, originalContent, 'utf-8');

			// Act
			const result = await strReplaceFileTool.executor({
				path: testFile,
				old_text: block,
				new_text: 'REPLACED',
				replace_all: true,
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(true);
			expect(result.output).toContain('2 replacement');
			const newContent = await fs.readFile(testFile, 'utf-8');
			expect(newContent).toBe('REPLACED\nother\nREPLACED');
		});
	});

	describe('Parameter validation', () => {
		it('should reject missing path parameter', async () => {
			// Act
			const result = await strReplaceFileTool.executor({
				old_text: 'foo',
				new_text: 'bar',
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(false);
			expect(result.error).toMatch(/path.*required/i);
		});

		it('should reject missing old_text parameter', async () => {
			// Act
			const result = await strReplaceFileTool.executor({
				path: testFile,
				new_text: 'bar',
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(false);
			expect(result.error).toMatch(/old_text.*required/i);
		});

		it('should reject missing new_text parameter', async () => {
			// Act
			const result = await strReplaceFileTool.executor({
				path: testFile,
				old_text: 'foo',
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(false);
			expect(result.error).toMatch(/new_text.*required/i);
		});

		it('should reject non-absolute path', async () => {
			// Act
			const result = await strReplaceFileTool.executor({
				path: 'relative/path.txt',
				old_text: 'foo',
				new_text: 'bar',
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(false);
			expect(result.error).toMatch(/absolute path/i);
		});

		it('should reject non-existent file', async () => {
			// Act
			const result = await strReplaceFileTool.executor({
				path: path.join(testDir, 'nonexistent.txt'),
				old_text: 'foo',
				new_text: 'bar',
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(false);
			expect(result.error).toMatch(/does not exist/i);
		});
	});
});
