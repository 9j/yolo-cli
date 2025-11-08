/**
 * Central export point for all YOLO CLI type definitions
 */

// Configuration types
export type {
	Configuration,
	ModelConfig,
	UserPreferences,
	ModelCache,
	Model,
} from './config.js';
export {
	DEFAULT_PREFERENCES,
	MODEL_CACHE_TTL,
	CURRENT_CONFIG_VERSION,
} from './config.js';

// Session and conversation types
export type {
	Session,
	SessionMetadata,
	Conversation,
	Message,
	MessageMetadata,
	ErrorInfo,
	AppState,
	ModelSelectorState,
} from './session.js';

// OpenRouter API types
export type {
	ChatCompletionRequest,
	APIMessage,
	ChatCompletionResponse,
	ChatCompletionChoice,
	TokenUsage,
	ChatCompletionChunk,
	ChatCompletionChunkChoice,
	ModelsListResponse,
	ModelInfo,
	ErrorResponse,
	ApiKeyValidationResponse,
} from './openrouter.js';

// Tool/Function calling types
export type {
	ToolDefinition,
	ToolParameter,
	ToolCall,
	ToolResult,
	ToolExecutionResult,
	ToolExecutor,
	Tool,
} from './tools.js';

// Todo management types
export type {Todo, TodoStatus, TodoList} from './todos.js';

// Slash command system types
export type {
	SlashCommand,
	CommandContext,
	SessionMetadataFile,
	SessionInfo,
	CompactionResult,
	CompactionConfig,
} from './slash-commands.js';
export {COMPACTION_CONFIG, SESSION_METADATA_VERSION} from './slash-commands.js';
