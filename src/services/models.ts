/**
 * Model metadata and selection management
 */

import type {Model, ModelConfig, Configuration} from '../types/index.js';
import {getModels, updateModelLastUsed} from './config.js';
import {formatModelName} from '../utils/formatting.js';

/**
 * Get model by ID from cache
 */
export async function getModelById(
	config: Configuration,
	modelId: string,
): Promise<Model | null> {
	const models = await getModels(config);
	return models.find(m => m.id === modelId) ?? null;
}

/**
 * Search models by name or ID
 */
export async function searchModels(
	config: Configuration,
	query: string,
): Promise<Model[]> {
	const models = await getModels(config);
	const lowerQuery = query.toLowerCase();

	return models.filter(
		m =>
			m.id.toLowerCase().includes(lowerQuery) ||
			m.name.toLowerCase().includes(lowerQuery),
	);
}

/**
 * Get popular models (commonly used ones)
 */
export async function getPopularModels(config: Configuration): Promise<Model[]> {
	const models = await getModels(config);

	// Filter for popular models (common providers and well-known models)
	const popularIds = [
		'anthropic/claude-3-opus',
		'anthropic/claude-3.5-sonnet',
		'anthropic/claude-3-sonnet',
		'openai/gpt-4-turbo',
		'openai/gpt-4',
		'openai/gpt-3.5-turbo',
		'google/gemini-pro-1.5',
		'meta-llama/llama-3-70b',
	];

	return models.filter(m => popularIds.includes(m.id));
}

/**
 * Convert Model to ModelConfig
 */
export function modelToConfig(model: Model, enabled = true): ModelConfig {
	return {
		id: model.id,
		name: model.name || formatModelName(model.id),
		enabled,
	};
}

/**
 * Get next model in cycling order
 */
export function getNextModel(
	enabledModels: ModelConfig[],
	currentIndex: number,
): {model: ModelConfig; index: number} {
	if (enabledModels.length === 0) {
		throw new Error('No enabled models available');
	}

	const nextIndex = (currentIndex + 1) % enabledModels.length;
	return {
		model: enabledModels[nextIndex],
		index: nextIndex,
	};
}

/**
 * Get previous model in cycling order
 */
export function getPreviousModel(
	enabledModels: ModelConfig[],
	currentIndex: number,
): {model: ModelConfig; index: number} {
	if (enabledModels.length === 0) {
		throw new Error('No enabled models available');
	}

	const prevIndex = (currentIndex - 1 + enabledModels.length) % enabledModels.length;
	return {
		model: enabledModels[prevIndex],
		index: prevIndex,
	};
}

/**
 * Get model index by ID
 */
export function getModelIndex(
	enabledModels: ModelConfig[],
	modelId: string,
): number {
	return enabledModels.findIndex(m => m.id === modelId);
}

/**
 * Record model usage
 */
export async function recordModelUsage(
	config: Configuration,
	modelId: string,
): Promise<Configuration> {
	return updateModelLastUsed(config, modelId);
}

/**
 * Sort models by last used (most recent first)
 */
export function sortModelsByUsage(models: ModelConfig[]): ModelConfig[] {
	return [...models].sort((a, b) => {
		if (!a.lastUsed && !b.lastUsed) {
			return 0;
		}

		if (!a.lastUsed) {
			return 1;
		}

		if (!b.lastUsed) {
			return -1;
		}

		return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
	});
}

/**
 * Get model context length
 */
export async function getModelContextLength(
	config: Configuration,
	modelId: string,
): Promise<number> {
	const model = await getModelById(config, modelId);
	return model?.context_length ?? 0;
}

/**
 * Validate that all enabled models exist in cache
 */
export async function validateEnabledModels(
	config: Configuration,
): Promise<boolean> {
	const models = await getModels(config);
	const modelIds = new Set(models.map(m => m.id));

	for (const enabledModel of config.models) {
		if (enabledModel.enabled && !modelIds.has(enabledModel.id)) {
			return false;
		}
	}

	return true;
}

/**
 * Get model pricing information
 */
export async function getModelPricing(
	config: Configuration,
	modelId: string,
): Promise<{prompt: string; completion: string} | null> {
	const model = await getModelById(config, modelId);
	return model?.pricing ?? null;
}
