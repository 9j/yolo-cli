/**
 * Status bar component - displays current model, context usage, and todo counts
 */

import React from 'react';
import {Box, Text} from 'ink';
import {formatContextUsage} from '../utils/formatting.js';

export interface TodoCounts {
	pending: number;
	in_progress: number;
	completed: number;
}

export interface StatusBarProps {
	model: string;
	contextUsage: number;
	showContextUsage?: boolean;
	isExecutingTools?: boolean;
	currentTool?: string;
	todoCounts?: TodoCounts | null;
}

export function StatusBar({
	model,
	contextUsage,
	showContextUsage = true,
	isExecutingTools = false,
	currentTool = '',
	todoCounts = null,
}: StatusBarProps) {
	// Format todo counts for display
	const formatTodoCounts = React.useMemo(() => {
		if (!todoCounts) return null;

		const total = todoCounts.pending + todoCounts.in_progress + todoCounts.completed;
		if (total === 0) return null;

		const parts: string[] = [];
		if (todoCounts.pending > 0) parts.push(`${todoCounts.pending} pending`);
		if (todoCounts.in_progress > 0) parts.push(`${todoCounts.in_progress} in progress`);
		if (todoCounts.completed > 0) parts.push(`${todoCounts.completed} completed`);

		return parts.join(', ');
	}, [todoCounts]);

	return (
		<Box
			paddingX={1}
			paddingY={0}
			borderStyle="single"
			borderColor="gray"
			justifyContent="space-between"
		>
			<Text dimColor>Tab: cycle models | Ctrl+D: exit | Ctrl+C: interrupt</Text>
			<Box>
				{isExecutingTools && (
					<Text color="yellow">
						⚙ Running {currentTool || 'tools'}... |{' '}
					</Text>
				)}
				<Text bold>{model}</Text>
				{showContextUsage && (
					<Text dimColor> | Context: {formatContextUsage(contextUsage)}</Text>
				)}
				{formatTodoCounts && (
					<Text dimColor> | Todos: {formatTodoCounts}</Text>
				)}
			</Box>
		</Box>
	);
}
