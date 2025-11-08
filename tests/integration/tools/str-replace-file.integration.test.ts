/**
 * Integration tests for str_replace_file tool
 * Tests real file system operations and working directory validation
 */

import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {strReplaceFileTool} from '../../../src/tools/str-replace-file.js';

describe('str_replace_file integration tests', () => {
	let testDir: string;

	beforeEach(async () => {
		// Create temporary test directory (simulates working directory)
		testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yolo-integration-'));
	});

	afterEach(async () => {
		// Clean up test directory
		await fs.rm(testDir, {recursive: true, force: true});
	});

	describe('T013: Real file system operations', () => {
		it('should work with actual files in nested directories', async () => {
			// Arrange - create nested directory structure
			const nestedDir = path.join(testDir, 'src', 'components');
			await fs.mkdir(nestedDir, {recursive: true});

			const testFile = path.join(nestedDir, 'Component.tsx');
			const originalContent =
				'export function OldComponent() {\n  return <div>Old</div>;\n}';
			await fs.writeFile(testFile, originalContent, 'utf-8');

			// Act
			const result = await strReplaceFileTool.executor({
				path: testFile,
				old_text: 'OldComponent',
				new_text: 'NewComponent',
				replace_all: true,
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(true);
			expect(result.output).toContain('1 replacement');

			const newContent = await fs.readFile(testFile, 'utf-8');
			expect(newContent).toBe(
				'export function NewComponent() {\n  return <div>Old</div>;\n}',
			);
		});

		it('should handle files with various extensions', async () => {
			// Arrange - create files with different extensions
			const extensions = ['.ts', '.tsx', '.js', '.json', '.md', '.txt'];

			for (const ext of extensions) {
				const file = path.join(testDir, `test${ext}`);
				await fs.writeFile(file, 'old content', 'utf-8');

				// Act
				const result = await strReplaceFileTool.executor({
					path: file,
					old_text: 'old',
					new_text: 'new',
					_context: {workingDirectory: testDir},
				});

				// Assert
				expect(result.success).toBe(true);
				const content = await fs.readFile(file, 'utf-8');
				expect(content).toBe('new content');
			}
		});

		it('should preserve file permissions after replacement', async () => {
			// Arrange
			const testFile = path.join(testDir, 'script.sh');
			await fs.writeFile(testFile, '#!/bin/bash\necho old', 'utf-8');

			// Make file executable
			await fs.chmod(testFile, 0o755);
			const statsBefore = await fs.stat(testFile);

			// Act
			const result = await strReplaceFileTool.executor({
				path: testFile,
				old_text: 'old',
				new_text: 'new',
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(true);

			const statsAfter = await fs.stat(testFile);
			expect(statsAfter.mode).toBe(statsBefore.mode);
		});

		it('should handle large files efficiently', async () => {
			// Arrange - create a file with 10000 lines
			const lines = Array.from({length: 10000}, (_, i) => `Line ${i}`);
			lines[5000] = 'FIND_ME';
			const originalContent = lines.join('\n');

			const testFile = path.join(testDir, 'large.txt');
			await fs.writeFile(testFile, originalContent, 'utf-8');

			// Act
			const startTime = Date.now();
			const result = await strReplaceFileTool.executor({
				path: testFile,
				old_text: 'FIND_ME',
				new_text: 'FOUND_YOU',
				_context: {workingDirectory: testDir},
			});
			const duration = Date.now() - startTime;

			// Assert
			expect(result.success).toBe(true);
			expect(duration).toBeLessThan(1000); // Should complete within 1 second

			const newContent = await fs.readFile(testFile, 'utf-8');
			expect(newContent).toContain('FOUND_YOU');
			expect(newContent).not.toContain('FIND_ME');
		});

		it('should handle concurrent replacements correctly', async () => {
			// Arrange - create multiple files
			const files = await Promise.all(
				Array.from({length: 5}, async (_, i) => {
					const file = path.join(testDir, `file${i}.txt`);
					await fs.writeFile(file, `content ${i}`, 'utf-8');
					return file;
				}),
			);

			// Act - perform concurrent replacements
			const results = await Promise.all(
				files.map((file, i) =>
					strReplaceFileTool.executor({
						path: file,
						old_text: `content ${i}`,
						new_text: `replaced ${i}`,
						_context: {workingDirectory: testDir},
					}),
				),
			);

			// Assert
			results.forEach(result => {
				expect(result.success).toBe(true);
			});

			for (let i = 0; i < files.length; i++) {
				const content = await fs.readFile(files[i], 'utf-8');
				expect(content).toBe(`replaced ${i}`);
			}
		});

		it('should handle files with no trailing newline', async () => {
			// Arrange
			const testFile = path.join(testDir, 'no-newline.txt');
			await fs.writeFile(testFile, 'content without newline', 'utf-8');

			// Act
			const result = await strReplaceFileTool.executor({
				path: testFile,
				old_text: 'without',
				new_text: 'with',
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(true);
			const content = await fs.readFile(testFile, 'utf-8');
			expect(content).toBe('content with newline');
		});

		it('should handle empty files', async () => {
			// Arrange
			const testFile = path.join(testDir, 'empty.txt');
			await fs.writeFile(testFile, '', 'utf-8');

			// Act
			const result = await strReplaceFileTool.executor({
				path: testFile,
				old_text: 'anything',
				new_text: 'nothing',
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(false);
			expect(result.error).toMatch(/not found/i);

			const content = await fs.readFile(testFile, 'utf-8');
			expect(content).toBe('');
		});

		it('should handle files with special characters in path', async () => {
			// Arrange
			const specialDir = path.join(testDir, 'dir with spaces & special-chars');
			await fs.mkdir(specialDir, {recursive: true});

			const testFile = path.join(specialDir, 'file (1).txt');
			await fs.writeFile(testFile, 'old content', 'utf-8');

			// Act
			const result = await strReplaceFileTool.executor({
				path: testFile,
				old_text: 'old',
				new_text: 'new',
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(true);
			const content = await fs.readFile(testFile, 'utf-8');
			expect(content).toBe('new content');
		});
	});

	describe('Working directory validation', () => {
		it('should reject paths outside working directory', async () => {
			// Arrange - create file outside testDir
			const outsideDir = await fs.mkdtemp(
				path.join(os.tmpdir(), 'outside-'),
			);
			const outsideFile = path.join(outsideDir, 'outside.txt');
			await fs.writeFile(outsideFile, 'content', 'utf-8');

			try {
				// Act
				const result = await strReplaceFileTool.executor({
					path: outsideFile,
					old_text: 'content',
					new_text: 'replaced',
					_context: {workingDirectory: testDir},
				});

				// Assert - should be rejected
				expect(result.success).toBe(false);
				expect(result.error).toMatch(/outside.*working directory/i);
			} finally {
				// Clean up
				await fs.rm(outsideDir, {recursive: true, force: true});
			}
		});
	});

	describe('Error recovery', () => {
		it('should not corrupt file if replacement fails mid-operation', async () => {
			// Arrange
			const testFile = path.join(testDir, 'important.txt');
			const originalContent = 'Important data\nDo not lose';
			await fs.writeFile(testFile, originalContent, 'utf-8');

			// Act - trigger error by using missing old_text
			const result = await strReplaceFileTool.executor({
				path: testFile,
				old_text: 'nonexistent',
				new_text: 'replacement',
				_context: {workingDirectory: testDir},
			});

			// Assert
			expect(result.success).toBe(false);

			// File should be completely unchanged
			const content = await fs.readFile(testFile, 'utf-8');
			expect(content).toBe(originalContent);
		});
	});
});
