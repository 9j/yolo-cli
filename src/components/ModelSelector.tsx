/**
 * Model selector component - for setup wizard with search
 */

import React, {useState, useMemo, useEffect} from 'react';
import {Box, Text, useInput} from 'ink';
import TextInput from 'ink-text-input';
import type {Model} from '../types/index.js';

export interface ModelSelectorProps {
	models: Model[];
	onComplete: (selectedModelIds: string[]) => void;
	onCancel?: () => void;
	initialSelectedIds?: string[];
}

export function ModelSelector({
	models,
	onComplete,
	onCancel,
	initialSelectedIds,
}: ModelSelectorProps) {
	const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
		// Use provided initial selection or pre-select popular models
		if (initialSelectedIds && initialSelectedIds.length > 0) {
			return new Set(initialSelectedIds);
		}

		// Try to pre-select popular models using partial matching
		const popularPatterns = [
			'claude-3-opus',
			'claude-3.5-sonnet',
			'gpt-4-turbo',
			'gpt-4o',
		];

		const preSelected = models
			.filter(m =>
				popularPatterns.some(pattern =>
					m.id.toLowerCase().includes(pattern.toLowerCase()),
				),
			)
			.slice(0, 3) // Limit to 3 models
			.map(m => m.id);

		return new Set(preSelected);
	});
	const [cursor, setCursor] = useState(0);
	const [searchQuery, setSearchQuery] = useState('');
	const [isSearchMode, setIsSearchMode] = useState(false); // Start in selection mode

	// Filter models based on search query
	const filteredModels = useMemo(() => {
		let filtered: Model[];

		if (!searchQuery.trim()) {
			// Show all models by default
			filtered = models;
		} else {
			const query = searchQuery.toLowerCase();
			filtered = models.filter(
				m =>
					m.id.toLowerCase().includes(query) ||
					m.name.toLowerCase().includes(query) ||
					(m.description && m.description.toLowerCase().includes(query)),
			);
		}

		// Sort: selected models first, then alphabetically
		return filtered.sort((a, b) => {
			const aSelected = selectedIds.has(a.id);
			const bSelected = selectedIds.has(b.id);

			if (aSelected && !bSelected) return -1;
			if (!aSelected && bSelected) return 1;

			return a.name.localeCompare(b.name);
		});
	}, [models, searchQuery, selectedIds]);

	// Reset cursor when filtered models change
	useEffect(() => {
		if (cursor >= filteredModels.length) {
			setCursor(Math.max(0, filteredModels.length - 1));
		}
	}, [filteredModels.length, cursor]);

	useInput((input, key) => {
		// In search mode - let TextInput handle everything
		if (isSearchMode) {
			// Only handle Escape here (TextInput handles Enter via onSubmit)
			if (key.escape) {
				setIsSearchMode(false);
				setCursor(0);
			}

			return;
		}

		// Escape - cancel selection (only in selection mode)
		if (key.escape) {
			if (onCancel) {
				onCancel();
			}

			return;
		}

		// In selection mode
		// / - enter search mode
		if (input === '/') {
			setIsSearchMode(true);
			return;
		}

		// Arrow up
		if (key.upArrow) {
			setCursor(prev => Math.max(0, prev - 1));
		}

		// Arrow down
		if (key.downArrow) {
			setCursor(prev => Math.min(filteredModels.length - 1, prev + 1));
		}

		// Space - toggle selection
		if (input === ' ') {
			if (filteredModels.length === 0) {
				return;
			}

			const modelId = filteredModels[cursor].id;
			setSelectedIds(prev => {
				const newSet = new Set(prev);
				if (newSet.has(modelId)) {
					newSet.delete(modelId);
				} else {
					newSet.add(modelId);
				}

				return newSet;
			});
		}

		// Enter - confirm selection
		if (key.return) {
			if (selectedIds.size === 0) {
				// Must select at least one model
				return;
			}

			onComplete([...selectedIds]);
		}
	});

	return (
		<Box flexDirection="column">
			<Box marginBottom={1}>
				<Text bold>Select models to enable</Text>
			</Box>

			{/* Search box */}
			<Box marginBottom={1} flexDirection="column">
				<Box>
					<Text dimColor>Search: </Text>
					{isSearchMode ? (
						<TextInput
							key="search-input"
							value={searchQuery}
							onChange={setSearchQuery}
							onSubmit={() => {
								setIsSearchMode(false);
								setCursor(0);
							}}
							placeholder="Type to search..."
							focus={true}
						/>
					) : (
						<Text>{searchQuery || '(press / to search)'}</Text>
					)}
				</Box>
				{isSearchMode ? (
					<Text dimColor>Press Enter or Esc to exit search</Text>
				) : (
					<Text dimColor>
						/ to search | ↑↓ navigate | Space toggle | Enter confirm
					</Text>
				)}
			</Box>

			{/* Model list */}
			<Box flexDirection="column" marginBottom={1}>
				{filteredModels.length === 0 ? (
					<Text color="yellow">No models found. Try a different search.</Text>
				) : (
					filteredModels.slice(0, 20).map((model, index) => {
						const isSelected = selectedIds.has(model.id);
						const isCursor = !isSearchMode && cursor === index;

						return (
							<Box key={model.id}>
								<Text color={isCursor ? 'cyan' : undefined}>
									{isCursor ? '>' : ' '}{' '}
								</Text>
								<Text color={isSelected ? 'green' : undefined}>
									{isSelected ? '[x]' : '[ ]'}
								</Text>
								<Text color={isCursor ? 'cyan' : undefined}> {model.name}</Text>
								<Text dimColor> ({model.id})</Text>
							</Box>
						);
					})
				)}
				{filteredModels.length > 20 && (
					<Text dimColor>
						... and {filteredModels.length - 20} more (use search to narrow down)
					</Text>
				)}
			</Box>

			{/* Status */}
			<Box marginTop={1} flexDirection="column">
				<Text color={selectedIds.size > 0 ? 'green' : 'yellow'}>
					{selectedIds.size} model{selectedIds.size === 1 ? '' : 's'} selected
					{selectedIds.size === 0 && ' (need at least 1)'}
				</Text>
			</Box>
		</Box>
	);
}
