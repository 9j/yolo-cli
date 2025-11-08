#!/usr/bin/env node
/**
 * CLI entry point - command-line argument parsing
 */

import {Command} from 'commander';
import process from 'node:process';
import path from 'node:path';

export interface CLIOptions {
	query?: string;
	model?: string;
	workDir?: string;
	continue?: boolean;
	setup?: boolean;
}

export function parseCLIArguments(): CLIOptions {
	const program = new Command();

	program
		.name('yolo')
		.description('YOLO CLI - OpenRouter-powered AI command line interface')
		.version('1.0.0')
		.option('-q, --query <text>', 'Execute a one-off query without interactive mode')
		.option('-m, --model <modelId>', 'Specify model to use for query')
		.option(
			'-w, --work-dir <path>',
			'Working directory for session history',
			process.cwd(),
		)
		.option('-C, --continue', 'Continue previous conversation in current directory')
		.option('--setup', 'Run setup wizard to configure YOLO CLI');

	program.parse();

	const options = program.opts();

	return {
		query: options.query,
		model: options.model,
		workDir: path.resolve(options.workDir || process.cwd()),
		continue: options.continue ?? false,
		setup: options.setup ?? false,
	};
}
