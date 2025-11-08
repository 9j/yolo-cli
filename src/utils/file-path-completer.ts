/**
 * File path completer for @ mentions
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface FilePathSuggestion {
	path: string;
	relativePath: string;
}

const IGNORED_DIRS = new Set([
	'node_modules',
	'.git',
	'.yolo',
	'dist',
	'build',
	'coverage',
	'__pycache__',
	'.next',
	'.nuxt',
	'.cache',
	'.turbo',
	'.vercel',
	'.netlify',
	'vendor',
	'tmp',
	'temp',
]);

const IGNORED_PATTERNS = [/^\./]; // Hidden files/dirs

const TRIGGER_GUARDS = new Set(['@', '#', '/']);

export class FilePathCompleter {
	private fileCache: string[] = [];
	private lastCacheTime = 0;
	private readonly cacheRefreshInterval = 2000; // 2 seconds
	private readonly workspaceRoot: string;

	constructor(workspaceRoot: string = process.cwd()) {
		this.workspaceRoot = workspaceRoot;
	}

	/**
	 * Extract @ fragment from input text
	 * Returns null if @ is not a valid trigger
	 */
	extractFragment(text: string): string | null {
		const index = text.lastIndexOf('@');
		if (index === -1) {
			return null;
		}

		// Check if @ is preceded by a guard character
		if (index > 0) {
			const prev = text[index - 1];
			if (prev && (prev.match(/[a-zA-Z0-9]/) || TRIGGER_GUARDS.has(prev))) {
				return null;
			}
		}

		const fragment = text.slice(index + 1);

		// Filter out fragments that are clearly not file paths
		if (fragment.includes(' ')) {
			return null;
		}

		return fragment;
	}

	/**
	 * Get file suggestions based on the fragment
	 */
	getSuggestions(fragment: string): FilePathSuggestion[] {
		this.refreshCacheIfNeeded();

		const useDeepSearch =
			fragment.length >= 3 || fragment.includes('/') || fragment.includes(path.sep);

		let candidates = this.fileCache;

		// For short queries without /, only show top-level files
		if (!useDeepSearch) {
			candidates = candidates.filter(file => !file.includes('/') && !file.includes(path.sep));
		}

		// Filter and sort by fuzzy match
		const matches = candidates
			.map(file => ({
				file,
				score: this.fuzzyMatch(file, fragment),
			}))
			.filter(({score}) => score > 0)
			.sort((a, b) => b.score - a.score)
			.slice(0, 10) // Limit to 10 suggestions
			.map(({file}) => ({
				path: path.join(this.workspaceRoot, file),
				relativePath: file,
			}));

		return matches;
	}

	/**
	 * Refresh file cache if needed
	 */
	private refreshCacheIfNeeded(): void {
		const now = Date.now();
		if (now - this.lastCacheTime > this.cacheRefreshInterval) {
			this.fileCache = this.scanFiles(this.workspaceRoot);
			this.lastCacheTime = now;
		}
	}

	/**
	 * Scan workspace for files
	 */
	private scanFiles(dir: string, prefix = ''): string[] {
		const files: string[] = [];

		try {
			const entries = fs.readdirSync(dir, {withFileTypes: true});

			for (const entry of entries) {
				const name = entry.name;

				// Skip ignored patterns
				if (IGNORED_PATTERNS.some(pattern => pattern.test(name))) {
					continue;
				}

				if (entry.isDirectory()) {
					// Skip ignored directories
					if (IGNORED_DIRS.has(name)) {
						continue;
					}

					const subPath = prefix ? `${prefix}/${name}` : name;
					files.push(...this.scanFiles(path.join(dir, name), subPath));
				} else if (entry.isFile()) {
					const filePath = prefix ? `${prefix}/${name}` : name;
					files.push(filePath);
				}
			}
		} catch (error) {
			// Ignore errors (permission issues, etc.)
		}

		return files;
	}

	/**
	 * Simple fuzzy matching algorithm
	 * Returns a score (higher is better, 0 means no match)
	 */
	private fuzzyMatch(text: string, pattern: string): number {
		if (!pattern) {
			return 1; // Empty pattern matches everything
		}

		const textLower = text.toLowerCase();
		const patternLower = pattern.toLowerCase();

		// Exact match gets highest score
		if (textLower === patternLower) {
			return 1000;
		}

		// Starts with pattern gets high score
		if (textLower.startsWith(patternLower)) {
			return 900;
		}

		// Contains pattern as substring gets medium score
		if (textLower.includes(patternLower)) {
			return 800;
		}

		// Fuzzy match: pattern characters appear in order
		let textIndex = 0;
		let patternIndex = 0;
		let score = 0;
		let consecutiveMatches = 0;

		while (textIndex < textLower.length && patternIndex < patternLower.length) {
			if (textLower[textIndex] === patternLower[patternIndex]) {
				score += 1 + consecutiveMatches * 5; // Bonus for consecutive matches
				consecutiveMatches++;
				patternIndex++;
			} else {
				consecutiveMatches = 0;
			}

			textIndex++;
		}

		// Did we match all pattern characters?
		if (patternIndex === patternLower.length) {
			return score;
		}

		return 0; // No match
	}
}
