/**
 * Configuration management service
 */

import type {Configuration, Model, ModelConfig} from '../types/index.js';
import {
	DEFAULT_PREFERENCES,
	CURRENT_CONFIG_VERSION,
	MODEL_CACHE_TTL,
} from '../types/index.js';
import {loadConfig, saveConfig, ensureDir, getConfigDir} from '../utils/storage.js';
import {validateConfig, validateApiKey} from '../utils/validation.js';
import {OpenRouterClient} from './openrouter.js';

/**
 * Initialize a new configuration
 */
export async function createDefaultConfig(apiKey: string): Promise<Configuration> {
	return {
		version: CURRENT_CONFIG_VERSION,
		apiKey,
		models: [],
		preferences: {...DEFAULT_PREFERENCES},
	};
}

/**
 * Load configuration from disk or return null if not found
 */
export async function getConfig(): Promise<Configuration | null> {
	return loadConfig();
}

/**
 * Save configuration to disk
 */
export async function setConfig(config: Configuration): Promise<void> {
	if (!validateConfig(config)) {
		throw new Error('Invalid configuration');
	}

	await saveConfig(config);
}

/**
 * Update API key in configuration
 */
export async function updateApiKey(
	config: Configuration,
	apiKey: string,
): Promise<Configuration> {
	if (!validateApiKey(apiKey)) {
		throw new Error('Invalid API key format');
	}

	const updatedConfig = {
		...config,
		apiKey,
	};

	await setConfig(updatedConfig);
	return updatedConfig;
}

/**
 * Update enabled models in configuration
 */
export async function updateEnabledModels(
	config: Configuration,
	modelConfigs: ModelConfig[],
): Promise<Configuration> {
	if (modelConfigs.length === 0) {
		throw new Error('At least one model must be enabled');
	}

	const modelIds = modelConfigs.map(m => m.id);

	// Clear defaultModel if it's not in the new model list
	const defaultModel = config.defaultModel && modelIds.includes(config.defaultModel)
		? config.defaultModel
		: undefined;

	const updatedConfig = {
		...config,
		models: modelConfigs,
		defaultModel,
	};

	await setConfig(updatedConfig);
	return updatedConfig;
}

/**
 * Set default model
 */
export async function setDefaultModel(
	config: Configuration,
	modelId: string,
): Promise<Configuration> {
	const modelExists = config.models.some(m => m.id === modelId);

	if (!modelExists) {
		throw new Error(`Model ${modelId} not found in enabled models`);
	}

	const updatedConfig = {
		...config,
		defaultModel: modelId,
	};

	await setConfig(updatedConfig);
	return updatedConfig;
}

/**
 * Get list of enabled models
 */
export function getEnabledModels(config: Configuration): ModelConfig[] {
	return config.models.filter(m => m.enabled);
}

/**
 * Get current/default model
 */
export function getCurrentModel(config: Configuration): ModelConfig | null {
	const enabledModels = getEnabledModels(config);

	if (enabledModels.length === 0) {
		return null;
	}

	// Return default model if set
	if (config.defaultModel) {
		const defaultModel = enabledModels.find(m => m.id === config.defaultModel);
		if (defaultModel) {
			return defaultModel;
		}
	}

	// Return first enabled model
	return enabledModels[0];
}

/**
 * Refresh model cache from API
 */
export async function refreshModelCache(
	config: Configuration,
): Promise<Configuration> {
	const client = new OpenRouterClient({apiKey: config.apiKey});
	const response = await client.listModels();

	const updatedConfig = {
		...config,
		modelCache: {
			lastUpdated: new Date().toISOString(),
			ttl: MODEL_CACHE_TTL,
			models: response.data as Model[],
		},
	};

	// Don't save yet - config will be saved after user selects models
	return updatedConfig;
}

/**
 * Check if model cache is expired
 */
export function isModelCacheExpired(config: Configuration): boolean {
	if (!config.modelCache) {
		return true;
	}

	const lastUpdated = new Date(config.modelCache.lastUpdated).getTime();
	const now = Date.now();
	const ttl = config.modelCache.ttl;

	return now - lastUpdated > ttl;
}

/**
 * Get models from cache or refresh if expired
 */
export async function getModels(config: Configuration): Promise<Model[]> {
	if (!config.modelCache || isModelCacheExpired(config)) {
		const updatedConfig = await refreshModelCache(config);
		return updatedConfig.modelCache?.models ?? [];
	}

	return config.modelCache.models;
}

/**
 * Update last used timestamp for a model
 */
export async function updateModelLastUsed(
	config: Configuration,
	modelId: string,
): Promise<Configuration> {
	const models = config.models.map(m =>
		m.id === modelId ? {...m, lastUsed: new Date().toISOString()} : m,
	);

	const updatedConfig = {
		...config,
		models,
	};

	await setConfig(updatedConfig);
	return updatedConfig;
}

/**
 * Migrate configuration from old version to current
 */
export function migrateConfig(oldConfig: Configuration): Configuration {
	// For now, just ensure all required fields exist
	return {
		version: CURRENT_CONFIG_VERSION,
		apiKey: oldConfig.apiKey,
		models: oldConfig.models || [],
		defaultModel: oldConfig.defaultModel,
		preferences: {
			...DEFAULT_PREFERENCES,
			...oldConfig.preferences,
		},
		modelCache: oldConfig.modelCache,
	};
}

/**
 * Ensure configuration directory exists
 */
export async function ensureConfigDir(): Promise<void> {
	const configDir = getConfigDir();
	await ensureDir(configDir);
}
