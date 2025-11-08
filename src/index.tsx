#!/usr/bin/env node
/**
 * Main entry point for YOLO CLI
 */

import React from 'react';
import {render} from 'ink';
import {App} from './components/App.js';
import {parseCLIArguments} from './cli.js';

// Parse command-line arguments
const options = parseCLIArguments();

// Render the app
const {waitUntilExit} = render(
	<App
		workingDirectory={options.workDir!}
		continueSession={options.continue}
		query={options.query}
		modelId={options.model}
	/>,
	{
		exitOnCtrlC: false, // Disable default Ctrl+C behavior, handle it manually
	},
);

// Wait for app to exit
void waitUntilExit();
