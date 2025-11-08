/**
 * Setup wizard component - first-run configuration
 */

import React, {useState} from 'react';
import {Box, Text} from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import type {Configuration} from '../types/index.js';
import {
	createDefaultConfig,
	setConfig,
	refreshModelCache,
} from '../services/config.js';
import {validateApiKey} from '../utils/validation.js';
import {OpenRouterClient} from '../services/openrouter.js';
import {ModelSelector} from './ModelSelector.js';

export interface SetupWizardProps {
	onComplete: (config: Configuration) => void;
}

type SetupStep = 'apiKey' | 'validateKey' | 'fetchModels' | 'selectModels' | 'complete';

export function SetupWizard({onComplete}: SetupWizardProps) {
	const [step, setStep] = useState<SetupStep>('apiKey');
	const [apiKey, setApiKey] = useState('');
	const [error, setError] = useState('');
	const [config, setConfigState] = useState<Configuration | null>(null);

	// Handle API key submission
	const handleApiKeySubmit = async (key: string) => {
		setError('');

		if (!validateApiKey(key)) {
			setError(
				'Invalid API key format. Expected format: sk-or-v1-...',
			);
			return;
		}

		setApiKey(key);
		setStep('validateKey');

		try {
			// Validate API key
			const client = new OpenRouterClient({apiKey: key});
			await client.validateApiKey();

			// Create default config
			const newConfig = await createDefaultConfig(key);
			setConfigState(newConfig);

			// Fetch models
			setStep('fetchModels');
			const configWithModels = await refreshModelCache(newConfig);
			setConfigState(configWithModels);

			// Move to model selection
			setStep('selectModels');
		} catch (error_) {
			setError(
				error_ instanceof Error
					? error_.message
					: 'Failed to validate API key',
			);
			setStep('apiKey');
			setApiKey('');
		}
	};

	// Handle model selection completion
	const handleModelsSelected = async (selectedModelIds: string[]) => {
		if (!config || !config.modelCache) {
			return;
		}

		try {
			const models = config.modelCache.models
				.filter(m => selectedModelIds.includes(m.id))
				.map(m => ({
					id: m.id,
					name: m.name,
					enabled: true,
				}));

			const updatedConfig: Configuration = {
				...config,
				models,
				defaultModel: models[0]?.id,
			};

			await setConfig(updatedConfig);
			setStep('complete');
			onComplete(updatedConfig);
		} catch (error_) {
			setError(
				error_ instanceof Error ? error_.message : 'Failed to save configuration',
			);
		}
	};

	return (
		<Box flexDirection="column" paddingX={2} paddingY={1}>
			<Box marginBottom={1}>
				<Text bold color="cyan">
					Welcome to YOLO CLI!
				</Text>
			</Box>

			{step === 'apiKey' && (
				<Box flexDirection="column">
					<Box marginBottom={1}>
						<Text>Enter your OpenRouter API key:</Text>
					</Box>
					<Box>
						<Text color="cyan">{'> '}</Text>
						<TextInput
							value={apiKey}
							onChange={setApiKey}
							onSubmit={handleApiKeySubmit}
							mask="*"
						/>
					</Box>
					{error && (
						<Box marginTop={1}>
							<Text color="red">{error}</Text>
						</Box>
					)}
					<Box marginTop={1}>
						<Text dimColor>
							Get your API key at: https://openrouter.ai/keys
						</Text>
					</Box>
				</Box>
			)}

			{step === 'validateKey' && (
				<Box>
					<Text color="cyan">
						<Spinner type="dots" />
					</Text>
					<Text> Validating API key...</Text>
				</Box>
			)}

			{step === 'fetchModels' && (
				<Box>
					<Text color="cyan">
						<Spinner type="dots" />
					</Text>
					<Text> Fetching available models...</Text>
				</Box>
			)}

			{step === 'selectModels' && config?.modelCache && (
				<ModelSelector
					models={config.modelCache.models}
					onComplete={handleModelsSelected}
				/>
			)}

			{step === 'complete' && (
				<Box flexDirection="column">
					<Text color="green">✓ Setup complete!</Text>
					<Text dimColor>Starting YOLO CLI...</Text>
				</Box>
			)}
		</Box>
	);
}
