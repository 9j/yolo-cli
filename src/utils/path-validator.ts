/**
 * Path validation utilities for file system operations
 * Ensures paths are absolute and within working directory for security
 */

import * as path from 'node:path';
import * as fs from 'node:fs/promises';

export interface PathValidationResult {
	isValid: boolean;
	error?: string;
}

/**
 * Validates that a file path is absolute and within the working directory
 *
 * @param filePath - Path to validate
 * @param workingDirectory - Working directory to validate against
 * @returns Validation result with error message if invalid
 */
export function validatePath(
	filePath: string,
	workingDirectory: string,
): PathValidationResult {
	// Check if path is absolute
	if (!path.isAbsolute(filePath)) {
		return {
			isValid: false,
			error: `${filePath} is not an absolute path. You must provide an absolute path.`,
		};
	}

	// Resolve paths to handle symlinks and normalize
	const resolvedPath = path.resolve(filePath);
	const resolvedWorkDir = path.resolve(workingDirectory);

	// Check if path is within working directory
	if (!resolvedPath.startsWith(resolvedWorkDir)) {
		return {
			isValid: false,
			error: `${filePath} is outside the working directory. You can only access files within the working directory.`,
		};
	}

	return {isValid: true};
}

/**
 * Validates path and checks if file exists
 *
 * @param filePath - Path to validate and check
 * @param workingDirectory - Working directory to validate against
 * @returns Validation result with error message if invalid or doesn't exist
 */
export async function validatePathExists(
	filePath: string,
	workingDirectory: string,
): Promise<PathValidationResult> {
	// First validate path security
	const validation = validatePath(filePath, workingDirectory);
	if (!validation.isValid) {
		return validation;
	}

	// Check if file exists
	try {
		await fs.access(filePath);
		return {isValid: true};
	} catch {
		return {
			isValid: false,
			error: `${filePath} does not exist.`,
		};
	}
}

/**
 * Validates path exists and is a file (not directory)
 *
 * @param filePath - Path to validate
 * @param workingDirectory - Working directory to validate against
 * @returns Validation result with error message if invalid, doesn't exist, or is directory
 */
export async function validatePathIsFile(
	filePath: string,
	workingDirectory: string,
): Promise<PathValidationResult> {
	// First check exists
	const validation = await validatePathExists(filePath, workingDirectory);
	if (!validation.isValid) {
		return validation;
	}

	// Check if it's a file
	try {
		const stats = await fs.stat(filePath);
		if (!stats.isFile()) {
			return {
				isValid: false,
				error: `${filePath} is not a file.`,
			};
		}

		return {isValid: true};
	} catch (error) {
		return {
			isValid: false,
			error:
				error instanceof Error
					? `Failed to check file: ${error.message}`
					: 'Failed to check file',
		};
	}
}
