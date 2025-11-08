/**
 * Main application component
 */

import React, {useState, useEffect} from 'react';
import {Box, Text} from 'ink';
import type {Configuration, Session, ErrorInfo} from '../types/index.js';
import {getConfig} from '../services/config.js';
import {createSession, loadSession} from '../services/session.js';
import {getEnabledModels, getCurrentModel} from '../services/config.js';
import {SetupWizard} from './SetupWizard.js';
import {ChatInterface} from './ChatInterface.js';
import {McpConfigLoader} from '../utils/mcp-config.js';
import {McpServerManager} from '../services/mcp.js';
import type {LoadResult} from '../types/mcp.js';

export interface AppProps {
	workingDirectory: string;
	continueSession?: boolean;
	query?: string;
	modelId?: string;
}

export function App({
	workingDirectory,
	continueSession = false,
	query,
	modelId,
}: AppProps) {
	const [config, setConfig] = useState<Configuration | null>(null);
	const [session, setSession] = useState<Session | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<ErrorInfo | null>(null);
	const [mode, setMode] = useState<'setup' | 'interactive' | 'non-interactive'>(
		'interactive',
	);
	const [mcpManager] = useState(() => new McpServerManager());
	const [mcpLoadResult, setMcpLoadResult] = useState<LoadResult | null>(null);

	// Initialize app
	useEffect(() => {
		const initialize = async () => {
			try {
				setIsLoading(true);

				// Load configuration
				const loadedConfig = await getConfig();

				if (!loadedConfig) {
					// No config found, run setup
					setMode('setup');
					setIsLoading(false);
					return;
				}

				setConfig(loadedConfig);

				// Load MCP servers
				const mcpLoader = new McpConfigLoader(workingDirectory);
				const {global, project} = await mcpLoader.discoverConfigs();
				const mergedMcpConfig = mcpLoader.mergeConfigs(global, project);

				if (Object.keys(mergedMcpConfig.mcpServers).length > 0) {
					console.info('Loading MCP servers...');
					const result = await mcpManager.loadFromConfig(mergedMcpConfig);
					setMcpLoadResult(result);

					// Display startup summary
					if (result.servers.length > 0) {
						console.info(
							`✓ Loaded ${result.servers.length} MCP server(s) with ${result.toolCount} tool(s)`,
						);
						for (const server of result.servers) {
							const source =
								mergedMcpConfig.sources[server.name] === 'global'
									? 'global'
									: 'project';
							console.info(`  ✓ ${server.name} (${source})`);
						}
					}

					if (result.errors.length > 0) {
						for (const error of result.errors) {
							console.warn(
								`  ✗ ${error.serverName} failed: ${error.message}`,
							);
						}
					}
				}

				// Get enabled models
				const enabledModels = getEnabledModels(loadedConfig);

				if (enabledModels.length === 0) {
					setError({
						type: 'unknown',
						message: 'No models enabled. Please run setup.',
					});
					setMode('setup');
					setIsLoading(false);
					return;
				}

				// Determine which model to use
				let currentModelId: string;

				if (modelId) {
					// Use specified model
					const modelExists = enabledModels.some(m => m.id === modelId);
					if (!modelExists) {
						setError({
							type: 'unknown',
							message: `Model ${modelId} not found in enabled models`,
						});
						setIsLoading(false);
						return;
					}

					currentModelId = modelId;
				} else {
					// Use default model or first enabled
					const defaultModel = getCurrentModel(loadedConfig);
					if (!defaultModel) {
						setError({
							type: 'unknown',
							message: 'No default model configured',
						});
						setIsLoading(false);
						return;
					}

					currentModelId = defaultModel.id;
				}

				// Load or create session
				let newSession: Session;

				if (continueSession) {
					newSession = await loadSession(
						workingDirectory,
						currentModelId,
						loadedConfig,
					);
				} else {
					newSession = createSession(workingDirectory, currentModelId);
				}

				setSession(newSession);

				// Determine mode
				if (query) {
					setMode('non-interactive');
				} else {
					setMode('interactive');
				}

				setIsLoading(false);
			} catch (error_) {
				setError({
					type: 'unknown',
					message:
						error_ instanceof Error ? error_.message : 'Failed to initialize app',
				});
				setIsLoading(false);
			}
		};

		void initialize();
	}, [workingDirectory, continueSession, query, modelId]);

	// Cleanup MCP servers on exit
	useEffect(() => {
		const cleanup = async () => {
			await mcpManager.cleanup();
		};

		// Register cleanup handlers
		process.on('exit', () => {
			void cleanup();
		});

		process.on('SIGTERM', async () => {
			await cleanup();
			process.exit(0);
		});

		// Note: SIGINT (Ctrl+C) is handled in ChatInterface for streaming interruption
		// We don't want to exit the app on Ctrl+C

		// Cleanup on unmount
		return () => {
			void cleanup();
		};
	}, [mcpManager]);

	// Handle config update from setup wizard
	const handleConfigComplete = (newConfig: Configuration) => {
		setConfig(newConfig);
		setMode('interactive');

		// Create new session
		const defaultModel = getCurrentModel(newConfig);
		if (defaultModel) {
			const newSession = createSession(workingDirectory, defaultModel.id);
			setSession(newSession);
		}
	};

	if (isLoading) {
		return (
			<Box flexDirection="column">
				<Text>Loading...</Text>
			</Box>
		);
	}

	if (error && mode !== 'setup') {
		return (
			<Box flexDirection="column">
				<Text color="red">Error: {error.message}</Text>
			</Box>
		);
	}

	if (mode === 'setup') {
		return <SetupWizard onComplete={handleConfigComplete} />;
	}

	if (!config || !session) {
		return (
			<Box flexDirection="column">
				<Text color="red">Configuration or session not initialized</Text>
			</Box>
		);
	}

	return (
		<ChatInterface
			config={config}
			session={session}
			initialQuery={query}
			mcpManager={mcpManager}
			onExit={async () => {
				await mcpManager.cleanup();
				process.exit(0);
			}}
		/>
	);
}
