/**
 * Chat interface component - main interactive UI
 */

import React, {useState, useEffect, useRef} from 'react';
import {Box, useInput, useApp, Text} from 'ink';
import type {
	Configuration,
	Session,
	ErrorInfo,
	ToolCall,
	APIMessage,
	CompactionConfig,
} from '../types/index.js';
import {COMPACTION_CONFIG} from '../types/index.js';
import {getEnabledModels, updateEnabledModels} from '../services/config.js';
import {
	addUserMessage,
	addAssistantMessage,
	saveMessage,
	updateSessionModel,
	clearConversationHistory,
	createNewSession,
	compactConversation,
	estimateConversationTokensLocal,
} from '../services/session.js';
import {OpenRouterClient} from '../services/openrouter.js';
import {getNextModel, getPreviousModel, getModelIndex, modelToConfig} from '../services/models.js';
import {toolExecutor} from '../services/tools.js';
import {MessageList} from './MessageList.js';
import {InputBox} from './InputBox.js';
import {StatusBar} from './StatusBar.js';
import {ModelSelector} from './ModelSelector.js';
import {ApprovalPrompt} from './ApprovalPrompt.js';
import {ConfirmClearPrompt} from './ConfirmClearPrompt.js';
import {ConfirmCompactPrompt} from './ConfirmCompactPrompt.js';
import {
	CommandAutocomplete,
	type CommandSuggestion,
} from './CommandAutocomplete.js';
import {
	FilePathAutocomplete,
} from './FilePathAutocomplete.js';
import {FilePathCompleter, type FilePathSuggestion} from '../utils/file-path-completer.js';
import type {McpServerManager} from '../services/mcp.js';

// Available slash commands for autocomplete
const AVAILABLE_COMMANDS: CommandSuggestion[] = [
	{command: 'model', aliases: ['models'], description: 'Select or change AI model'},
	{command: 'clear', aliases: ['reset'], description: 'Clear conversation history'},
	{command: 'new', description: 'Start a new session'},
	{command: 'compact', description: 'Summarize long conversations'},
	{command: 'version', description: 'Show YOLO CLI version'},
	{command: 'help', aliases: ['h', '?'], description: 'Show available commands'},
	{command: 'exit', aliases: ['quit'], description: 'Exit YOLO CLI'},
];

export interface ChatInterfaceProps {
	config: Configuration;
	session: Session;
	initialQuery?: string;
	mcpManager?: McpServerManager;
	onExit: () => void;
}

