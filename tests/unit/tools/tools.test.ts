/**
 * Tool system tests - Phase 9.5 validation
 */

import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {ToolExecutor} from '../../../src/services/tools.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('Phase 9.5: Tool System Testing', () => {
	let executor: ToolExecutor;
	let tempDir: string;

	beforeEach(async () => {
		executor = new ToolExecutor();
		// Create temp directory for tests
		tempDir = path.join(os.tmpdir(), `yolo-test-${Date.now()}`);
		await fs.mkdir(tempDir, {recursive: true});
		executor.setContext({workingDirectory: tempDir});
	});

	afterEach(async () => {
		// Clean up temp directory
		try {
			await fs.rm(tempDir, {recursive: true, force: true});
		} catch {
			// Ignore cleanup errors
		}
	});

	// T090: Test file reading (small files, large files, binary files)
	describe('T090: File Reading Tests', () => {
		it('should read small text files', async () => {
			const testFile = path.join(tempDir, 'small.txt');
			const content = 'Hello World\nLine 2\nLine 3';
			await fs.writeFile(testFile, content);

			const result = await executor.executeTool({
				id: 'test-1',
				type: 'function',
				function: {
					name: 'read_file',
					arguments: JSON.stringify({path: testFile}),
				},
			});

			expect(result.content).toContain('Hello World');
			expect(result.content).toContain('Line 2');
			expect(result.content).toContain('3 lines read');
		});

		it('should read large files with line limit', async () => {
			const testFile = path.join(tempDir, 'large.txt');
			const lines = Array.from({length: 2000}, (_, i) => `Line ${i + 1}`);
			await fs.writeFile(testFile, lines.join('\n'));

			const result = await executor.executeTool({
				id: 'test-2',
				type: 'function',
				function: {
					name: 'read_file',
					arguments: JSON.stringify({path: testFile}),
				},
			});

			expect(result.content).toContain('1000 lines read');
			expect(result.content).toContain('Max 1000 lines reached');
		});

		it('should handle non-existent files', async () => {
			const result = await executor.executeTool({
				id: 'test-3',
				type: 'function',
				function: {
					name: 'read_file',
					arguments: JSON.stringify({
						path: path.join(tempDir, 'nonexistent.txt'),
					}),
				},
			});

			const parsed = JSON.parse(result.content);
			expect(parsed.success).toBe(false);
			expect(parsed.error).toContain('does not exist');
		});
	});

	// T091: Test file writing (new files, overwrites, append mode)
	describe('T091: File Writing Tests', () => {
		it('should create new files', async () => {
			const testFile = path.join(tempDir, 'new.txt');
			const content = 'New file content';

			const result = await executor.executeTool({
				id: 'test-4',
				type: 'function',
				function: {
					name: 'write_file',
					arguments: JSON.stringify({
						path: testFile,
						content,
					}),
				},
			});

			expect(result.content).toContain('File successfully written');
			const written = await fs.readFile(testFile, 'utf-8');
			expect(written).toBe(content);
		});

		it('should overwrite existing files', async () => {
			const testFile = path.join(tempDir, 'overwrite.txt');
			await fs.writeFile(testFile, 'Original content');

			const newContent = 'Overwritten content';
			const result = await executor.executeTool({
				id: 'test-5',
				type: 'function',
				function: {
					name: 'write_file',
					arguments: JSON.stringify({
						path: testFile,
						content: newContent,
					}),
				},
			});

			expect(result.content).toContain('File successfully written');
			const written = await fs.readFile(testFile, 'utf-8');
			expect(written).toBe(newContent);
		});

		it('should reject writes outside working directory', async () => {
			const outsidePath = '/tmp/outside.txt';

			const result = await executor.executeTool({
				id: 'test-6',
				type: 'function',
				function: {
					name: 'write_file',
					arguments: JSON.stringify({
						path: outsidePath,
						content: 'Should fail',
					}),
				},
			});

			const parsed = JSON.parse(result.content);
			expect(parsed.success).toBe(false);
			expect(parsed.error).toContain('outside the working directory');
		});
	});

	// T092: Test bash execution (simple commands, long-running, timeouts)
	describe('T092: Bash Execution Tests', () => {
		it('should execute simple commands', async () => {
			const result = await executor.executeTool({
				id: 'test-7',
				type: 'function',
				function: {
					name: 'bash',
					arguments: JSON.stringify({
						command: 'echo "Hello from bash"',
					}),
				},
			});

			expect(result.content).toContain('Hello from bash');
		});

		it('should execute commands in working directory', async () => {
			const result = await executor.executeTool({
				id: 'test-8',
				type: 'function',
				function: {
					name: 'bash',
					arguments: JSON.stringify({command: 'pwd'}),
				},
			});

			expect(result.content).toContain(tempDir);
		});

		it('should handle command failures', async () => {
			const result = await executor.executeTool({
				id: 'test-9',
				type: 'function',
				function: {
					name: 'bash',
					arguments: JSON.stringify({
						command: 'exit 1',
					}),
				},
			});

			const parsed = JSON.parse(result.content);
			expect(parsed.success).toBe(false);
			expect(parsed.error).toContain('exit code 1');
		});

		it('should timeout long-running commands', async () => {
			const result = await executor.executeTool({
				id: 'test-10',
				type: 'function',
				function: {
					name: 'bash',
					arguments: JSON.stringify({
						command: 'sleep 10',
						timeout: 1, // 1 second timeout
					}),
				},
			});

			const parsed = JSON.parse(result.content);
			expect(parsed.success).toBe(false);
			expect(parsed.error).toContain('timeout');
		});
	});

	// T093: Test path traversal protection (../../../etc/passwd)
	describe('T093: Path Traversal Protection', () => {
		it('should block path traversal in read_file', async () => {
			const result = await executor.executeTool({
				id: 'test-11',
				type: 'function',
				function: {
					name: 'read_file',
					arguments: JSON.stringify({
						path: '../../../etc/passwd',
					}),
				},
			});

			const parsed = JSON.parse(result.content);
			expect(parsed.success).toBe(false);
			expect(parsed.error).toContain('not an absolute path');
		});

		it('should block path traversal in write_file', async () => {
			const result = await executor.executeTool({
				id: 'test-12',
				type: 'function',
				function: {
					name: 'write_file',
					arguments: JSON.stringify({
						path: '../../etc/malicious.txt',
						content: 'Should not write',
					}),
				},
			});

			const parsed = JSON.parse(result.content);
			expect(parsed.success).toBe(false);
		});

		it('should allow absolute paths within working directory', async () => {
			const testFile = path.join(tempDir, 'safe.txt');
			const content = 'Safe content';

			const result = await executor.executeTool({
				id: 'test-13',
				type: 'function',
				function: {
					name: 'write_file',
					arguments: JSON.stringify({
						path: testFile,
						content,
					}),
				},
			});

			expect(result.content).toContain('File successfully written');
		});
	});

	// T094: Test tool call loop (multi-step reasoning with tools)
	describe('T094: Tool Call Loop Tests', () => {
		it('should handle sequential tool calls', async () => {
			// Step 1: Write a file
			const testFile = path.join(tempDir, 'sequential.txt');
			const writeResult = await executor.executeTool({
				id: 'test-14-1',
				type: 'function',
				function: {
					name: 'write_file',
					arguments: JSON.stringify({
						path: testFile,
						content: 'Sequential test content',
					}),
				},
			});

			expect(writeResult.content).toContain('File successfully written');

			// Step 2: Read the same file
			const readResult = await executor.executeTool({
				id: 'test-14-2',
				type: 'function',
				function: {
					name: 'read_file',
					arguments: JSON.stringify({path: testFile}),
				},
			});

			expect(readResult.content).toContain('Sequential test content');
		});

		it('should handle tool errors gracefully', async () => {
			// Attempt to read non-existent file
			const result = await executor.executeTool({
				id: 'test-15',
				type: 'function',
				function: {
					name: 'read_file',
					arguments: JSON.stringify({
						path: path.join(tempDir, 'missing.txt'),
					}),
				},
			});

			const parsed = JSON.parse(result.content);
			expect(parsed.success).toBe(false);
			expect(parsed.error).toBeDefined();
		});

		it('should handle invalid tool names', async () => {
			const result = await executor.executeTool({
				id: 'test-16',
				type: 'function',
				function: {
					name: 'nonexistent_tool',
					arguments: JSON.stringify({}),
				},
			});

			const parsed = JSON.parse(result.content);
			expect(parsed.success).toBe(false);
			expect(parsed.error).toContain('Unknown tool');
		});
	});

	// Additional: Test glob and grep tools
	describe('Additional Tool Tests', () => {
		it('should find files with glob', async () => {
			// Create test files
			await fs.writeFile(path.join(tempDir, 'test1.txt'), 'content1');
			await fs.writeFile(path.join(tempDir, 'test2.txt'), 'content2');
			await fs.writeFile(path.join(tempDir, 'other.md'), 'markdown');

			const result = await executor.executeTool({
				id: 'test-17',
				type: 'function',
				function: {
					name: 'glob',
					arguments: JSON.stringify({
						pattern: '*.txt',
						directory: tempDir,
					}),
				},
			});

			expect(result.content).toContain('test1.txt');
			expect(result.content).toContain('test2.txt');
			expect(result.content).toContain('2 files found');
		});

		it('should search file contents with grep', async () => {
			const testFile = path.join(tempDir, 'search.txt');
			await fs.writeFile(
				testFile,
				'Line 1: Hello\nLine 2: World\nLine 3: Hello again',
			);

			const result = await executor.executeTool({
				id: 'test-18',
				type: 'function',
				function: {
					name: 'grep',
					arguments: JSON.stringify({
						pattern: 'Hello',
						path: testFile,
					}),
				},
			});

			expect(result.content).toContain('Hello');
			expect(result.content).toContain('2 matches found');
		});
	});
});
