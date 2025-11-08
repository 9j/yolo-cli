/**
 * Confirmation prompt for compacting conversation history
 * Feature: 004-slash-commands (User Story 4)
 */

import React, {type FC} from 'react';
import {Box, Text, useInput} from 'ink';

export interface ConfirmCompactPromptProps {
	originalMessageCount: number;
	estimatedCompactedCount: number;
	originalTokenEstimate: number;
	estimatedCompactedTokens: number;
	reductionPercentage: number;
	onConfirm: () => void;
	onCancel: () => void;
}

export const ConfirmCompactPrompt: FC<ConfirmCompactPromptProps> = ({
	originalMessageCount,
	estimatedCompactedCount,
	originalTokenEstimate,
	estimatedCompactedTokens,
	reductionPercentage,
	onConfirm,
	onCancel,
}) => {
	useInput((input, key) => {
		if (input.toLowerCase() === 'y') {
			onConfirm();
		} else if (input.toLowerCase() === 'n' || key.escape || key.return) {
			onCancel();
		}
	});

	return (
		<Box
			borderStyle="round"
			borderColor="blue"
			flexDirection="column"
			paddingX={1}
		>
			<Text bold color="blue">
				ℹ️  Compact Conversation History
			</Text>
			<Text> </Text>
			<Text>
				Before: {originalMessageCount} messages (~
				{originalTokenEstimate.toLocaleString()} tokens)
			</Text>
			<Text>
				After: {estimatedCompactedCount} messages (~
				{estimatedCompactedTokens.toLocaleString()} tokens)
			</Text>
			<Text>
				Reduction: {reductionPercentage.toFixed(1)}%
			</Text>
			<Text> </Text>
			<Text dimColor>This will take 10-30 seconds.</Text>
			<Text> </Text>
			<Text>
				Continue? (<Text color="green">y</Text>/
				<Text bold color="red">
					N
				</Text>
				)
			</Text>
		</Box>
	);
};