export function ChatInterface({
	config: initialConfig,
	session: initialSession,
	initialQuery,
	mcpManager,
	onExit,
}: ChatInterfaceProps) {
	const {exit} = useApp();
	const [config, setConfig] = useState(initialConfig);
	const [session, setSession] = useState(initialSession);
	const [input, setInput] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [isStreaming, setIsStreaming] = useState(false);
	const abortControllerRef = useRef<AbortController | null>(null);
	const [isExecutingTools, setIsExecutingTools] = useState(false);
	const [currentTool, setCurrentTool] = useState<string>('');
	const [streamingContent, setStreamingContent] = useState('');
	const [error, setError] = useState<ErrorInfo | null>(null);
	const [showModelSelector, setShowModelSelector] = useState(false);
	const [selectedModelIndex, setSelectedModelIndex] = useState(() => {
		const enabledModels = getEnabledModels(config);
		return getModelIndex(enabledModels, session.currentModel);
	});
	const [pendingApproval, setPendingApproval] = useState<{
		action: string;
		details: string;
		resolve: (approved: boolean) => void;
	} | null>(null);
	const [pendingClearConfirmation, setPendingClearConfirmation] =
		useState(false);
	const [pendingCompactConfirmation, setPendingCompactConfirmation] =
		useState(false);
	const [showAutocomplete, setShowAutocomplete] = useState(false);
	const [autocompleteIndex, setAutocompleteIndex] = useState(0);
	const [shouldMoveCursorToEnd, setShouldMoveCursorToEnd] = useState(false);
	const [showFileAutocomplete, setShowFileAutocomplete] = useState(false);
	const [fileAutocompleteIndex, setFileAutocompleteIndex] = useState(0);
	const [filePathSuggestions, setFilePathSuggestions] = useState<FilePathSuggestion[]>([]);
	const filePathCompleterRef = useRef<FilePathCompleter>(
		new FilePathCompleter(session.workingDirectory),
	);

	// Calculate filtered command suggestions
	const getFilteredCommands = (inputText: string): CommandSuggestion[] => {
		if (!inputText.startsWith('/')) {
			return [];
		}

		const query = inputText.slice(1).toLowerCase();
		if (query === '') {
			return AVAILABLE_COMMANDS;
		}

		return AVAILABLE_COMMANDS.filter(cmd => {
			// Match command or any alias
			if (cmd.command.toLowerCase().startsWith(query)) {
				return true;
			}

			if (cmd.aliases) {
				return cmd.aliases.some(alias => alias.toLowerCase().startsWith(query));
			}

			return false;
		});
	};

	const filteredCommands = getFilteredCommands(input);

	// Update autocomplete visibility based on input
	useEffect(() => {
		if (input.startsWith('/') && !isLoading && filteredCommands.length > 0) {
			setShowAutocomplete(true);
			setAutocompleteIndex(0);
		} else {
			setShowAutocomplete(false);
		}
	}, [input, isLoading, filteredCommands.length]);

	// Update file path autocomplete based on @ trigger
	useEffect(() => {
		if (isLoading) {
			setShowFileAutocomplete(false);
			return;
		}

		const fragment = filePathCompleterRef.current.extractFragment(input);
		if (fragment !== null) {
			const suggestions = filePathCompleterRef.current.getSuggestions(fragment);
			setFilePathSuggestions(suggestions);
			if (suggestions.length > 0) {
				setShowFileAutocomplete(true);
				setFileAutocompleteIndex(0);
			} else {
				setShowFileAutocomplete(false);
			}
		} else {
			setShowFileAutocomplete(false);
		}
	}, [input, isLoading]);

	// Handle initial query in non-interactive mode
	useEffect(() => {
		if (initialQuery) {
			void handleSubmit(initialQuery);
		}
	}, []);

	// Handle keyboard input
	useInput((char, key) => {
		// Handle file path autocomplete navigation
		if (showFileAutocomplete && filePathSuggestions.length > 0) {
			// Up arrow - Previous suggestion
			if (key.upArrow) {
				setFileAutocompleteIndex(prev =>
					prev > 0 ? prev - 1 : filePathSuggestions.length - 1,
				);
				return;
			}

			// Down arrow - Next suggestion
			if (key.downArrow) {
				setFileAutocompleteIndex(prev =>
					prev < filePathSuggestions.length - 1 ? prev + 1 : 0,
				);
				return;
			}

			// Tab - Complete file path (position cursor at end)
			if (key.tab && !key.shift) {
				const selected = filePathSuggestions[fileAutocompleteIndex];
				if (selected) {
					const fragment = filePathCompleterRef.current.extractFragment(input);
					if (fragment !== null) {
						const atIndex = input.lastIndexOf('@');
						const newInput = input.slice(0, atIndex + 1) + selected.relativePath + ' ';
						setShowFileAutocomplete(false);
						setShouldMoveCursorToEnd(true);
						setInput(newInput);
						setTimeout(() => setShouldMoveCursorToEnd(false), 0);
					}
				}
				return;
			}

			// Enter - Complete file path and submit
			if (key.return) {
				const selected = filePathSuggestions[fileAutocompleteIndex];
				if (selected) {
					const fragment = filePathCompleterRef.current.extractFragment(input);
					if (fragment !== null) {
						const atIndex = input.lastIndexOf('@');
						const newInput = input.slice(0, atIndex + 1) + selected.relativePath;
						setShowFileAutocomplete(false);
						void handleSubmit(newInput);
					}
				}
				return;
			}

			// Esc - Cancel autocomplete
			if (key.escape) {
				setShowFileAutocomplete(false);
				return;
			}
		}

		// Handle slash command autocomplete navigation
		if (showAutocomplete && filteredCommands.length > 0) {
			// Up arrow - Previous suggestion
			if (key.upArrow) {
				setAutocompleteIndex(prev =>
					prev > 0 ? prev - 1 : filteredCommands.length - 1,
				);
				return;
			}

			// Down arrow - Next suggestion
			if (key.downArrow) {
				setAutocompleteIndex(prev =>
					prev < filteredCommands.length - 1 ? prev + 1 : 0,
				);
				return;
			}

			// Tab - Complete command (position cursor at end)
			if (key.tab && !key.shift) {
				const selected = filteredCommands[autocompleteIndex];
				if (selected) {
					setShowAutocomplete(false);
					setShouldMoveCursorToEnd(true);
					setInput(`/${selected.command} `);
					// Reset flag after next render
					setTimeout(() => setShouldMoveCursorToEnd(false), 0);
				}
				return;
			}

			// Enter - Complete and execute command immediately
			if (key.return) {
				const selected = filteredCommands[autocompleteIndex];
				if (selected) {
					setShowAutocomplete(false);
					void handleSubmit(`/${selected.command}`);
				}
				return;
			}

			// Esc - Cancel autocomplete
			if (key.escape) {
				setShowAutocomplete(false);
				return;
			}
		}

		// Ctrl+C - Interrupt streaming/request (does NOT exit app)
		if (key.ctrl && char === 'c') {
			if (isStreaming && abortControllerRef.current) {
				abortControllerRef.current.abort();
				setIsStreaming(false);
				setStreamingContent('');
				setIsLoading(false);
			}
			// Note: Does not exit app when not streaming
		}

		// Ctrl+D - Exit app
		if (key.ctrl && char === 'd') {
			onExit();
			exit();
		}

		// Shift+Tab - Cycle models (works even with autocomplete)
		if (key.tab && key.shift) {
			cycleToPreviousModel();
		}
	});

	// Cycle to next model
	const cycleToNextModel = () => {
		const enabledModels = getEnabledModels(config);
		const {model, index} = getNextModel(enabledModels, selectedModelIndex);

		setSelectedModelIndex(index);
		setSession(prev => updateSessionModel(prev, model.id));
	};

	// Cycle to previous model
	const cycleToPreviousModel = () => {
		const enabledModels = getEnabledModels(config);
		const {model, index} = getPreviousModel(enabledModels, selectedModelIndex);

		setSelectedModelIndex(index);
		setSession(prev => updateSessionModel(prev, model.id));
	};

	// Handle model selection completion
	const handleModelSelectionComplete = async (selectedModelIds: string[]) => {
		if (!config.modelCache) {
			return;
		}

		try {
			const models = config.modelCache.models
				.filter(m => selectedModelIds.includes(m.id))
				.map(m => modelToConfig(m, true));

			const updatedConfig = await updateEnabledModels(config, models);
			setConfig(updatedConfig);

			// Update session if current model was deselected
			if (!selectedModelIds.includes(session.currentModel)) {
				const newModel = models[0];
				setSession(prev => updateSessionModel(prev, newModel.id));
				setSelectedModelIndex(0);
			} else {
				// Update index
				const newIndex = models.findIndex(m => m.id === session.currentModel);
				setSelectedModelIndex(newIndex >= 0 ? newIndex : 0);
			}

			setShowModelSelector(false);
		} catch (error_) {
			setError({
				type: 'unknown',
				message: error_ instanceof Error ? error_.message : 'Failed to update models',
			});
		}
	};

	// Handle approval
	const handleApprove = () => {
		if (pendingApproval) {
			pendingApproval.resolve(true);
			setPendingApproval(null);
		}
	};

	const handleReject = () => {
		if (pendingApproval) {
			pendingApproval.resolve(false);
			setPendingApproval(null);
		}
	};

	// Handle clear confirmation
	const handleClearConfirm = async () => {
		setPendingClearConfirmation(false);
		try {
			const cleared = await clearConversationHistory(session);
			setSession(cleared);
			setError({
				type: 'unknown',
				message: `✅ Conversation cleared (${session.messages.length} message${session.messages.length !== 1 ? 's' : ''} removed)`,
			});
		} catch (error_) {
			setError({
				type: 'unknown',
				message: `Failed to clear conversation: ${error_ instanceof Error ? error_.message : 'Unknown error'}`,
			});
		}
	};

	const handleClearCancel = () => {
		setPendingClearConfirmation(false);
	};

	// Handle compact confirmation
	const handleCompactConfirm = async () => {
		setPendingCompactConfirmation(false);
		try {
			const result = await compactConversation(
				session,
				COMPACTION_CONFIG,
				config.apiKey,
			);

			// Update session with compacted messages
			const compacted: Session = {
				...session,
				messages: [
					...(session.messages[0]?.role === 'system'
						? [session.messages[0]]
						: []),
					result.summaryMessage,
					...result.preservedMessages,
				],
			};

			setSession(compacted);
			setError({
				type: 'unknown',
				message: `✅ Compacted! ${result.reductionPercentage.toFixed(1)}% reduction (saved ${result.originalTokenEstimate - result.compactedTokenEstimate} tokens)`,
			});
		} catch (error_) {
			setError({
				type: 'unknown',
				message: `Failed to compact: ${error_ instanceof Error ? error_.message : 'Unknown error'}`,
			});
		}
	};

	const handleCompactCancel = () => {
		setPendingCompactConfirmation(false);
	};

	// Handle message submission
	const handleSubmit = async (text: string) => {
		if (!text.trim() || isLoading) {
			return;
		}

		// Handle slash commands
		if (text.startsWith('/')) {
			const command = text.slice(1).toLowerCase();

			if (command === 'model' || command === 'models') {
				setShowModelSelector(true);
				setInput('');
				return;
			}

			if (command === 'clear' || command === 'reset') {
				setPendingClearConfirmation(true);
				setInput('');
				return;
			}

			if (command === 'version') {
				setInput('');
				try {
					// Import package.json dynamically
					const {createRequire} = await import('node:module');
					const require = createRequire(import.meta.url);
					const packageJson = require('../../package.json') as {version: string};
					setError({
						type: 'unknown',
						message: `YOLO CLI version ${packageJson.version}`,
					});
				} catch {
					setError({
						type: 'unknown',
						message: 'Version information unavailable',
					});
				}

				return;
			}

			if (command === 'new') {
				setInput('');
				try {
					const newSession = await createNewSession(
						session.workingDirectory,
						session.currentModel,
					);
					setSession(newSession);
					setError({
						type: 'unknown',
						message: `✅ New session created (ID: ${newSession.id.slice(0, 8)})`,
					});
				} catch (error_) {
					setError({
						type: 'unknown',
						message: `Failed to create new session: ${error_ instanceof Error ? error_.message : 'Unknown error'}`,
					});
				}

				return;
			}

			if (command === 'compact') {
				setInput('');
				if (session.messages.length < COMPACTION_CONFIG.minimumMessagesToCompact) {
					setError({
						type: 'unknown',
						message: `Compaction not necessary (only ${session.messages.length} message${session.messages.length !== 1 ? 's' : ''})`,
					});
					return;
				}

				setPendingCompactConfirmation(true);
				return;
			}

			if (command === 'help' || command === 'h' || command === '?') {
				setInput('');
				setError({
					type: 'unknown',
					message: `Available commands:
  /model - Select or change AI model
  /clear - Clear conversation history (alias: /reset)
  /new - Start a new session
  /compact - Summarize long conversations
  /version - Show YOLO CLI version
  /help - Show this help message (aliases: /h, /?)
  /exit - Exit YOLO CLI (alias: /quit)

Keyboard shortcuts:
  Ctrl+C - Interrupt streaming response
  Ctrl+D - Exit YOLO CLI
  Tab - Cycle through models`,
				});
				return;
			}

			if (command === 'exit' || command === 'quit') {
				onExit();
				exit();
				return;
			}

			// Unknown command
			setInput('');
			setError({
				type: 'unknown',
				message: `Unknown command: /${command}. Type /help for available commands.`,
			});
			return;
		}

		try {
			setError(null);
			setIsLoading(true);

			// Create AbortController for cancellation
			const abortController = new AbortController();
			abortControllerRef.current = abortController;

			// Add user message
			const userMessage = addUserMessage(session, text.trim());
			await saveMessage(session.workingDirectory, userMessage);
			setSession({...session});

			// Clear input
			setInput('');

			// Prepare API client and get tool definitions
			const client = new OpenRouterClient({apiKey: config.apiKey});

			// Create approval request handler
			const requestApproval = async (
				action: string,
				details: string,
			): Promise<boolean> => {
				// Auto-approve if enabled in preferences
				if (config.preferences.autoApprove) {
					return true;
				}

				// Request user approval via UI
				return new Promise<boolean>(resolve => {
					setPendingApproval({action, details, resolve});
				});
			};

			// Set tool executor context to session's working directory
			toolExecutor.setContext({
				workingDirectory: session.workingDirectory,
				requestApproval,
			});

			// Register MCP tools if available
			if (mcpManager) {
				const mcpTools = await mcpManager.getTools();
				const toolsFormatted = mcpTools.map(mcpTool => ({
					definition: {
						type: 'function' as const,
						function: {
							name: mcpTool.name,
							description: mcpTool.description,
							parameters: mcpTool.inputSchema as any,
						},
					},
					executor: async (args: Record<string, unknown>) => {
						const result = await mcpManager.callTool(mcpTool.name, args);
						if (!result.success) {
							return {
								success: false,
								output: '',
								error: result.error?.message ?? 'Tool execution failed',
							};
						}

						// Convert MCP content to string output
						const output = result.content
							? result.content
									.map(c => (c.type === 'text' ? c.text : ''))
									.join('\n')
							: '';

						return {
							success: true,
							output,
							error: undefined,
						};
					},
				}));

				toolExecutor.registerTools(toolsFormatted);
			}

			const tools = toolExecutor.getToolDefinitions();

			// Tool execution loop - continue until no more tool calls
			let continueLoop = true;
			const MAX_ITERATIONS = 10; // Prevent infinite loops
			let iterations = 0;

			while (continueLoop && iterations < MAX_ITERATIONS) {
				iterations++;

				// Prepare messages for API request
				const apiMessages: APIMessage[] = session.messages.map(msg => {
					const baseMessage: APIMessage = {
						role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
						content: msg.content,
					};

					// Add tool-specific fields for tool role messages
					if (msg.role === 'tool' && msg.metadata) {
						baseMessage.tool_call_id = msg.metadata.toolCallId;
						baseMessage.name = msg.metadata.toolName;
					}

					// Add tool_calls for assistant messages
					if (msg.role === 'assistant' && msg.metadata?.toolCalls) {
						baseMessage.tool_calls = msg.metadata.toolCalls;
					}

					return baseMessage;
				});

				// Add system message with working directory context (only once per conversation)
				const hasSystemMessage = apiMessages.some(msg => msg.role === 'system');
				if (!hasSystemMessage) {
					const systemMessage: APIMessage = {
						role: 'system',
						content: `You are an AI code assistant with access to tools for file operations and shell commands.

# Working Directory

The current working directory is: ${session.workingDirectory}

Every file system operation will be relative to the working directory if you do not explicitly specify the absolute path.

# File Paths - IMPORTANT

- read_file and write_file require ABSOLUTE paths
- Always use the full path: ${session.workingDirectory}/filename
- Example: To read package.json, use: ${session.workingDirectory}/package.json
- For bash commands, you're already in the working directory (no need for absolute paths)

# Available Tools

- read_file: Read file contents (requires absolute path)
- write_file: Write/create files (requires absolute path within working directory)
- str_replace_file: Make surgical edits by replacing exact text matches (requires absolute path)
- bash: Execute shell commands (runs in working directory)
- glob: Find files by pattern
- grep: Search file contents
- think: Organize your thoughts and reasoning (no state changes)
- set_todo_list: Track tasks with structured status (pending/in_progress/completed)

Use 'bash' with 'ls' to list files in the current directory.`,
					};

					// Prepend system message
					apiMessages.unshift(systemMessage);
				}

				// Stream response
				setIsStreaming(true);
				setStreamingContent('');

				const startTime = Date.now();
				let fullContent = '';
				let toolCalls: ToolCall[] | undefined;

				const stream = client.streamChatCompletion(
					{
						model: session.currentModel,
						messages: apiMessages,
						tools,
					},
					abortController.signal,
				);

				for await (const chunk of stream) {
					const delta = chunk.choices[0]?.delta;

					// Accumulate content
					if (delta?.content) {
						fullContent += delta.content;
						setStreamingContent(fullContent);
					}

					// Accumulate tool calls
					if (delta?.tool_calls) {
						if (!toolCalls) {
							toolCalls = [];
						}
						// Merge tool calls (streaming may send them in parts)
						for (const tc of delta.tool_calls) {
							const index = tc.index ?? toolCalls.length;
							if (!toolCalls[index]) {
								toolCalls[index] = tc;
							} else {
								// Append arguments
								if (tc.function?.arguments) {
									toolCalls[index].function.arguments += tc.function.arguments;
								}
							}
						}
					}

					// Check for finish
					if (chunk.choices[0]?.finish_reason) {
						break;
					}
				}

				const duration = Date.now() - startTime;

				setIsStreaming(false);
				setStreamingContent('');

				// Check if we have tool calls to execute
				if (toolCalls && toolCalls.length > 0) {
					// Add assistant message with tool calls
					const assistantMessage = addAssistantMessage(
						session,
						fullContent || '',
						session.currentModel,
						{
							streamingDuration: duration,
							toolCalls,
						},
					);
					await saveMessage(session.workingDirectory, assistantMessage);
					setSession({...session});

					// Execute tool calls
					setIsExecutingTools(true);

					// Execute tools one by one with feedback
					const toolResults: Array<{
						tool_call_id: string;
						name: string;
						content: string;
					}> = [];

					for (const toolCall of toolCalls) {
						setCurrentTool(toolCall.function.name);
						const result = await toolExecutor.executeTool(toolCall);
						toolResults.push({
							tool_call_id: toolCall.id,
							name: toolCall.function.name,
							content: result.content,
						});
					}

					setCurrentTool('');
					setIsExecutingTools(false);

					// Add tool result messages
					for (const result of toolResults) {
						const toolMessage = {
							id: `msg-${Date.now()}-${Math.random()}`,
							role: 'tool' as const,
							content: result.content,
							timestamp: Date.now(),
							metadata: {
								toolCallId: result.tool_call_id,
								toolName: result.name,
							},
						};
						session.messages.push(toolMessage);
						await saveMessage(session.workingDirectory, toolMessage);
					}
					setSession({...session});

					// Continue loop to get next response
					continueLoop = true;
				} else {
					// No tool calls - add final assistant message and exit loop
					const assistantMessage = addAssistantMessage(
						session,
						fullContent,
						session.currentModel,
						{
							streamingDuration: duration,
						},
					);
					await saveMessage(session.workingDirectory, assistantMessage);
					setSession({...session});

					continueLoop = false;
				}
			}

			setIsLoading(false);

			// Exit if non-interactive mode
			if (initialQuery) {
				exit();
			}
		} catch (error_) {
			// Ignore abort errors (user cancelled with Ctrl+C)
			if (error_ instanceof Error && error_.name === 'AbortError') {
				setIsStreaming(false);
				setStreamingContent('');
				setIsLoading(false);
				return;
			}

			const errorInfo: ErrorInfo = {
				type: 'unknown',
				message:
					error_ instanceof Error ? error_.message : 'Failed to send message',
			};

			setError(errorInfo);
			setIsStreaming(false);
			setStreamingContent('');
			setIsLoading(false);
		} finally {
			// Clean up abort controller
			abortControllerRef.current = null;
		}
	};

	const enabledModels = getEnabledModels(config);
	const currentModel = enabledModels[selectedModelIndex];

	// Show model selector
	if (showModelSelector) {
		if (!config.modelCache) {
			return (
				<Box flexDirection="column" padding={1}>
					<Text color="red">Model cache not available. Please restart setup.</Text>
				</Box>
			);
		}

		const currentlyEnabledIds = enabledModels.map(m => m.id);

		return (
			<Box flexDirection="column" padding={1}>
				<Box marginBottom={1}>
					<Text dimColor>Press Esc to cancel and return to chat</Text>
				</Box>
				<ModelSelector
					models={config.modelCache.models}
					onComplete={handleModelSelectionComplete}
					onCancel={() => setShowModelSelector(false)}
					initialSelectedIds={currentlyEnabledIds}
				/>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" height="100%">
			<Box flexDirection="column" flexGrow={1}>
				<MessageList
					messages={session.messages}
					streamingContent={isStreaming ? streamingContent : undefined}
					error={error}
				/>
			</Box>

			{pendingApproval && (
				<ApprovalPrompt
					action={pendingApproval.action}
					details={pendingApproval.details}
					onApprove={handleApprove}
					onReject={handleReject}
				/>
			)}

			{pendingClearConfirmation && (
				<ConfirmClearPrompt
					messageCount={session.messages.length}
					onConfirm={handleClearConfirm}
					onCancel={handleClearCancel}
				/>
			)}

			{pendingCompactConfirmation && (
				<ConfirmCompactPrompt
					originalMessageCount={session.messages.length}
					estimatedCompactedCount={1 + COMPACTION_CONFIG.preserveRecentCount}
					originalTokenEstimate={estimateConversationTokensLocal(
						session.messages,
					)}
					estimatedCompactedTokens={
						estimateConversationTokensLocal(
							session.messages.slice(-COMPACTION_CONFIG.preserveRecentCount),
						) + 500
					}
					reductionPercentage={
						((estimateConversationTokensLocal(session.messages) -
							(estimateConversationTokensLocal(
								session.messages.slice(-COMPACTION_CONFIG.preserveRecentCount),
							) +
								500)) /
							estimateConversationTokensLocal(session.messages)) *
						100
					}
					onConfirm={handleCompactConfirm}
					onCancel={handleCompactCancel}
				/>
			)}

			{!initialQuery && (
				<>
					{showAutocomplete && (
						<CommandAutocomplete
							suggestions={filteredCommands}
							selectedIndex={autocompleteIndex}
							inputText={input}
						/>
					)}

					{showFileAutocomplete && (
						<FilePathAutocomplete
							suggestions={filePathSuggestions}
							selectedIndex={fileAutocompleteIndex}
							fragment={filePathCompleterRef.current.extractFragment(input) ?? ''}
						/>
					)}

					<InputBox
						value={input}
						onChange={setInput}
						onSubmit={handleSubmit}
						isLoading={
							isLoading ||
							pendingApproval !== null ||
							pendingClearConfirmation ||
							pendingCompactConfirmation
						}
						placeholder="Type your message... (or /help for commands)"
						moveCursorToEnd={shouldMoveCursorToEnd}
					/>

					<StatusBar
						model={currentModel?.name ?? session.currentModel}
						contextUsage={0}
						showContextUsage={config.preferences.showContextUsage}
						isExecutingTools={isExecutingTools}
						currentTool={currentTool}
					/>
				</>
			)}
		</Box>
	);
}
